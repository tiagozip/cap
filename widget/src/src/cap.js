(() => {
  const WASM_VERSION = "0.0.6";

  if (typeof window === "undefined") {
    return;
  }

  const capFetch = (u, _conf = {}) => {
    const conf = {
      ..._conf,
      headers: {
        ...(_conf.headers || {}),
        "Cap-Stamp": btoa(
          String.fromCharCode(
            ...[[Date.now()]].map((n) => [n >> 24, n >> 16, n >> 8, n[0]].map((x) => x & 255))[0],
          ),
        ).replace(/=/g, ""),
        "Cap-Solver": `0,${WASM_VERSION}`,
      },
    };

    if (window?.CAP_CUSTOM_FETCH) {
      return window.CAP_CUSTOM_FETCH(u, conf);
    }

    return fetch(u, conf);
  };

  function prng(seed, length) {
    function fnv1a(str) {
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      }
      return hash >>> 0;
    }

    let state = fnv1a(seed);
    let result = "";

    function next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    }

    while (result.length < length) {
      const rnd = next();
      result += rnd.toString(16).padStart(8, "0");
    }

    return result.substring(0, length);
  }

  async function runInstrumentationChallenge(instrBytes) {
    const b64ToUint8 = (b64) => {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    };

    var compressed = b64ToUint8(instrBytes);

    const scriptText = await new Promise((resolve, reject) => {
      try {
        var ds = new DecompressionStream("deflate-raw");
        var writer = ds.writable.getWriter();
        var reader = ds.readable.getReader();
        var chunks = [];
        function pump(res) {
          if (res.done) {
            var len = 0,
              off = 0;
            for (var i = 0; i < chunks.length; i++) len += chunks[i].length;
            var out = new Uint8Array(len);
            for (var i = 0; i < chunks.length; i++) {
              out.set(chunks[i], off);
              off += chunks[i].length;
            }
            resolve(new TextDecoder().decode(out));
          } else {
            chunks.push(res.value);
            reader.read().then(pump).catch(reject);
          }
        }
        reader.read().then(pump).catch(reject);
        writer
          .write(compressed)
          .then(() => {
            writer.close();
          })
          .catch(reject);
      } catch (e) {
        reject(e);
      }
    });

    return new Promise((resolve) => {
      var timeout = setTimeout(() => {
        cleanup();
        resolve({ __timeout: true });
      }, 20000);

      var iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText =
        "position:absolute;width:1px;height:1px;top:-9999px;left:-9999px;border:none;opacity:0;pointer-events:none;";

      var resolved = false;
      function cleanup() {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }

      function handler(ev) {
        var d = ev.data;
        if (!d || typeof d !== "object") return;
        if (d.type === "cap:instr") {
          cleanup();
          if (d.blocked) {
            resolve({
              __blocked: true,
              blockReason: d.blockReason || "automated_browser",
            });
          } else if (d.result) {
            resolve(d.result);
          } else {
            resolve({ __timeout: true });
          }
        } else if (d.type === "cap:error") {
          cleanup();
          resolve({ __timeout: true });
        }
      }

      window.addEventListener("message", handler);

      iframe.srcdoc =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>' +
        scriptText +
        "\n</scr" +
        "ipt></body></html>";

      document.body.appendChild(iframe);
    });
  }

  let wasmModulePromise = null;

  const getWasmModule = () => {
    if (wasmModulePromise) return wasmModulePromise;

    const wasmUrl =
      window.CAP_CUSTOM_WASM_URL ||
      `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`;

    wasmModulePromise = fetch(wasmUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch wasm: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => WebAssembly.compile(buf))
      .catch((e) => {
        wasmModulePromise = null;
        throw e;
      });

    return wasmModulePromise;
  };

  if (typeof WebAssembly === "object" && typeof WebAssembly.compile === "function") {
    getWasmModule().catch(() => {});
  }

  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const SPECULATIVE_DELAY_MS = 2500;
  const SPECULATIVE_WORKERS = 1;
  const SPECULATIVE_YIELD_MS = 120;

  const speculative = {
    state: "idle",
    challengeResp: null,
    challenges: null,
    results: [],
    completedCount: 0,
    solvePromise: null,
    promoteFn: null,
    _listeners: [],
    pendingPromotion: null,
    token: null,
    tokenExpires: null,

    notify() {
      for (const fn of this._listeners) fn();
      this._listeners = [];
    },

    onSettled(fn) {
      if (this.state === "done" || this.state === "error") {
        fn();
      } else {
        this._listeners.push(fn);
      }
    },
  };

  function _resetSpeculativeState() {
    speculative.state = "idle";
    speculative.challengeResp = null;
    speculative.challenges = null;
    speculative.results = [];
    speculative.completedCount = 0;
    speculative.solvePromise = null;
    speculative.promoteFn = null;
    speculative.pendingPromotion = null;
    speculative._listeners = [];
    speculative.token = null;
    speculative.tokenExpires = null;

    _attachInteractionListeners();
  }

  let _speculativeTimer = null;

  function _onFirstInteraction() {
    if (speculative.state !== "idle") return;
    speculative.state = "waiting";

    _speculativeTimer = setTimeout(() => {
      _beginSpeculativeSolve();
    }, SPECULATIVE_DELAY_MS);
  }

  let _currentInteractionHandler = null;

  function _detachInteractionListeners() {
    if (_currentInteractionHandler) {
      window.removeEventListener("mousemove", _currentInteractionHandler);
      window.removeEventListener("touchstart", _currentInteractionHandler);
      window.removeEventListener("keydown", _currentInteractionHandler);
      _currentInteractionHandler = null;
    }
  }

  function _attachInteractionListeners() {
    _detachInteractionListeners();

    const handler = () => {
      _detachInteractionListeners();
      _onFirstInteraction();
    };
    _currentInteractionHandler = handler;
    window.addEventListener("mousemove", handler, { passive: true });
    window.addEventListener("touchstart", handler, { passive: true });
    window.addEventListener("keydown", handler, { passive: true });
  }

  _attachInteractionListeners();

  async function _beginSpeculativeSolve() {
    if (speculative.state !== "waiting") return;
    speculative.state = "fetching";

    const widget = document.querySelector("cap-widget");
    if (!widget) {
      speculative.state = "idle";
      return;
    }

    let apiEndpoint = widget.getAttribute("data-cap-api-endpoint");
    if (!apiEndpoint && window?.CAP_CUSTOM_FETCH) {
      apiEndpoint = "/";
    }
    if (!apiEndpoint) {
      speculative.state = "idle";
      return;
    }
    if (!apiEndpoint.endsWith("/")) apiEndpoint += "/";

    try {
      const raw = await capFetch(`${apiEndpoint}challenge`, { method: "POST" });
      let resp;
      try {
        resp = await raw.json();
      } catch {
        throw new Error("Failed to parse speculative challenge response");
      }
      if (resp.error) throw new Error(resp.error);

      resp._apiEndpoint = apiEndpoint;
      speculative.challengeResp = resp;

      const { challenge, token } = resp;
      let challenges = challenge;
      if (!Array.isArray(challenges)) {
        let i = 0;
        challenges = Array.from({ length: challenge.c }, () => {
          i++;
          return [prng(`${token}${i}`, challenge.s), prng(`${token}${i}d`, challenge.d)];
        });
      }
      speculative.challenges = challenges;
      speculative.state = "solving";

      speculative.solvePromise = _speculativeSolveAll(challenges);
    } catch (e) {
      console.warn("[cap] speculative challenge fetch failed:", e);
      speculative.state = "error";
      speculative.notify();
    }
  }

  async function _speculativeSolveAll(challenges) {
    _getSharedWorkerUrl();

    let wasmModule = null;
    try {
      wasmModule = await getWasmModule();
    } catch {}

    _speculativePool.setWasm(wasmModule);

    const total = challenges.length;
    const results = new Array(total);

    let concurrency = SPECULATIVE_WORKERS;
    let promoted = false;

    speculative.promoteFn = (fullCount) => {
      if (promoted) return;
      promoted = true;
      concurrency = fullCount;
      _speculativePool._size = fullCount;
      _speculativePool._ensureSize(fullCount);
    };

    if (speculative.pendingPromotion !== null) {
      speculative.promoteFn(speculative.pendingPromotion);
      speculative.pendingPromotion = null;
    }

    let nextIndex = 0;

    while (nextIndex < total) {
      const batchSize = concurrency;
      const batch = [];
      const batchIndices = [];

      for (let i = 0; i < batchSize && nextIndex < total; i++) {
        batchIndices.push(nextIndex);
        batch.push(challenges[nextIndex]);
        nextIndex++;
      }

      _speculativePool._ensureSize(Math.max(concurrency, batchSize));

      const batchResults = await Promise.all(
        batch.map((challenge) =>
          _speculativePool.run(challenge[0], challenge[1]).then((nonce) => {
            speculative.completedCount++;
            return nonce;
          }),
        ),
      );

      for (let i = 0; i < batchIndices.length; i++) {
        results[batchIndices[i]] = batchResults[i];
      }

      if (!promoted && nextIndex < total) {
        await new Promise((resolve) => setTimeout(resolve, SPECULATIVE_YIELD_MS));
      }
    }

    speculative.results = results;
    speculative.state = "redeeming";
    _speculativeRedeem(results);
    return results;
  }

  async function _speculativeRedeem(solutions) {
    try {
      const challengeResp = speculative.challengeResp;
      const apiEndpoint = challengeResp._apiEndpoint;
      if (!apiEndpoint) throw new Error("[cap] speculative redeem: missing apiEndpoint");

      let instrOut = null;
      if (challengeResp.instrumentation) {
        instrOut = await runInstrumentationChallenge(challengeResp.instrumentation);
        if (instrOut?.__timeout || instrOut?.__blocked) {
          speculative.state = "done";
          speculative.notify();
          return;
        }
      }

      const redeemRaw = await capFetch(`${apiEndpoint}redeem`, {
        method: "POST",
        body: JSON.stringify({
          token: challengeResp.token,
          solutions,
          ...(instrOut && { instr: instrOut }),
        }),
        headers: { "Content-Type": "application/json" },
      });

      let resp;
      try {
        resp = await redeemRaw.json();
      } catch {
        throw new Error("Failed to parse speculative redeem response");
      }

      if (!resp.success) throw new Error(resp.error || "Speculative redeem failed");

      speculative.token = resp.token;
      speculative.tokenExpires = new Date(resp.expires).getTime();
      speculative.state = "done";
      speculative.notify();
    } catch (e) {
      console.warn("[cap] speculative redeem failed (will redo on click):", e);
      speculative.state = "done";
      speculative.notify();
    }
  }

  let _sharedWorkerUrl = null;

  function _getSharedWorkerUrl() {
    if (_sharedWorkerUrl) return _sharedWorkerUrl;

    _sharedWorkerUrl = URL.createObjectURL(
      new Blob([`%%workerScript%%`], { type: "application/javascript" }),
    );
    return _sharedWorkerUrl;
  }

  class WorkerPool {
    constructor(size) {
      this._size = size;
      this._workers = [];
      this._idle = [];
      this._queue = [];
      this._wasmModule = null;
      this._spawnFailures = 0;
    }

    setWasm(wasmModule) {
      this._wasmModule = wasmModule;
    }

    _spawn() {
      const url = _getSharedWorkerUrl();
      const w = new Worker(url);
      w._busy = false;
      this._workers.push(w);
      this._idle.push(w);
      return w;
    }

    _replaceWorker(deadWorker) {
      const idx = this._workers.indexOf(deadWorker);
      if (idx !== -1) this._workers.splice(idx, 1);
      const idleIdx = this._idle.indexOf(deadWorker);
      if (idleIdx !== -1) this._idle.splice(idleIdx, 1);

      try {
        deadWorker.terminate();
      } catch {}

      this._spawnFailures++;
      if (this._spawnFailures > 3) {
        console.error("[cap] worker spawn failed repeatedly, not retrying");
        return null;
      }

      return this._spawn();
    }

    _ensureSize(n) {
      while (this._workers.length < n) this._spawn();
    }

    run(salt, target) {
      return new Promise((resolve, reject) => {
        this._queue.push({ salt, target, resolve, reject });
        this._dispatch();
      });
    }

    _dispatch() {
      while (this._idle.length > 0 && this._queue.length > 0) {
        const worker = this._idle.shift();
        const { salt, target, resolve, reject } = this._queue.shift();

        let settled = false;

        const onMessage = ({ data }) => {
          if (settled) return;
          settled = true;
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          this._spawnFailures = 0;
          this._idle.push(worker);
          if (!data.found) {
            reject(new Error(data.error || "worker failed"));
          } else {
            resolve(data.nonce);
          }
          this._dispatch();
        };

        const onError = (err) => {
          if (settled) return;
          settled = true;
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          const replacement = this._replaceWorker(worker);
          reject(err);
          if (replacement) {
            this._dispatch();
          }
        };

        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", onError);

        if (this._wasmModule) {
          worker.postMessage({ salt, target, wasmModule: this._wasmModule }, []);
        } else {
          worker.postMessage({ salt, target });
        }
      }
    }

    terminate() {
      for (const w of this._workers) {
        try {
          w.terminate();
        } catch {}
      }
      this._workers = [];
      this._idle = [];
      this._queue = [];
    }
  }

  const _speculativePool = new WorkerPool(1);
  _speculativePool._spawn();

  class CapWidget extends HTMLElement {
    #resetTimer = null;
    #workersCount = navigator.hardwareConcurrency || 8;
    token = null;
    #shadow;
    #div;
    #host;
    #solving = false;
    #eventHandlers;

    getI18nText(key, defaultValue) {
      return this.getAttribute(`data-cap-i18n-${key}`) || defaultValue;
    }

    static get observedAttributes() {
      return [
        "onsolve",
        "onprogress",
        "onreset",
        "onerror",
        "data-cap-worker-count",
        "data-cap-i18n-initial-state",
      ];
    }

    constructor() {
      super();
      if (this.#eventHandlers) {
        this.#eventHandlers.forEach((handler, eventName) => {
          this.removeEventListener(eventName.slice(2), handler);
        });
      }

      this.#eventHandlers = new Map();
      this.boundHandleProgress = this.handleProgress.bind(this);
      this.boundHandleSolve = this.handleSolve.bind(this);
      this.boundHandleError = this.handleError.bind(this);
      this.boundHandleReset = this.handleReset.bind(this);
    }

    initialize() {
      _getSharedWorkerUrl();
    }

    attributeChangedCallback(name, _, value) {
      if (name.startsWith("on")) {
        const eventName = name.slice(2);
        const oldHandler = this.#eventHandlers.get(name);
        if (oldHandler) {
          this.removeEventListener(eventName, oldHandler);
        }

        if (value) {
          const handler = (event) => {
            const callback = this.getAttribute(name);
            if (typeof window[callback] === "function") {
              window[callback].call(this, event);
            }
          };
          this.#eventHandlers.set(name, handler);
          this.addEventListener(eventName, handler);
        }
      }

      if (name === "data-cap-worker-count") {
        this.setWorkersCount(parseInt(value, 10));
      }

      if (
        name === "data-cap-i18n-initial-state" &&
        this.#div &&
        this.#div?.querySelector(".label.active")
      ) {
        this.animateLabel(this.getI18nText("initial-state", "Verify you're human"));
      }
    }

    async connectedCallback() {
      this.#host = this;
      this.#shadow = this.attachShadow({ mode: "open" });
      this.#div = document.createElement("div");
      this.createUI();
      this.addEventListeners();
      this.initialize();
      this.#div.removeAttribute("disabled");

      const workers = this.getAttribute("data-cap-worker-count");
      const parsedWorkers = workers ? parseInt(workers, 10) : null;
      this.setWorkersCount(parsedWorkers || navigator.hardwareConcurrency || 8);
      const fieldName = this.getAttribute("data-cap-hidden-field-name") || "cap-token";
      this.#host.innerHTML = `<input type="hidden" name="${fieldName}">`;

      if (speculative.state === "idle" || speculative.state === "waiting") {
        if (_speculativeTimer) {
          clearTimeout(_speculativeTimer);
          _speculativeTimer = null;
        }
        speculative.state = "waiting";
        _speculativeTimer = setTimeout(() => _beginSpeculativeSolve(), SPECULATIVE_DELAY_MS);
      }
    }

    async solve() {
      if (this.#solving) {
        return;
      }

      try {
        this.#solving = true;
        this.updateUI("verifying", this.getI18nText("verifying-label", "Verifying..."), true);
        this.#div.setAttribute(
          "aria-label",
          this.getI18nText("verifying-aria-label", "Verifying you're a human, please wait"),
        );
        this.dispatchEvent("progress", { progress: 0 });

        try {
          let apiEndpoint = this.getAttribute("data-cap-api-endpoint");
          if (!apiEndpoint && window?.CAP_CUSTOM_FETCH) {
            apiEndpoint = "/";
          } else if (!apiEndpoint) {
            throw new Error(
              "Missing API endpoint. Either custom fetch or an API endpoint must be provided.",
            );
          }
          if (!apiEndpoint.endsWith("/")) apiEndpoint += "/";

          let solutions;
          let challengeResp;

          if (
            speculative.state === "done" &&
            speculative.token &&
            speculative.tokenExpires &&
            Date.now() < speculative.tokenExpires
          ) {
            this.dispatchEvent("progress", { progress: 100 });

            const fieldName = this.getAttribute("data-cap-hidden-field-name") || "cap-token";
            if (this.querySelector(`input[name='${fieldName}']`)) {
              this.querySelector(`input[name='${fieldName}']`).value = speculative.token;
            }
            this.dispatchEvent("solve", { token: speculative.token });
            this.token = speculative.token;

            const expiresIn = speculative.tokenExpires - Date.now();
            if (this.#resetTimer) clearTimeout(this.#resetTimer);
            this.#resetTimer = setTimeout(() => this.reset(), expiresIn);

            this.#div.setAttribute(
              "aria-label",
              this.getI18nText(
                "verified-aria-label",
                "We have verified you're a human, you may now continue",
              ),
            );

            _resetSpeculativeState();
            this.#solving = false;
            return;
          }

          if (speculative.state === "done") {
            solutions = speculative.results;
            challengeResp = speculative.challengeResp;
            this.dispatchEvent("progress", { progress: 100 });
          } else if (
            speculative.state === "solving" ||
            speculative.state === "redeeming" ||
            speculative.state === "fetching" ||
            speculative.state === "waiting"
          ) {
            if (speculative.state === "waiting") {
              if (_speculativeTimer) {
                clearTimeout(_speculativeTimer);
                _speculativeTimer = null;
              }
              speculative.state = "waiting";
              _beginSpeculativeSolve();
            }

            speculative.pendingPromotion = this.#workersCount;
            if (speculative.promoteFn) {
              speculative.promoteFn(this.#workersCount);
            }

            const progressInterval = setInterval(() => {
              if (speculative.state !== "solving" && speculative.state !== "redeeming") {
                clearInterval(progressInterval);
                return;
              }
              const total = speculative.challenges ? speculative.challenges.length : 1;
              const done = speculative.completedCount;
              const visual =
                speculative.state === "redeeming"
                  ? 99
                  : Math.min(98, Math.round((done / total) * 100));
              this.dispatchEvent("progress", { progress: visual });
            }, 150);

            await new Promise((resolve) => speculative.onSettled(resolve));
            clearInterval(progressInterval);

            if (speculative.state !== "done") {
              throw new Error("Speculative solve failed – please try again");
            }

            if (
              speculative.token &&
              speculative.tokenExpires &&
              Date.now() < speculative.tokenExpires
            ) {
              this.dispatchEvent("progress", { progress: 100 });

              const fieldName = this.getAttribute("data-cap-hidden-field-name") || "cap-token";
              if (this.querySelector(`input[name='${fieldName}']`)) {
                this.querySelector(`input[name='${fieldName}']`).value = speculative.token;
              }
              this.dispatchEvent("solve", { token: speculative.token });
              this.token = speculative.token;

              const expiresIn = speculative.tokenExpires - Date.now();
              if (this.#resetTimer) clearTimeout(this.#resetTimer);
              this.#resetTimer = setTimeout(() => this.reset(), expiresIn);

              this.#div.setAttribute(
                "aria-label",
                this.getI18nText(
                  "verified-aria-label",
                  "We have verified you're a human, you may now continue",
                ),
              );

              _resetSpeculativeState();
              this.#solving = false;
              return;
            }

            solutions = speculative.results;
            challengeResp = speculative.challengeResp;
            this.dispatchEvent("progress", { progress: 100 });
          } else {
            const challengeRaw = await capFetch(`${apiEndpoint}challenge`, {
              method: "POST",
            });
            try {
              challengeResp = await challengeRaw.json();
            } catch {
              throw new Error("Failed to parse challenge response from server");
            }
            if (challengeResp.error) throw new Error(challengeResp.error);

            const { challenge, token } = challengeResp;
            let challenges = challenge;
            if (!Array.isArray(challenges)) {
              let i = 0;
              challenges = Array.from({ length: challenge.c }, () => {
                i++;
                return [prng(`${token}${i}`, challenge.s), prng(`${token}${i}d`, challenge.d)];
              });
            }

            solutions = await this.solveChallenges(challenges);
          }

          const instrPromise = challengeResp.instrumentation
            ? runInstrumentationChallenge(challengeResp.instrumentation)
            : Promise.resolve(null);

          const instrOut = await instrPromise;

          if (instrOut?.__timeout || instrOut?.__blocked) {
            this.updateUIBlocked(this.getI18nText("error-label", "Error"), instrOut?.__blocked);
            this.#div.setAttribute(
              "aria-label",
              this.getI18nText("error-aria-label", "An error occurred, please try again"),
            );
            this.removeEventListener("error", this.boundHandleError);
            const errEvent = new CustomEvent("error", {
              bubbles: true,
              composed: true,
              detail: { isCap: true, message: "Instrumentation failed" },
            });
            super.dispatchEvent(errEvent);
            this.addEventListener("error", this.boundHandleError);
            this.executeAttributeCode("onerror", errEvent);
            console.error("[cap]", "Instrumentation failed");
            this.#solving = false;
            return;
          }

          const { token } = challengeResp;

          const redeemResponse = await capFetch(`${apiEndpoint}redeem`, {
            method: "POST",
            body: JSON.stringify({
              token,
              solutions,
              ...(instrOut && { instr: instrOut }),
            }),
            headers: { "Content-Type": "application/json" },
          });

          let resp;
          try {
            resp = await redeemResponse.json();
          } catch {
            throw new Error("Failed to parse server response");
          }

          this.dispatchEvent("progress", { progress: 100 });
          if (!resp.success) throw new Error(resp.error || "Invalid solution");

          const fieldName = this.getAttribute("data-cap-hidden-field-name") || "cap-token";
          if (this.querySelector(`input[name='${fieldName}']`)) {
            this.querySelector(`input[name='${fieldName}']`).value = resp.token;
          }

          this.dispatchEvent("solve", { token: resp.token });
          this.token = resp.token;

          _resetSpeculativeState();

          if (this.#resetTimer) clearTimeout(this.#resetTimer);
          const expiresIn = new Date(resp.expires).getTime() - Date.now();
          if (expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000) {
            this.#resetTimer = setTimeout(() => this.reset(), expiresIn);
          } else {
            this.error("Invalid expiration time");
          }

          this.#div.setAttribute(
            "aria-label",
            this.getI18nText(
              "verified-aria-label",
              "We have verified you're a human, you may now continue",
            ),
          );

          return { success: true, token: this.token };
        } catch (err) {
          this.#div.setAttribute(
            "aria-label",
            this.getI18nText("error-aria-label", "An error occurred, please try again"),
          );
          this.error(err.message);
          throw err;
        }
      } finally {
        this.#solving = false;
      }
    }

    async solveChallenges(challenges) {
      const total = challenges.length;
      let completed = 0;

      const speculativeHead = 0;
      const remaining = total - speculativeHead;

      let wasmModule = null;
      const wasmSupported =
        typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";

      if (wasmSupported) {
        try {
          wasmModule = await getWasmModule();
        } catch (e) {
          console.warn("[cap] wasm unavailable, falling back to JS solver:", e);
        }
      }

      if (!wasmSupported) {
        if (!this.#shadow.querySelector(".warning")) {
          const warningEl = document.createElement("div");
          warningEl.className = "warning";
          warningEl.style.cssText = `width:var(--cap-widget-width,230px);background:rgb(237,56,46);color:white;padding:4px 6px;padding-bottom:calc(var(--cap-border-radius,14px) + 5px);font-size:10px;box-sizing:border-box;font-family:system-ui;border-top-left-radius:8px;border-top-right-radius:8px;text-align:center;user-select:none;margin-bottom:-35.5px;opacity:0;transition:margin-bottom .3s,opacity .3s;`;
          warningEl.innerText = this.getI18nText(
            "wasm-disabled",
            "Enable WASM for significantly faster solving",
          );
          this.#shadow.insertBefore(warningEl, this.#shadow.firstChild);
          setTimeout(() => {
            warningEl.style.marginBottom = `calc(-1 * var(--cap-border-radius, 14px))`;
            warningEl.style.opacity = 1;
          }, 10);
        }
      }

      const pool = new WorkerPool(this.#workersCount);
      pool.setWasm(wasmModule);
      pool._ensureSize(this.#workersCount);

      const results = [];
      try {
        for (let i = 0; i < challenges.length; i += this.#workersCount) {
          const chunk = challenges.slice(i, Math.min(i + this.#workersCount, challenges.length));
          const chunkResults = await Promise.all(
            chunk.map(([salt, target]) =>
              pool.run(salt, target).then((nonce) => {
                completed++;
                const visual = Math.min(
                  99,
                  Math.round(((speculativeHead + completed) / total) * 100),
                );
                this.dispatchEvent("progress", { progress: visual });
                return nonce;
              }),
            ),
          );
          results.push(...chunkResults);
        }
      } finally {
        pool.terminate();
      }

      return results;
    }

    setWorkersCount(workers) {
      const parsedWorkers = parseInt(workers, 10);
      const maxWorkers = Math.min(navigator.hardwareConcurrency || 8, 16);
      this.#workersCount =
        !Number.isNaN(parsedWorkers) && parsedWorkers > 0 && parsedWorkers <= maxWorkers
          ? parsedWorkers
          : navigator.hardwareConcurrency || 8;
    }

    createUI() {
      this.#div.classList.add("captcha");
      this.#div.setAttribute("role", "button");
      this.#div.setAttribute("tabindex", "0");
      this.#div.setAttribute(
        "aria-label",
        this.getI18nText("verify-aria-label", "Click to verify you're a human"),
      );
      this.#div.setAttribute("aria-live", "polite");
      this.#div.setAttribute("disabled", "true");
      this.#div.innerHTML = `<div class="checkbox" part="checkbox"><svg class="progress-ring" viewBox="0 0 32 32"><circle class="progress-ring-bg" cx="16" cy="16" r="14"></circle><circle class="progress-ring-circle" cx="16" cy="16" r="14"></circle></svg></div><p part="label" class="label-wrapper"><span class="label active">${this.getI18nText(
        "initial-state",
        "Verify you're human",
      )}</span></p><a part="attribution" aria-label="Secured by Cap" href="https://capjs.js.org/" class="credits" target="_blank" rel="follow noopener" title="Secured by Cap: Self-hosted CAPTCHA for the modern web.">Cap</a>`;

      this.#shadow.innerHTML = `<style${window.CAP_CSS_NONCE ? ` nonce=${window.CAP_CSS_NONCE}` : ""}>%%capCSS%%</style>`;

      this.#shadow.appendChild(this.#div);
    }

    addEventListeners() {
      if (!this.#div) return;

      this.#div.querySelector("a").addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        window.open("https://capjs.js.org", "_blank");
      });

      this.#div.addEventListener("click", () => {
        if (!this.#div.hasAttribute("disabled")) this.solve();
      });

      this.#div.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !this.#div.hasAttribute("disabled")) {
          e.preventDefault();
          e.stopPropagation();
          this.solve();
        }
      });

      this.addEventListener("progress", this.boundHandleProgress);
      this.addEventListener("solve", this.boundHandleSolve);
      this.addEventListener("error", this.boundHandleError);
      this.addEventListener("reset", this.boundHandleReset);
    }

    animateLabel(text) {
      if (!this.#div) return;
      const wrapper = this.#div.querySelector(".label-wrapper");
      if (!wrapper) return;

      if (prefersReducedMotion()) {
        const current = wrapper.querySelector(".label.active");
        if (current) {
          current.textContent = text;
        } else {
          const span = document.createElement("span");
          span.className = "label active";
          span.textContent = text;
          wrapper.appendChild(span);
        }
        return;
      }

      const current = wrapper.querySelector(".label.active");

      const next = document.createElement("span");
      next.className = "label";
      next.textContent = text;
      wrapper.appendChild(next);

      void next.offsetWidth;

      next.classList.add("active");
      if (current) {
        current.classList.remove("active");
        current.classList.add("exit");
        current.addEventListener("transitionend", () => current.remove(), {
          once: true,
        });
      }
    }

    updateUI(state, text, disabled = false) {
      if (!this.#div) return;

      this.#div.setAttribute("data-state", state);

      this.animateLabel(text);

      if (disabled) {
        this.#div.setAttribute("disabled", "true");
      } else {
        this.#div.removeAttribute("disabled");
      }
    }

    updateUIBlocked(label, showTroubleshooting = false) {
      if (!this.#div) return;

      this.#div.setAttribute("data-state", "error");
      this.#div.removeAttribute("disabled");

      const wrapper = this.#div.querySelector(".label-wrapper");
      if (!wrapper) return;

      const troubleshootingUrl =
        this.getAttribute("data-cap-troubleshooting-url") ||
        "https://capjs.js.org/guide/troubleshooting/instrumentation.html";

      const current = wrapper.querySelector(".label.active");
      const next = document.createElement("span");
      next.className = "label";
      next.innerHTML = showTroubleshooting
        ? `${label} · <a class="cap-troubleshoot-link" href="${troubleshootingUrl}" target="_blank" rel="noopener">${this.getI18nText("troubleshooting-label", "Troubleshoot")}</a>`
        : label;
      wrapper.appendChild(next);

      void next.offsetWidth;
      next.classList.add("active");
      if (current) {
        current.classList.remove("active");
        current.classList.add("exit");
        current.addEventListener("transitionend", () => current.remove(), {
          once: true,
        });
      }

      const link = next.querySelector(".cap-troubleshoot-link");
      if (link) {
        console.log("linkblud")
        link.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }
    }

    handleProgress(event) {
      if (!this.#div) return;

      const progressCircle = this.#div.querySelector(".progress-ring-circle");

      if (progressCircle) {
        const circumference = 2 * Math.PI * 14;
        const offset = circumference - (event.detail.progress / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
      }

      const wrapper = this.#div.querySelector(".label-wrapper");
      if (wrapper) {
        const activeLabel = wrapper.querySelector(".label.active");
        if (activeLabel) {
          activeLabel.textContent = `${this.getI18nText("verifying-label", "Verifying...")} ${event.detail.progress}%`;
        }
      }

      this.executeAttributeCode("onprogress", event);
    }

    handleSolve(event) {
      this.updateUI("done", this.getI18nText("solved-label", "You're a human"), true);
      this.executeAttributeCode("onsolve", event);
    }

    handleError(event) {
      this.updateUI("error", this.getI18nText("error-label", "Error. Try again."));
      this.executeAttributeCode("onerror", event);
    }

    handleReset(event) {
      this.updateUI("", this.getI18nText("initial-state", "I'm a human"));
      this.executeAttributeCode("onreset", event);
    }

    executeAttributeCode(attributeName, event) {
      const code = this.getAttribute(attributeName);
      if (!code) {
        return;
      }

      console.error(
        "[cap] using `onxxx='…'` is strongly discouraged and will be deprecated soon. please use `addEventListener` callbacks instead.",
      );

      new Function("event", code).call(this, event);
    }

    error(message = "Unknown error") {
      console.error("[cap]", message);
      this.dispatchEvent("error", { isCap: true, message });
    }

    dispatchEvent(eventName, detail = {}) {
      const event = new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail,
      });
      super.dispatchEvent(event);
    }

    reset() {
      if (this.#resetTimer) {
        clearTimeout(this.#resetTimer);
        this.#resetTimer = null;
      }
      this.dispatchEvent("reset");
      this.token = null;
      const fieldName = this.getAttribute("data-cap-hidden-field-name") || "cap-token";
      if (this.querySelector(`input[name='${fieldName}']`)) {
        this.querySelector(`input[name='${fieldName}']`).value = "";
      }
    }

    get tokenValue() {
      return this.token;
    }

    disconnectedCallback() {
      this.removeEventListener("progress", this.boundHandleProgress);
      this.removeEventListener("solve", this.boundHandleSolve);
      this.removeEventListener("error", this.boundHandleError);
      this.removeEventListener("reset", this.boundHandleReset);

      this.#eventHandlers.forEach((handler, eventName) => {
        this.removeEventListener(eventName.slice(2), handler);
      });
      this.#eventHandlers.clear();

      if (this.#shadow) {
        this.#shadow.innerHTML = "";
      }

      this.reset();
      this.cleanup();
    }

    cleanup() {
      if (this.#resetTimer) {
        clearTimeout(this.#resetTimer);
        this.#resetTimer = null;
      }
    }
  }

  class Cap {
    constructor(config = {}, el) {
      const widget = el || document.createElement("cap-widget");

      Object.entries(config).forEach(([a, b]) => {
        widget.setAttribute(a, b);
      });

      if (!config.apiEndpoint && !window?.CAP_CUSTOM_FETCH) {
        widget.remove();
        throw new Error(
          "Missing API endpoint. Either custom fetch or an API endpoint must be provided.",
        );
      }

      if (config.apiEndpoint) {
        widget.setAttribute("data-cap-api-endpoint", config.apiEndpoint);
      }

      this.widget = widget;
      this.solve = this.widget.solve.bind(this.widget);
      this.reset = this.widget.reset.bind(this.widget);
      this.addEventListener = this.widget.addEventListener.bind(this.widget);

      Object.defineProperty(this, "token", {
        get: () => widget.token,
        configurable: true,
        enumerable: true,
      });

      if (!el) {
        widget.style.display = "none";
        document.documentElement.appendChild(widget);
      }
    }
  }

  window.Cap = Cap;

  if (!customElements.get("cap-widget") && !window?.CAP_DONT_SKIP_REDEFINE) {
    customElements.define("cap-widget", CapWidget);
  } else if (customElements.get("cap-widget")) {
    console.warn(
      "[cap] the cap-widget element has already been defined, skipping re-defining it.\nto prevent this, set window.CAP_DONT_SKIP_REDEFINE to true",
    );
  }

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = Cap;
  } else if (typeof define === "function" && define.amd) {
    define([], () => Cap);
  }

  if (typeof exports !== "undefined") {
    exports.default = Cap;
  }
})();
