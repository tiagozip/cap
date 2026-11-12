(() => {
  const WASM_VERSION = "0.0.8";
  const WIDGET_VERSION = "%%widgetVersion%%";
  const _browserHasHaptics =
    "vibrate" in navigator &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof window === "undefined") {
    return;
  }

  const _ctp = ["#f5c2e7","#cba6f7","#f38ba8","#fab387","#f9e2af","#a6e3a1","#94e2d5","#89dceb","#b4befe"];
  const _bg = (s) => {
    if (s === "cap") return "#89b4fa";
    let h = 0;
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return _ctp[Math.abs(h) % _ctp.length];
  };
  const _style = (t, i, n) => {
    const l = i === 0 ? "9999px" : "0";
    const r = i === n - 1 ? "9999px" : "0";
    return `color:#1e1e2e;background:${_bg(t)};margin-left:${i ? "-6px" : 0};padding:0 6px;border-radius:${l} ${r} ${r} ${l};font-weight:600`;
  };
  const log = {};
  for (const lvl of ["debug", "info", "warn", "error"]) {
    log[lvl] = (tags, ...args) => {
      if (window.CAP_SILENT || (lvl === "debug" && !window.CAP_DEBUG)) return;
      const fmt = tags.map((t) => `%c${t}`).join(" ");
      const styles = tags.map((t, i) => _style(t, i, tags.length));
      console[lvl === "debug" ? "log" : lvl](fmt, ...styles, ...args);
    };
  }
  const T = (sub) => (sub ? ["cap", sub] : ["cap"]);
  const since = (t) => `${Math.round(performance.now() - t)}ms`;
  const _err = (code, message) => Object.assign(new Error(message), { code });

  const capFetch = (u, conf = {}) => {
    if (window?.CAP_CUSTOM_FETCH) {
      return window.CAP_CUSTOM_FETCH(u, conf);
    }

    return fetch(u, conf);
  };

  const raceAbort = (promise, signal) => {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(_err("aborted", "aborted"));
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(_err("aborted", "aborted")),
          { once: true },
        ),
      ),
    ]);
  };

  const I18N_KEYS = "%%i18nKeys%%".split(",");
  const I18N_ROWS = %%i18nData%%;

  function _resolveI18nMap(forced) {
    const prefs = forced
      ? [forced]
      : navigator.languages || [navigator.language || ""];
    for (let pref of prefs) {
      if (!pref) continue;
      pref = pref.toLowerCase();
      if (pref === "en" || pref.startsWith("en-")) return null;
      const code = I18N_ROWS[pref]
        ? pref
        : I18N_ROWS[pref.split("-")[0]]
          ? pref.split("-")[0]
          : null;
      if (!code) return null;
      const parts = I18N_ROWS[code].split("/");
      const map = {};
      I18N_KEYS.forEach((k, i) => {
        map[k] = parts[i];
      });
      return map;
    }
    return null;
  }

  function prng(seed, length) {
    function fnv1a(str) {
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash +=
          (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
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

  let _pakoPromise = null;
  async function _inflateRaw(compressed) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer
          .write(compressed)
          .then(() => writer.close())
          .catch(() => {});
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        let len = 0;
        for (const c of chunks) len += c.length;
        const out = new Uint8Array(len);
        let off = 0;
        for (const c of chunks) {
          out.set(c, off);
          off += c.length;
        }
        return out;
      } catch {}
    }
    if (!_pakoPromise) {
      _pakoPromise = new Promise((resolve, reject) => {
        const url =
          window.CAP_PAKO_URL ||
          "https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako_inflate.min.js";
        log.debug(T("instr"), "DecompressionStream unavailable, loading pako from", url);
        const script = document.createElement("script");
        script.src = url;
        const pakoNonce = window.CAP_SCRIPT_NONCE || window.CAP_CSS_NONCE;
        if (pakoNonce) script.setAttribute("nonce", pakoNonce);
        script.onload = () => {
          if (window.pako?.inflateRaw) resolve(window.pako);
          else reject(new Error("pako loaded but inflateRaw is missing"));
        };
        script.onerror = () => {
          _pakoPromise = null;
          reject(new Error(`failed to load pako fallback from ${url}`));
        };
        document.head.appendChild(script);
      });
    }
    const pako = await _pakoPromise;
    return pako.inflateRaw(compressed);
  }

  const INSTR_ERRORS = [
    "csp_blocked",
    "natives_tampered",
    "env_failed",
    "script_failed",
  ];
  const CSP_DOCS = "https://trycap.dev/guide/widget.html#content-security-policy";

  function startInstrumentation(instrBytes, host) {
    let finished = false;
    let ready = false;
    let wantFinal = false;
    let nonce = null;
    let timer = null;
    let iframe = null;
    let settle;
    let markReady;
    const out = new Promise((resolve) => {
      settle = resolve;
    });
    const session = {
      observing: false,
      result: null,
      ready: new Promise((resolve) => {
        markReady = resolve;
      }),
    };
    const send = () =>
      iframe?.contentWindow?.postMessage({ type: "cap:finalize", nonce }, "*");
    const finish = (value) => {
      if (finished) return;
      finished = true;
      session.result = value;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe?.remove();
      markReady();
      settle(value);
    };
    const onMessage = (ev) => {
      if (!iframe?.contentWindow || ev.source !== iframe.contentWindow) return;
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "cap:ready") {
        ready = true;
        nonce = d.nonce;
        session.observing = d.observe === true;
        markReady();
        if (wantFinal) send();
      } else if (d.type === "cap:instr") {
        if (d.early === true) return;
        finish(
          d.blocked
            ? { __blocked: true, blockReason: d.blockReason || "automated_browser" }
            : d.result || { __timeout: true },
        );
      } else if (d.type === "cap:error") {
        finish({
          __error: INSTR_ERRORS.includes(d.reason) ? d.reason : "script_failed",
        });
      }
    };
    session.finalize = () => {
      if (!finished) {
        wantFinal = true;
        timer ??= setTimeout(() => finish({ __timeout: true }), 20000);
        if (ready) send();
      }
      return out;
    };
    session.stop = () => finish({ __timeout: true });
    window.addEventListener("message", onMessage);

    (async () => {
      const bin = atob(instrBytes);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const scriptText = new TextDecoder().decode(await _inflateRaw(bytes));
      if (finished) return;
      const isolated = window.CAP_ISOLATE === true;
      iframe = document.createElement("iframe");
      iframe.setAttribute(
        "sandbox",
        isolated ? "allow-scripts" : "allow-scripts allow-same-origin",
      );
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");
      iframe.style.cssText =
        "position:absolute;width:1px;height:1px;top:-9999px;left:-9999px;border:none;opacity:0;pointer-events:none;";
      const scriptNonce = window.CAP_SCRIPT_NONCE || window.CAP_CSS_NONCE;
      const nonceAttr = scriptNonce
        ? ` nonce="${String(scriptNonce).replace(/"/g, "&quot;")}"`
        : "";
      iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script${nonceAttr}>${scriptText}\n</scr${"ipt"}></body></html>`;
      iframe.addEventListener("load", () => {
        if (isolated) {
          setTimeout(() => {
            if (!ready && !finished) finish({ __error: "csp_blocked" });
          }, 1000);
          return;
        }
        let ran = true;
        try {
          const doc = iframe.contentDocument;
          ran = !doc?.querySelector("script") || iframe.contentWindow.onload !== null;
        } catch {}
        if (ran) return;
        setTimeout(() => {
          if (!ready && !finished) finish({ __error: "csp_blocked" });
        }, 250);
      });
      (host.host?.getClientRects().length === 0
        ? document.documentElement
        : host
      ).appendChild(iframe);
    })().catch(() => finish({ __timeout: true }));

    return session;
  }

  let wasmModulePromise = null;

  const wasmCompiles = (() => {
    try {
      return (
        new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])) instanceof
        WebAssembly.Module
      );
    } catch {
      return false;
    }
  })();

  const getWasmModule = () => {
    if (wasmModulePromise) return wasmModulePromise;

    const wasmUrl =
      window.CAP_CUSTOM_WASM_URL ||
      `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`;

    const t0 = performance.now();
    log.debug(T("wasm"), "fetching", wasmUrl);
    wasmModulePromise = fetch(wasmUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch wasm: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => WebAssembly.compile(buf))
      .then((mod) => {
        log.debug(T("wasm"), `ready in ${since(t0)}`);
        return mod;
      })
      .catch((e) => {
        wasmModulePromise = null;
        log.warn(T("wasm"), `load failed (${since(t0)}):`, e.message || e);
        throw e;
      });

    return wasmModulePromise;
  };

  const firstFulfilled = (tasks) =>
    new Promise((resolve, reject) => {
      let pending = tasks.length;
      let firstError = null;
      for (const task of tasks) {
        task.then(resolve, (err) => {
          if (!firstError) firstError = err;
          pending--;
          if (pending === 0) reject(firstError);
        });
      }
    });

  const MAX_HASHWX_DIFFICULTY = 1_000_000_000;
  const MAX_HASHWX_NONCES_PER_HASH = 1_048_576;

  let hashwxModulePromise = null;

  const getHashwxModule = () => {
    if (hashwxModulePromise) return hashwxModulePromise;

    const wasmUrl =
      window.CAP_CUSTOM_HASHWX_URL ||
      `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/hashwx.wasm`;

    const t0 = performance.now();
    log.debug(T("wasm"), "fetching", wasmUrl);
    hashwxModulePromise = fetch(wasmUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch hashwx wasm: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => WebAssembly.compile(buf))
      .then((mod) => {
        log.debug(T("wasm"), `hashwx ready in ${since(t0)}`);
        return mod;
      })
      .catch((e) => {
        hashwxModulePromise = null;
        log.warn(T("wasm"), `hashwx load failed (${since(t0)}):`, e.message || e);
        throw e;
      });

    return hashwxModulePromise;
  };

  if (
    typeof WebAssembly === "object" &&
    typeof WebAssembly.compile === "function"
  ) {
    getWasmModule().catch(() => {});
  }

  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const SPECULATIVE_DELAY_MS = 2500;
  const SPECULATIVE_WORKERS = 1;
  const SPECULATIVE_YIELD_MS = 120;
  const MAX_IDLE_REFRESHES = 6;

  let _sharedWorkerUrl = null;

  function _getSharedWorkerUrl() {
    if (_sharedWorkerUrl) return _sharedWorkerUrl;

    _sharedWorkerUrl = URL.createObjectURL(
      new Blob([%%workerScript%%], { type: "application/javascript" }),
    );
    return _sharedWorkerUrl;
  }

  const WORKER_STOP_GRACE_MS = 250;
  const HASHWX_SETTLE_MS = 1000;

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
      log.warn(T("pool"), `worker died, replacing (attempt ${this._spawnFailures}/3)`);
      if (this._spawnFailures > 3) {
        log.error(T("pool"), "worker spawn failed repeatedly, giving up");
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

    runMsg(msg, onProgress) {
      return new Promise((resolve, reject) => {
        this._queue.push({ msg, onProgress, resolve, reject });
        this._dispatch();
      });
    }

    _dispatch() {
      while (this._idle.length > 0 && this._queue.length > 0) {
        const worker = this._idle.shift();
        const task = this._queue.shift();
        const { resolve, reject } = task;
        const isMsg = task.msg !== undefined;

        let settled = false;

        const onMessage = ({ data }) => {
          if (settled) return;

          if (data && typeof data.progress === "number" && !data.found) {
            if (task.onProgress) {
              try { task.onProgress(data.progress); } catch {}
            }
            return;
          }
          settled = true;
          worker.removeEventListener("message", onMessage);
          worker.removeEventListener("error", onError);
          this._spawnFailures = 0;
          this._idle.push(worker);
          if (!data.found) {
            reject(new Error(data.error || "worker failed"));
          } else {
            resolve(isMsg ? data : data.nonce);
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

        if (isMsg) {
          worker.postMessage(task.msg);
        } else if (this._wasmModule) {
          worker.postMessage(
            { salt: task.salt, target: task.target, wasmModule: this._wasmModule },
            [],
          );
        } else {
          worker.postMessage({ salt: task.salt, target: task.target });
        }
      }
    }

    stopAll() {
      for (const w of this._workers) {
        try {
          w.postMessage({ kind: "stop" });
        } catch {}
      }
    }

    terminate() {
      const workers = this._workers;
      this._workers = [];
      this._idle = [];
      this._queue = [];
      for (const w of workers) {
        try {
          w.postMessage({ kind: "stop" });
        } catch {}
      }
      setTimeout(() => {
        for (const w of workers) {
          try {
            w.terminate();
          } catch {}
        }
      }, WORKER_STOP_GRACE_MS);
    }
  }

  class CapWidget extends HTMLElement {
    static formAssociated = true;
    #resetTimer = null;
    #workersCount = navigator.hardwareConcurrency || 8;
    token = null;
    #shadow;
    #div;
    #trigger;
    #credits;
    #troubleshootLink;
    #lastServerFailure = null;
    #solveStartedAt = 0;
    #host;
    #solving = false;
    #eventHandlers;
    #internals;

    #speculative = null;
    #speculativeTimer = null;
    #speculativePool = null;
    #interactionHandler = null;
    #i18n = null;
    #abort = null;
    #idleRefreshes = 0;
    #refreshOnVisible = false;

    get #hasHaptics() {
      return (
        _browserHasHaptics &&
        !window.CAP_DISABLE_HAPTICS &&
        !this.hasAttribute("data-cap-disable-haptics")
      );
    }

    #makeSpeculativeState() {
      return {
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
        fetchP: null,
        refreshTimer: null,
        redeemError: null,

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
    }

    #resetSpeculativeState() {
      this.#dropChallenge(this.#speculative);
      this.#speculative = this.#makeSpeculativeState();
      this.#attachInteractionListeners();
    }

    #dropChallenge(spec) {
      if (!spec) return;
      clearTimeout(spec.refreshTimer);
      spec.challengeResp?._instr?.stop();
    }

    #endpoint() {
      let apiEndpoint = this.getAttribute("data-cap-api-endpoint");
      if (!apiEndpoint && window?.CAP_CUSTOM_FETCH) apiEndpoint = "/";
      if (!apiEndpoint) return null;
      return apiEndpoint.endsWith("/") ? apiEndpoint : `${apiEndpoint}/`;
    }

    #instrBlob(resp) {
      if (resp?.format === 2 && Array.isArray(resp.challenges)) {
        return (
          resp.challenges.find((ch) => ch?.protocol === "instrumentation")
            ?.payload?.blob ?? null
        );
      }
      return resp?.instrumentation ?? null;
    }

    #startInstr(resp) {
      const blob = this.#instrBlob(resp);
      if (!blob || !this.#shadow) return null;
      if (!resp._instr || resp._instr.result?.__timeout) {
        resp._instr = startInstrumentation(blob, this.#shadow);
      }
      return resp._instr;
    }

    #finalizeInstr(resp) {
      const session = this.#startInstr(resp);
      return session ? session.finalize() : Promise.resolve(null);
    }

    #fetchChallenge(signal) {
      const spec = this.#speculative;
      if (!spec) return Promise.reject(_err("aborted", "aborted"));
      if (spec.fetchP) return spec.fetchP;
      const apiEndpoint = this.#endpoint();
      if (!apiEndpoint) {
        return Promise.reject(
          _err(
            "missing_endpoint",
            "Missing API endpoint. Either custom fetch or an API endpoint must be provided.",
          ),
        );
      }
      const pending = (async () => {
        const raw = await capFetch(`${apiEndpoint}challenge${wasmCompiles ? "" : "?wasm=0"}`, {
          method: "POST",
          signal: signal ?? this.#abort?.signal,
        });
        let resp;
        try {
          resp = await raw.json();
        } catch {
          throw _err("challenge_parse_error", "Failed to parse challenge response from server");
        }
        if (resp.error) throw _err("network_error", resp.error);
        resp._apiEndpoint = apiEndpoint;
        if (this.#speculative !== spec) return resp;
        spec.challengeResp = resp;
        this.#startInstr(resp);
        this.#scheduleRefresh(spec, resp);
        return resp;
      })();
      spec.fetchP = pending;
      pending.catch(() => {
        if (spec.fetchP === pending) spec.fetchP = null;
      });
      return pending;
    }

    #scheduleRefresh(spec, resp) {
      clearTimeout(spec.refreshTimer);
      let ttl = Number.NaN;
      try {
        const claims = JSON.parse(
          atob(resp.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        ttl = Math.min(claims.exp, Number(resp.expires) || claims.exp) - claims.iat;
      } catch {}
      if (!(ttl > 0)) ttl = Number(resp.expires) - Date.now();
      if (!(ttl > 60_000 && ttl < 86_400_000)) ttl = 300_000;
      const hashwx =
        resp.format === 2 &&
        resp.challenges?.some?.((ch) => ch?.protocol === "hashwx");
      const margin = Math.min(
        ttl / 2,
        Math.max(hashwx ? 120_000 : 30_000, ttl * (hashwx ? 0.3 : 0.15)),
      );
      spec.refreshTimer = setTimeout(() => {
        if (this.#speculative !== spec || this.#solving || spec.token) return;
        if (spec.challengeResp !== resp) return;
        if (spec.state !== "idle" && spec.state !== "done") return;
        this.#resetSpeculativeState();
        if (this.#idleRefreshes >= MAX_IDLE_REFRESHES) return;
        if (document.hidden) {
          this.#refreshOnVisible = true;
          return;
        }
        this.#idleRefreshes++;
        this.#prefetch();
      }, ttl - margin);
    }

    #takeChallenge() {
      const spec = this.#speculative;
      const resp = spec.challengeResp;
      spec.challengeResp = null;
      spec.fetchP = null;
      clearTimeout(spec.refreshTimer);
      return resp;
    }

    #prefetch() {
      const spec = this.#speculative;
      if (!spec || spec.challengeResp || spec.fetchP) return;
      if (!this.#endpoint() || !this.#isVisible()) return;
      this.#fetchChallenge().catch(() => {});
    }

    #detachInteractionListeners() {
      if (this.#interactionHandler) {
        window.removeEventListener("mousemove", this.#interactionHandler);
        window.removeEventListener("touchstart", this.#interactionHandler);
        window.removeEventListener("keydown", this.#interactionHandler);
        this.#interactionHandler = null;
      }
    }

    #attachInteractionListeners() {
      this.#detachInteractionListeners();
      const handler = () => {
        this.#detachInteractionListeners();
        this.#idleRefreshes = 0;
        this.#onFirstInteraction();
      };
      this.#interactionHandler = handler;
      window.addEventListener("mousemove", handler, { passive: true });
      window.addEventListener("touchstart", handler, { passive: true });
      window.addEventListener("keydown", handler, { passive: true });
    }

    #isVisible() {
      if (typeof this.checkVisibility === "function") {
        return this.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
      }
      return !!(this.offsetParent || this.getClientRects().length > 0);
    }

    #logInvisible() {
      if (!this.#isVisible()) log.info(T("challenges"), "solved invisible challenge");
    }

    #onFirstInteraction() {
      this.#prefetch();
      if (this.#speculative.state !== "idle") return;
      if (!this.#isVisible()) return;
      this.#speculative.state = "waiting";
      this.#speculativeTimer = setTimeout(() => {
        this.#beginSpeculativeSolve();
      }, SPECULATIVE_DELAY_MS);
    }

    async #beginSpeculativeSolve() {
      const spec = this.#speculative;
      if (spec?.state !== "waiting") return;
      spec.state = "fetching";
      spec._t0 = performance.now();

      if (!this.#endpoint()) {
        spec.state = "idle";
        return;
      }

      try {
        const resp = await this.#fetchChallenge();
        if (this.#speculative !== spec) return;

        if (resp.format === 2 && Array.isArray(resp.challenges)) {
          if (resp.challenges.some((ch) => ch?.protocol === "hashwx")) {
            getHashwxModule().catch(() => {});
          }
          spec.state = "idle";
          spec.notify();
          return;
        }

        const { challenge, token } = resp;
        let challenges = challenge;
        if (!Array.isArray(challenges)) {
          let i = 0;
          challenges = Array.from({ length: challenge.c }, () => {
            i++;
            return [
              prng(`${token}${i}`, challenge.s),
              prng(`${token}${i}d`, challenge.d),
            ];
          });
        }
        spec.challenges = challenges;
        spec.state = "solving";

        spec.solvePromise = this.#speculativeSolveAll(
          challenges,
          spec,
        ).catch(() => {
          if (this.#speculative !== spec) return;
          spec.state = "error";
          spec.notify();
        });
      } catch {
        if (this.#speculative !== spec) return;
        spec.state = "error";
        spec.notify();
      }
    }

    async #speculativeSolveAll(challenges, spec) {
      _getSharedWorkerUrl();

      let wasmModule = null;
      try {
        wasmModule = await getWasmModule();
      } catch {}

      if (this.#speculative !== spec) return [];
      if (!this.#speculativePool) {
        this.#speculativePool = new WorkerPool(1);
        this.#speculativePool._spawn();
      }
      this.#speculativePool.setWasm(wasmModule);

      const total = challenges.length;
      const results = new Array(total);

      let concurrency = SPECULATIVE_WORKERS;
      let promoted = false;

      spec.promoteFn = (fullCount) => {
        if (promoted || !this.#speculativePool) return;
        promoted = true;
        concurrency = fullCount;
        this.#speculativePool._size = fullCount;
        this.#speculativePool._ensureSize(fullCount);
      };

      if (spec.pendingPromotion !== null) {
        spec.promoteFn(spec.pendingPromotion);
        spec.pendingPromotion = null;
      }

      let nextIndex = 0;

      while (nextIndex < total) {
        if (this.#speculative !== spec || !this.#speculativePool) return results;
        const batchSize = concurrency;
        const batch = [];
        const batchIndices = [];

        for (let i = 0; i < batchSize && nextIndex < total; i++) {
          batchIndices.push(nextIndex);
          batch.push(challenges[nextIndex]);
          nextIndex++;
        }

        this.#speculativePool._ensureSize(Math.max(concurrency, batchSize));

        const batchResults = await Promise.all(
          batch.map((challenge) =>
            this.#speculativePool
              .run(challenge[0], challenge[1])
              .then((nonce) => {
                spec.completedCount++;
                return nonce;
              }),
          ),
        );

        for (let i = 0; i < batchIndices.length; i++) {
          results[batchIndices[i]] = batchResults[i];
        }

        if (!promoted && nextIndex < total) {
          await new Promise((resolve) =>
            setTimeout(resolve, SPECULATIVE_YIELD_MS),
          );
        }
      }

      if (this.#speculative !== spec) return results;
      spec.results = results;
      spec.state = "redeeming";
      this.#speculativeRedeem(results, spec);
      return results;
    }

    async #speculativeRedeem(solutions, spec) {
      let answered = false;
      try {
        if (this.#speculative !== spec) return;
        const challengeResp = spec.challengeResp;
        const apiEndpoint = challengeResp._apiEndpoint;
        if (!apiEndpoint)
          throw _err("missing_endpoint", "speculative redeem: missing apiEndpoint");

        const session = this.#startInstr(challengeResp);
        if (session) {
          await Promise.race([
            session.ready,
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
          if (this.#speculative !== spec) return;
        }
        if (session?.observing) {
          spec.state = "done";
          spec.notify();
          return;
        }

        let instrOut = null;
        if (session) {
          instrOut = await session.finalize();
          if (this.#speculative !== spec) return;
          if (instrOut?.__timeout || instrOut?.__blocked || instrOut?.__error) {
            spec.state = "done";
            spec.notify();
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
          signal: this.#abort?.signal,
        });

        answered = true;
        let resp;
        try {
          resp = await redeemRaw.json();
        } catch {
          throw new Error("Failed to parse server response");
        }

        if (this.#speculative !== spec) return;
        if (!resp.success)
          throw new Error(resp.error || "Invalid solution");

        spec.token = resp.token;
        spec.tokenExpires = new Date(resp.expires).getTime();
        spec.state = "done";
        spec._invisibleElapsed = spec._t0 ? since(spec._t0) : "?";
        spec.notify();
      } catch (err) {
        if (this.#speculative !== spec) return;
        if (answered) spec.redeemError = err?.message || "Invalid solution";
        spec.state = "done";
        spec.notify();
      }
    }

    get #fieldName() {
      return this.getAttribute("data-cap-hidden-field-name") || "cap-token";
    }

    #setToken(value) {
      const input = this.querySelector(`input[name='${this.#fieldName}']`);
      if (input) input.value = value;
    }

    getI18nText(key, defaultValue) {
      return (
        this.getAttribute(`data-cap-i18n-${key}`) ||
        this.#i18n?.[key] ||
        defaultValue
      );
    }

    #commitSpeculativeToken() {
      log.debug(T("solve"), `served from speculative cache (saved ${this.#speculative._invisibleElapsed || "?"})`);
      this.dispatchEvent("progress", { progress: 100 });

      this.#setToken(this.#speculative.token);

      this.dispatchEvent("solve", { token: this.#speculative.token });
      this.token = this.#speculative.token;

      const expiresIn = this.#speculative.tokenExpires - Date.now();
      if (this.#resetTimer) clearTimeout(this.#resetTimer);
      this.#resetTimer = setTimeout(() => this.reset(), expiresIn);

      this.#trigger.setAttribute(
        "aria-label",
        this.getI18nText(
          "verified-aria-label",
          "We have verified you're a human, you may now continue",
        ),
      );
      if (this.#hasHaptics) navigator.vibrate([10, 50, 20, 30, 40]);

      this.#logInvisible();
      this.#resetSpeculativeState();
      this.#solving = false;
      return { success: true, token: this.token };
    }

    #resolveI18n() {
      this.#i18n = _resolveI18nMap(
        window.CAP_LANG || this.getAttribute("data-cap-lang"),
      );
    }

    static get observedAttributes() {
      return [
        "onsolve",
        "onprogress",
        "onreset",
        "onerror",
        "data-cap-worker-count",
        "data-cap-i18n-initial-state",
        "required",
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

      try {
        this.#internals = this.attachInternals();
      } catch {}
    }

    #updateValidity() {
      if (!this.#internals?.setValidity) return;
      if (this.hasAttribute("required") && !this.token) {
        this.#internals.setValidity(
          { valueMissing: true },
          this.getI18nText("required-label", "Please verify you're human"),
          this.#div || this,
        );
      } else {
        this.#internals.setValidity({});
      }
    }

    initialize() {
      _getSharedWorkerUrl();
      this.#abort = new AbortController();
      if (!this.#speculative) {
        this.#speculative = this.#makeSpeculativeState();
      }
      if (!this.#speculativePool) {
        this.#speculativePool = new WorkerPool(1);
        this.#speculativePool._spawn();
      }
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
        this.animateLabel(
          this.getI18nText("initial-state", "Verify you're human"),
        );
      }

      if (name === "required") {
        this.#updateValidity();
      }
    }

    async connectedCallback() {
      this.#host = this;

      if (!this.shadowRoot) {
        this.#shadow = this.attachShadow({ mode: "open" });
      } else {
        this.#shadow = this.shadowRoot;
      }

      if (!this.#div) this.#div = document.createElement("div");
      this.#resolveI18n();
      this.createUI();
      this.addEventListeners();
      this.initialize();
      this.#trigger.removeAttribute("disabled");

      const workers = this.getAttribute("data-cap-worker-count");
      const parsedWorkers = workers ? parseInt(workers, 10) : null;
      this.setWorkersCount(parsedWorkers || navigator.hardwareConcurrency || 8);
      this.#host.innerHTML = `<input type="hidden" name="${this.#fieldName}">`;

      log.debug(T(), `widget ready (workers=${this.#workersCount}, haptics=${this.#hasHaptics})`);
      this.#attachInteractionListeners();
      this.#prefetch();
      this.#updateValidity();

      this.addEventListener("invalid", this.#handleInvalid);
      document.addEventListener("visibilitychange", this.#handleVisibility);
    }

    #handleVisibility = () => {
      if (document.hidden || !this.#refreshOnVisible) return;
      this.#refreshOnVisible = false;
      this.#prefetch();
    };

    #handleInvalid = () => {
      if (!this.#div) return;
      try {
        this.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        this.scrollIntoView();
      }
      this.#div.classList.remove("invalid");
      void this.#div.offsetWidth;
      this.#div.classList.add("invalid");
      setTimeout(() => this.#div?.classList.remove("invalid"), 1500);
    };

    async solve() {
      if (this.#solving) {
        return;
      }

      this.#enforceCredits();
      const _solveT0 = performance.now();
      this.#solveStartedAt = Date.now();
      this.#lastServerFailure = null;
      let usedResp = null;
      let reported = null;
      const signal = this.#abort?.signal;
      log.debug(T("solve"), "starting");

      try {
        this.#solving = true;
        this.updateUI(
          "verifying",
          this.getI18nText("verifying-label", "Verifying..."),
          true,
        );
        this.#trigger.setAttribute(
          "aria-label",
          this.getI18nText(
            "verifying-aria-label",
            "Verifying you're a human, please wait",
          ),
        );
        this.dispatchEvent("progress", { progress: 0 });

        try {
          let apiEndpoint = this.getAttribute("data-cap-api-endpoint");
          if (!apiEndpoint && window?.CAP_CUSTOM_FETCH) {
            apiEndpoint = "/";
          } else if (!apiEndpoint) {
            throw _err(
              "missing_endpoint",
              "Missing API endpoint. Either custom fetch or an API endpoint must be provided.",
            );
          }
          if (!apiEndpoint.endsWith("/")) apiEndpoint += "/";

          let solutions;
          let challengeResp;

          if (
            this.#speculative.state === "done" &&
            this.#speculative.token &&
            this.#speculative.tokenExpires &&
            Date.now() < this.#speculative.tokenExpires
          ) {
            return this.#commitSpeculativeToken();
          }

          if (this.#speculative.redeemError) {
            throw _err("invalid_solution", this.#speculative.redeemError);
          }

          if (this.#speculative.state === "done") {
            solutions = this.#speculative.results;
            challengeResp = this.#speculative.challengeResp;
            this.dispatchEvent("progress", { progress: 100 });
          } else if (
            this.#speculative.state === "solving" ||
            this.#speculative.state === "redeeming" ||
            this.#speculative.state === "fetching" ||
            this.#speculative.state === "waiting"
          ) {
            if (this.#speculative.state === "waiting") {
              if (this.#speculativeTimer) {
                clearTimeout(this.#speculativeTimer);
                this.#speculativeTimer = null;
              }
              this.#speculative.state = "waiting";
              this.#beginSpeculativeSolve();
            }

            this.#speculative.pendingPromotion = this.#workersCount;
            if (this.#speculative.promoteFn) {
              this.#speculative.promoteFn(this.#workersCount);
            }

            const progressInterval = setInterval(() => {
              if (signal?.aborted || !this.#speculative) {
                clearInterval(progressInterval);
                return;
              }
              const st = this.#speculative.state;
              if (st === "done" || st === "error") {
                clearInterval(progressInterval);
                return;
              }
              const total = this.#speculative.challenges
                ? this.#speculative.challenges.length
                : 1;
              const done = this.#speculative.completedCount;
              const visual =
                st === "redeeming"
                  ? 99
                  : st === "fetching" || st === "waiting"
                    ? 0
                    : Math.min(98, Math.round((done / total) * 100));
              this.dispatchEvent("progress", { progress: visual });
            }, 150);

            await new Promise((resolve) =>
              this.#speculative.onSettled(resolve),
            );
            clearInterval(progressInterval);
            if (signal?.aborted || !this.#speculative) return;

            if (
              this.#speculative.state === "idle" &&
              this.#speculative.challengeResp?.format === 2 &&
              Array.isArray(this.#speculative.challengeResp.challenges)
            ) {
              challengeResp = this.#takeChallenge();
              usedResp = challengeResp;
              solutions = await this.solveChallengesV2(
                challengeResp.challenges,
                signal,
                challengeResp,
              );
            } else {
              if (this.#speculative.state !== "done") {
                throw _err("solve_failed", "Unable to solve challenge, self-hosted instance likely down. This is not an issue with Cap.");
              }

            if (
              this.#speculative.token &&
              this.#speculative.tokenExpires &&
              Date.now() < this.#speculative.tokenExpires
            ) {
              return this.#commitSpeculativeToken();
            }

            if (this.#speculative.redeemError) {
              throw _err("invalid_solution", this.#speculative.redeemError);
            }

            solutions = this.#speculative.results;
            challengeResp = this.#speculative.challengeResp;
            this.dispatchEvent("progress", { progress: 100 });
            }
          } else {
            if (!this.#speculative.challengeResp) {
              await this.#fetchChallenge(signal);
            }
            if (signal?.aborted || !this.#speculative) return;
            challengeResp = this.#takeChallenge();
            if (!challengeResp) throw _err("network_error", "Failed to fetch challenge");
            usedResp = challengeResp;

            if (
              challengeResp.format === 2 &&
              Array.isArray(challengeResp.challenges)
            ) {
              solutions = await this.solveChallengesV2(
                challengeResp.challenges,
                signal,
                challengeResp,
              );
            } else {
              const { challenge, token } = challengeResp;
              let challenges = challenge;
              if (!Array.isArray(challenges)) {
                let i = 0;
                challenges = Array.from({ length: challenge.c }, () => {
                  i++;
                  return [
                    prng(`${token}${i}`, challenge.s),
                    prng(`${token}${i}d`, challenge.d),
                  ];
                });
              }
              solutions = await this.solveChallenges(challenges, signal);
            }
          }

          usedResp = challengeResp;
          const v2 = challengeResp.format === 2;
          const instrOut = v2 ? null : await this.#finalizeInstr(challengeResp);
          if (signal?.aborted || !this.#speculative) return;

          const v2Fail = v2
            ? solutions?.find?.((x) => x?.error || x?.timeout || x?.blocked)
            : null;
          const instrFail = v2Fail
            ? {
                __error: v2Fail.error,
                __timeout: v2Fail.timeout,
                __blocked: v2Fail.blocked,
              }
            : instrOut?.__timeout || instrOut?.__blocked || instrOut?.__error
              ? instrOut
              : null;

          if (instrFail) {
            capFetch(`${apiEndpoint}redeem`, {
              method: "POST",
              body: JSON.stringify({
                token: challengeResp.token,
                solutions,
                ...(!v2 && instrFail.__error && { instr_error: instrFail.__error }),
                ...(!v2 && instrFail.__blocked && { instr_blocked: true }),
                ...(!v2 && instrFail.__timeout && { instr_timeout: true }),
              }),
              headers: { "Content-Type": "application/json" },
              signal,
            }).catch(() => {});

            const csp = instrFail.__error === "csp_blocked";
            this.#lastServerFailure = {
              instrFailure: {
                error: instrFail.__error ?? null,
                blocked: !!instrFail.__blocked,
                timeout: !!instrFail.__timeout,
                blockReason: instrFail.blockReason ?? null,
              },
            };
            this.updateUIBlocked(
              csp
                ? this.getI18nText(
                    "csp-error-label",
                    this.#i18n?.["error-label"] || "Blocked by this page",
                  )
                : this.getI18nText("error-label", "Error"),
              true,
            );
            this.#trigger.setAttribute(
              "aria-label",
              this.getI18nText(
                "error-aria-label",
                "An error occurred, please try again",
              ),
            );
            const instrCode = instrFail.__error
              ? `instr_${instrFail.__error}`
              : instrFail.__blocked
                ? "instr_blocked"
                : "instr_timeout";
            const instrMsg = csp
              ? "The page's Content-Security-Policy blocked Cap's instrumentation frame"
              : instrFail.__error
                ? `Instrumentation failed (${instrFail.__error})`
                : instrFail.__blocked
                  ? `Instrumentation blocked (${instrFail.blockReason || "automated_browser"})`
                  : "Instrumentation timed out";
            this.removeEventListener("error", this.boundHandleError);
            const errEvent = new CustomEvent("error", {
              bubbles: true,
              composed: true,
              detail: { isCap: true, code: instrCode, message: instrMsg },
            });
            super.dispatchEvent(errEvent);
            this.addEventListener("error", this.boundHandleError);
            this.executeAttributeCode("onerror", errEvent);
            log.error(
              T("instr"),
              csp
                ? `[${instrCode}] ${instrMsg}. Set window.CAP_SCRIPT_NONCE to the nonce in your script-src before the widget loads, see ${CSP_DOCS}`
                : `[${instrCode}] ${instrMsg}`,
            );
            this.#resetSpeculativeState();
            reported = _err(instrCode, instrMsg);
            throw reported;
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
            signal,
          });

          let resp;
          try {
            resp = await redeemResponse.json();
          } catch {
            throw _err("redeem_failed", "Failed to parse server response");
          }

          if (signal?.aborted || !this.#speculative) return;

          this.dispatchEvent("progress", { progress: 100 });
          if (!resp.success) {
            this.#lastServerFailure = {
              status: redeemResponse.status,
              reason: resp.reason ?? null,
              error: resp.error ?? null,
              instrError: resp.instr_error === true,
              blockedBy: resp.blockedBy ?? resp.flags ?? null,
            };
            throw _err("invalid_solution", resp.error || "Invalid solution");
          }

          this.#setToken(resp.token);

          this.dispatchEvent("solve", { token: resp.token });
          this.token = resp.token;

          this.#resetSpeculativeState();

          if (this.#resetTimer) clearTimeout(this.#resetTimer);
          const expiresIn = new Date(resp.expires).getTime() - Date.now();
          if (expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000) {
            this.#resetTimer = setTimeout(() => this.reset(), expiresIn);
          } else {
            this.error("Invalid expiration time", "invalid_expires");
          }

          this.#trigger.setAttribute(
            "aria-label",
            this.getI18nText(
              "verified-aria-label",
              "We have verified you're a human, you may now continue",
            ),
          );
          if (this.#hasHaptics) navigator.vibrate([10, 50, 20, 30, 40]);

          log.debug(T("solve"), `verified in ${since(_solveT0)}`);
          this.#logInvisible();
          return { success: true, token: this.token };
        } catch (err) {
          if (signal?.aborted || !this.#speculative) return;
          if (err === reported) throw err;
          this.#trigger.setAttribute(
            "aria-label",
            this.getI18nText(
              "error-aria-label",
              "An error occurred, please try again",
            ),
          );
          this.error(err.message, err.code || "solve_failed");
          this.#resetSpeculativeState();
          throw err;
        }
      } finally {
        usedResp?._instr?.stop();
        this.#solving = false;
      }
    }

    async solveChallengesV2(challenges, signal, resp) {
      const owner = resp ?? { format: 2, challenges };
      const total = challenges.length;
      let completed = 0;

      const solutions = new Array(challenges.length);
      for (let i = 0; i < challenges.length; i++) {
        const ch = challenges[i];
        if (
          !ch ||
          typeof ch !== "object" ||
          !(
            ch.protocol === "sha256-pow" ||
            ch.protocol === "rsw" ||
            ch.protocol === "hashwx" ||
            ch.protocol === "instrumentation"
          )
        ) {
          throw _err("challenge_unsupported", `unsupported format-2 protocol '${ch?.protocol}'`);
        }
      }

      let needsCapWasm = false;
      let hashwxCount = 0;
      for (const ch of challenges) {
        if (ch.protocol === "sha256-pow") needsCapWasm = true;
        else if (ch.protocol === "hashwx") {
          hashwxCount++;
          const { c, d, n } = ch.payload ?? {};
          if (
            typeof c !== "string" ||
            !/^[0-9a-f]{64}$/i.test(c) ||
            !Number.isInteger(d) ||
            d < 1 ||
            d > MAX_HASHWX_DIFFICULTY ||
            !Number.isInteger(n) ||
            n < 1 ||
            n > MAX_HASHWX_NONCES_PER_HASH
          ) {
            throw _err("challenge_unsupported", "malformed hashwx challenge payload");
          }
        }
      }
      const needsHashwx = hashwxCount > 0;

      const wasmSupported =
        typeof WebAssembly === "object" &&
        typeof WebAssembly.instantiate === "function";

      let wasmModule = null;
      if (wasmSupported && needsCapWasm) {
        try { wasmModule = await getWasmModule(); }
        catch (e) { log.warn(T("wasm"), "unavailable, falling back to JS solver:", e.message || e); }
      }

      let hashwxModule = null;
      if (needsHashwx) {
        if (!wasmSupported) {
          throw _err("challenge_unsupported", "hashwx requires WebAssembly");
        }
        hashwxModule = await getHashwxModule();
      }

      const poolSize = Math.max(1, Math.min(this.#workersCount, challenges.length));
      const pool = new WorkerPool(poolSize);
      pool.setWasm(wasmModule);
      pool._ensureSize(poolSize);

      const hashwxWorkers = Math.max(1, this.#workersCount);
      const hashwxQueued = hashwxCount > hashwxWorkers;
      const hashwxStripes = hashwxQueued ? 1 : hashwxWorkers;
      let hashwxPool = needsHashwx ? new WorkerPool(hashwxWorkers) : null;
      if (hashwxPool) hashwxPool._ensureSize(hashwxWorkers);

      const reclaimStripes = async (stripes) => {
        hashwxPool.stopAll();
        let timer;
        const settled = await Promise.race([
          Promise.allSettled(stripes).then(() => true),
          new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), HASHWX_SETTLE_MS);
          }),
        ]);
        clearTimeout(timer);
        if (settled) return;
        log.warn(T("solve"), "hashwx workers did not stop in time, replacing the pool");
        hashwxPool.terminate();
        hashwxPool = new WorkerPool(hashwxWorkers);
        hashwxPool._ensureSize(hashwxWorkers);
      };

      const TASK_TIMEOUT_MS = 60_000;
      const withTimeout = (promise, label) => {
        let timer;
        return Promise.race([
          promise,
          new Promise((_, rej) => {
            timer = setTimeout(
              () => rej(new Error(`[cap] ${label} timed out after ${TASK_TIMEOUT_MS}ms`)),
              TASK_TIMEOUT_MS,
            );
          }),
        ]).finally(() => clearTimeout(timer));
      };

      const inFlight = new Array(challenges.length).fill(0);
      const emit = () => {
        const sum = inFlight.reduce((a, b) => a + b, 0) + completed;
        const visual = Math.min(99, Math.round((sum / total) * 100));
        this.dispatchEvent("progress", { progress: visual });
      };

      const solveHashwx = async (ch, idx) => {
        const { c, d, n } = ch.payload;
        const expected = Math.max(1, d);
        const striped = new Array(hashwxStripes).fill(0);
        const stripes = [];
        try {
          for (let s = 0; s < hashwxStripes; s++) {
            const stripe = s;
            const task = hashwxPool.runMsg(
              {
                kind: "hashwx",
                hashwxModule,
                c,
                d,
                n,
                workerIndex: stripe,
                workerCount: hashwxStripes,
              },
              (hashes) => {
                striped[stripe] = hashes;
                let sum = 0;
                for (const v of striped) sum += v;
                inFlight[idx] = Math.min(0.99, sum / expected);
                emit();
              },
            );
            task.catch(() => {});
            stripes.push(task);
          }
          const data = await withTimeout(
            firstFulfilled(stripes).catch((err) => {
              throw _err(
                "solve_failed",
                err?.message || "every hashwx worker failed",
              );
            }),
            `hashwx worker #${idx}`,
          );
          solutions[idx] = { nonce: data.nonce };
          log.debug(
            T("solve"),
            `hashwx #${idx}: ${data.hashes} hashes in ${data.durationMs}ms`,
            `compiled=${data.compiled}`,
          );
          inFlight[idx] = 0;
          completed++;
          emit();
        } catch (err) {
          await reclaimStripes(stripes);
          throw err;
        }
        return stripes;
      };

      const hashwxJobs = [];
      challenges.forEach((ch, idx) => {
        if (ch.protocol === "hashwx") hashwxJobs.push({ ch, idx });
      });
      const hashwxSequence = hashwxJobs.length
        ? hashwxQueued
          ? Promise.all(hashwxJobs.map((job) => solveHashwx(job.ch, job.idx)))
          : (async () => {
              for (let i = 0; i < hashwxJobs.length; i++) {
                const stripes = await solveHashwx(
                  hashwxJobs[i].ch,
                  hashwxJobs[i].idx,
                );
                if (i < hashwxJobs.length - 1) await reclaimStripes(stripes);
              }
            })()
        : null;

      try {
        await raceAbort(Promise.all([
          hashwxSequence,
          ...challenges.map((ch, idx) => {
            if (ch.protocol === "sha256-pow") {
              return withTimeout(
                pool.run(ch.payload.salt, ch.payload.target),
                `sha256-pow worker #${idx}`,
              ).then((nonce) => {
                solutions[idx] = { nonce: Number(nonce) };
                inFlight[idx] = 0;
                completed++;
                emit();
              });
            }

            if (ch.protocol === "rsw") {
              return withTimeout(
                pool.runMsg(
                  { kind: "rsw", N: ch.payload.N, x: ch.payload.x, t: ch.payload.t | 0 },
                  (p) => { inFlight[idx] = p; emit(); },
                ),
                `rsw worker #${idx}`,
              ).then((data) => {
                solutions[idx] = { y: data.y };
                inFlight[idx] = 0;
                completed++;
                emit();
              });
            }

            if (ch.protocol === "hashwx") return null;

            return this.#finalizeInstr(owner).then((out) => {
              if (out?.__error) solutions[idx] = { error: out.__error };
              else if (out?.__timeout) solutions[idx] = { timeout: true };
              else if (out?.__blocked) solutions[idx] = { blocked: true };
              else solutions[idx] = { instr: out };
              inFlight[idx] = 0;
              completed++;
              emit();
            });
          }),
        ]), signal);
      } finally {
        pool.terminate();
        if (hashwxPool) hashwxPool.terminate();
      }

      return solutions;
    }

    async solveChallenges(challenges, signal) {
      const total = challenges.length;
      let completed = 0;

      const speculativeHead = 0;

      let wasmModule = null;
      const wasmSupported =
        typeof WebAssembly === "object" &&
        typeof WebAssembly.instantiate === "function";

      if (wasmSupported) {
        try {
          wasmModule = await getWasmModule();
        } catch (e) {
          log.warn(T("wasm"), "unavailable, falling back to JS solver:", e.message || e);
        }
      }

      if (!wasmSupported) {
        log.warn(T("wasm"), "WebAssembly disabled in this browser, solver will be ~10x slower");
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
          const chunk = challenges.slice(
            i,
            Math.min(i + this.#workersCount, challenges.length),
          );
          const chunkResults = await raceAbort(Promise.all(
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
          ), signal);
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
        !Number.isNaN(parsedWorkers) &&
        parsedWorkers > 0 &&
        parsedWorkers <= maxWorkers
          ? parsedWorkers
          : navigator.hardwareConcurrency || 8;
    }

    createUI() {
      this.#div.classList.add("captcha");
      this.#div.setAttribute("role", "group");
      this.#div.setAttribute(
        "aria-label",
        this.getI18nText("group-aria-label", "Cap verification"),
      );

      this.#trigger = document.createElement("div");
      this.#trigger.className = "captcha-trigger";
      this.#trigger.setAttribute("part", "trigger");
      this.#trigger.setAttribute("role", "button");
      this.#trigger.setAttribute("tabindex", "0");
      this.#trigger.setAttribute(
        "aria-label",
        this.getI18nText("verify-aria-label", "Click to verify you're a human"),
      );
      this.#trigger.setAttribute("aria-live", "polite");
      this.#trigger.setAttribute("disabled", "true");
      this.#trigger.innerHTML = `<div class="checkbox" part="checkbox" aria-hidden="true"><svg class="progress-ring" viewBox="0 0 32 32" aria-hidden="true"><circle class="progress-ring-bg" cx="16" cy="16" r="14"></circle><circle class="progress-ring-circle" cx="16" cy="16" r="14"></circle></svg></div><p part="label" class="label-wrapper"><span class="label active">${this.getI18nText(
        "initial-state",
        "Verify you're human",
      )}</span></p>`;
      this.#div.appendChild(this.#trigger);

      this.#troubleshootLink = document.createElement("a");
      this.#troubleshootLink.className = "cap-troubleshoot-link";
      this.#troubleshootLink.setAttribute("part", "troubleshoot");
      this.#troubleshootLink.setAttribute("target", "_blank");
      this.#troubleshootLink.setAttribute("rel", "noopener");
      this.#troubleshootLink.hidden = true;
      this.#div.appendChild(this.#troubleshootLink);

      this.#credits = document.createElement("a");
      this.#credits.className = "credits";
      this.#credits.setAttribute("aria-label", "Secured by Cap");
      this.#credits.setAttribute("href", "https://trycap.dev");
      this.#credits.setAttribute("target", "_blank");
      this.#credits.setAttribute(
        "title",
        "Secured by Cap: The self-hosted CAPTCHA for the modern web.",
      );
      this.#credits.textContent = "Cap";
      this.#div.appendChild(this.#credits);

      this.#shadow.innerHTML = `<style${window.CAP_CSS_NONCE ? ` nonce=${window.CAP_CSS_NONCE}` : ""}>%%capCSS%%</style>`;

      this.#shadow.appendChild(this.#div);

      this.#enforceCredits();
      setTimeout(() => this.#enforceCredits(), 100);
    }

    addEventListeners() {
      if (!this.#trigger) return;

      this.#credits.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(
          `https://trycap.dev/?${new URLSearchParams(
            {
              utm_source: "cap_widget",
              utm_medium: "referral",
              utm_campaign: "widget",
              utm_content: window.CAP_DISABLE_WIDGET_REF
                ? ""
                : location.hostname,
              ref: window.CAP_DISABLE_WIDGET_REF ? "" : location.href || "",
              sub: window.CAP_DISABLE_WIDGET_REF ? "" : document.referrer || "",
            },
          ).toString()}`,
          "_blank",
        );
      });

      this.#trigger.addEventListener("click", () => {
        if (!this.#trigger.hasAttribute("disabled")) this.solve().catch(() => {});
      });
      this.#trigger.addEventListener("mousedown", () => {
        if (!this.#trigger.hasAttribute("disabled") && this.#hasHaptics) {
          navigator.vibrate(5);
        }
      });

      this.#trigger.addEventListener("keydown", (e) => {
        if (e.target !== this.#trigger) return;
        if (
          (e.key === "Enter" || e.key === " ") &&
          !this.#trigger.hasAttribute("disabled")
        ) {
          e.preventDefault();
          e.stopPropagation();
          this.solve().catch(() => {});
        }
      });

      this.addEventListener("progress", this.boundHandleProgress);
      this.addEventListener("solve", this.boundHandleSolve);
      this.addEventListener("error", this.boundHandleError);
      this.addEventListener("reset", this.boundHandleReset);
    }

    #hostIsHidden() {
      if (!this.#host) return false;
      const rect = this.#host.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return true;
      const cs = window.getComputedStyle(this.#host);
      if (cs.display === "none" || cs.visibility === "hidden") return true;
      return false;
    }

    #enforceCredits() {
      if (!this.#credits || !this.#div || this.#hostIsHidden()) return;
      if (!this.#credits.isConnected || this.#credits.parentNode !== this.#div) {
        this.#div.appendChild(this.#credits);
      }
      if (!this.#credits.textContent || !this.#credits.textContent.trim()) {
        this.#credits.textContent = "Cap";
      }
      if (this.#credits.getAttribute("href") !== "https://trycap.dev") {
        this.#credits.setAttribute("href", "https://trycap.dev");
      }
      this.#credits.style.cssText = [
        "display: inline-flex !important",
        "visibility: visible !important",
        "opacity: 0.8 !important",
        "pointer-events: all !important",
        "font-size: 12px !important",
        "transform: none !important",
        "clip-path: none !important",
        "filter: none !important",
        "position: absolute !important",
      ].join("; ");
    }

    animateLabel(text) {
      if (!this.#trigger) return;
      const wrapper = this.#trigger.querySelector(".label-wrapper");
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
      if (!this.#div || !this.#trigger) return;

      this.#div.setAttribute("data-state", state);
      this.#div.classList.remove("has-troubleshoot");

      this.animateLabel(text);

      if (this.#troubleshootLink) this.#troubleshootLink.hidden = true;

      if (disabled) {
        this.#trigger.setAttribute("disabled", "true");
      } else {
        this.#trigger.removeAttribute("disabled");
      }
    }

    updateUIBlocked(label, showTroubleshooting = false) {
      if (!this.#div || !this.#trigger) return;

      this.#div.setAttribute("data-state", "error");
      this.#trigger.removeAttribute("disabled");

      this.animateLabel(label);

      if (this.#troubleshootLink) {
        if (showTroubleshooting) {
          this.#troubleshootLink.setAttribute("href", this.#troubleshootHref());
          this.#troubleshootLink.textContent = this.getI18nText(
            "troubleshooting-label",
            "Troubleshoot",
          );
          this.#troubleshootLink.hidden = false;
          this.#div.classList.add("has-troubleshoot");
        } else {
          this.#troubleshootLink.hidden = true;
          this.#div.classList.remove("has-troubleshoot");
        }
      }
    }

    handleProgress(event) {
      if (!this.#trigger) return;

      const progressCircle = this.#trigger.querySelector(
        ".progress-ring-circle",
      );

      if (progressCircle) {
        const circumference = 2 * Math.PI * 14;
        const offset =
          circumference - (event.detail.progress / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
      }

      const wrapper = this.#trigger.querySelector(".label-wrapper");
      if (wrapper) {
        const activeLabel = wrapper.querySelector(".label.active");
        if (activeLabel) {
          activeLabel.textContent = `${this.getI18nText("verifying-label", "Verifying...")}`;
        }
      }

      this.executeAttributeCode("onprogress", event);
    }

    handleSolve(event) {
      this.updateUI(
        "done",
        this.getI18nText("solved-label", "You're a human"),
        true,
      );
      this.executeAttributeCode("onsolve", event);
      this.#internals?.setValidity?.({});
      this.#div?.classList.remove("invalid");
    }

    #troubleshootHref(extra = {}) {
      const base =
        this.getAttribute("data-cap-troubleshooting-url") ||
        "https://trycap.dev/guide/troubleshooting/instrumentation.html";
      if (this.hasAttribute("data-cap-troubleshooting-url")) return base;
      const attrs = {};
      for (const a of this.attributes) {
        if (a.name.startsWith("data-cap-") || a.name === "id" || a.name === "class") {
          attrs[a.name] = a.value.slice(0, 200);
        }
      }
      let endpoint = this.getAttribute("data-cap-api-endpoint") || "";
      try {
        endpoint = new URL(endpoint, location.href).href;
      } catch {}
      const nav = navigator;
      const info = {
        v: WIDGET_VERSION,
        from: location.href,
        title: document.title.slice(0, 200),
        referrer: document.referrer,
        endpoint,
        attrs,
        server: this.#lastServerFailure,
        solveMs: this.#solveStartedAt ? Date.now() - this.#solveStartedAt : null,
        at: new Date().toISOString(),
        framed: window.top !== window,
        customFetch: typeof window.CAP_CUSTOM_FETCH === "function",
        isolate: !!window.CAP_ISOLATE,
        nonce: !!window.CAP_SCRIPT_NONCE,
        pageLang: document.documentElement.lang || null,
        ua: nav.userAgent,
        languages: nav.languages,
        webdriver: nav.webdriver,
        cores: nav.hardwareConcurrency,
        memory: nav.deviceMemory ?? null,
        screen: [screen.width, screen.height, devicePixelRatio],
        viewport: [innerWidth, innerHeight],
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...extra,
      };
      try {
        let json = JSON.stringify(info);
        if (json.length > 6000) {
          info.from = info.from.slice(0, 2000);
          info.referrer = info.referrer.slice(0, 1000);
          json = JSON.stringify(info).slice(0, 6000);
        }
        const bytes = new TextEncoder().encode(json);
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        const encoded = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        return `${base}#r=${encoded}`;
      } catch {
        return base;
      }
    }

    handleError(event) {
      this.updateUI(
        "error",
        this.getI18nText("error-label", "Error. Try again."),
      );
      if (
        event?.detail?.code === "invalid_solution" &&
        this.#lastServerFailure?.reason &&
        this.#troubleshootLink
      ) {
        this.#troubleshootLink.setAttribute(
          "href",
          this.#troubleshootHref({ code: event.detail.code, message: event.detail.message }),
        );
        this.#troubleshootLink.textContent = this.getI18nText(
          "troubleshooting-label",
          "Troubleshoot",
        );
        this.#troubleshootLink.hidden = false;
        this.#div?.classList.add("has-troubleshoot");
      }
      this.executeAttributeCode("onerror", event);

      if (this.#hasHaptics) navigator.vibrate([10, 40, 10]);
    }

    handleReset(event) {
      this.updateUI("", this.getI18nText("initial-state", "I'm a human"));
      this.executeAttributeCode("onreset", event);
      this.#updateValidity();
    }

    executeAttributeCode(attributeName, event) {
      const code = this.getAttribute(attributeName);
      if (!code) {
        return;
      }

      log.warn(
        T(),
        "inline `onxxx='…'` handlers are deprecated. use `addEventListener` callbacks instead.",
      );

      new Function("event", code).call(this, event);
    }

    error(message = "Unknown error", code = "unknown") {
      log.error(T("solve"), `[${code}] ${message}`);
      this.dispatchEvent("error", { isCap: true, code, message });
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
      if (this.#speculativeTimer) {
        clearTimeout(this.#speculativeTimer);
        this.#speculativeTimer = null;
      }
      if (this.#speculative) this.#resetSpeculativeState();
      this.token = null;
      this.dispatchEvent("reset");
      this.#setToken("");
    }

    get tokenValue() {
      return this.token;
    }

    disconnectedCallback() {
      this.#abort?.abort();
      document.removeEventListener("visibilitychange", this.#handleVisibility);
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

      this.#detachInteractionListeners();
      if (this.#speculativeTimer) {
        clearTimeout(this.#speculativeTimer);
        this.#speculativeTimer = null;
      }
      if (this.#speculativePool) {
        this.#speculativePool.terminate();
        this.#speculativePool = null;
      }
      if (this.#speculative) {
        this.#dropChallenge(this.#speculative);
        this.#speculative.state = "error";
        this.#speculative.notify();
        this.#speculative = null;
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

      if (!el && !widget.hasAttribute("data-cap-disable-haptics")) {
        widget.setAttribute("data-cap-disable-haptics", "");
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
    log.warn(
      T(),
      "cap-widget custom element already defined, skipping re-define. set window.CAP_DONT_SKIP_REDEFINE = true to override",
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
