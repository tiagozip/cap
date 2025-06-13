(function () {
  const WASM_VERSION = "0.0.5";

  const capFetch = function () {
    if (window?.CAP_CUSTOM_FETCH) {
      return window.CAP_CUSTOM_FETCH(...arguments);
    }
    return fetch(...arguments);
  };

  if (!window.CAP_CUSTOM_WASM_URL) {
    // preloads the wasm files to save up time on solve
    [
      `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm.min.js`,
      `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`,
    ].forEach((url) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = url.endsWith(".wasm") ? "fetch" : "script";
      document.head.appendChild(link);
    });
  }

  class CapWidget extends HTMLElement {
    #workerUrl = "";
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
        "[cap]",
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
      this.#workerUrl = URL.createObjectURL(
        // MARK: worker injection
        // this placeholder will be replaced with the actual worker by the build script

        new Blob([`%%workerScript%%`], {
          type: "application/javascript",
        })
      );
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
        this.setWorkersCount(parseInt(value));
      }

      if (
        name === "data-cap-i18n-initial-state" &&
        this.#div &&
        this.#div?.querySelector("p")?.innerText
      ) {
        this.#div.querySelector("p").innerText = this.getI18nText(
          "initial-state",
          "I'm a human"
        );
      }
    }

    async connectedCallback() {
      this.#host = this;
      this.#shadow = this.attachShadow({ mode: "open" });
      this.#div = document.createElement("div");
      this.createUI();
      this.addEventListeners();
      await this.initialize();
      this.#div.removeAttribute("disabled");

      const workers = this.getAttribute("data-cap-worker-count");
      const parsedWorkers = workers ? parseInt(workers, 10) : null;
      this.setWorkersCount(parsedWorkers || navigator.hardwareConcurrency || 8);
      const fieldName =
        this.getAttribute("data-cap-hidden-field-name") || "cap-token";
      this.#host.innerHTML = `<input type="hidden" name="${fieldName}">`;
    }

    async solve() {
      if (this.#solving) {
        return;
      }

      try {
        this.#solving = true;
        this.updateUI(
          "verifying",
          this.getI18nText("verifying-label", "Verifying..."),
          true
        );

        this.dispatchEvent("progress", { progress: 0 });

        try {
          const apiEndpoint = this.getAttribute("data-cap-api-endpoint");
          if (!apiEndpoint) throw new Error("Missing API endpoint");

          const { challenge, token } = await (
            await capFetch(`${apiEndpoint}challenge`, {
              method: "POST",
            })
          ).json();
          const solutions = await this.solveChallenges(challenge);

          const resp = await (
            await capFetch(`${apiEndpoint}redeem`, {
              method: "POST",
              body: JSON.stringify({ token, solutions }),
              headers: { "Content-Type": "application/json" },
            })
          ).json();

          this.dispatchEvent("progress", { progress: 100 });

          if (!resp.success) throw new Error("Invalid solution");
          const fieldName =
            this.getAttribute("data-cap-hidden-field-name") || "cap-token";
          if (this.querySelector(`input[name='${fieldName}']`)) {
            this.querySelector(`input[name='${fieldName}']`).value = resp.token;
          }

          this.dispatchEvent("solve", { token: resp.token });
          this.token = resp.token;

          if (this.#resetTimer) clearTimeout(this.#resetTimer);
          const expiresIn = new Date(resp.expires).getTime() - Date.now();
          if (expiresIn > 0 && expiresIn < 24 * 60 * 60 * 1000) {
            this.#resetTimer = setTimeout(() => this.reset(), expiresIn);
          } else {
            this.error("Invalid expiration time");
          }

          return { success: true, token: this.token };
        } catch (err) {
          this.error(err.message);
          throw err;
        }
      } finally {
        this.#solving = false;
      }
    }

    async solveChallenges(challenge) {
      const total = challenge.length;
      let completed = 0;

      const workers = Array(this.#workersCount)
        .fill(null)
        .map(() => {
          try {
            return new Worker(this.#workerUrl);
          } catch (error) {
            console.error("[cap] Failed to create worker:", error);
            throw new Error("Worker creation failed");
          }
        });

      const solveSingleChallenge = ([salt, target], workerId) =>
        new Promise((resolve, reject) => {
          const worker = workers[workerId];
          if (!worker) {
            reject(new Error("Worker not available"));
            return;
          }

          const timeout = setTimeout(() => {
            try {
              worker.terminate();
              workers[workerId] = new Worker(this.#workerUrl);
            } catch (error) {
              console.error(
                "[cap] error terminating/recreating worker:",
                error
              );
            }
            reject(new Error("Worker timeout"));
          }, 30000);

          worker.onmessage = ({ data }) => {
            if (!data.found) return;
            clearTimeout(timeout);
            completed++;
            this.dispatchEvent("progress", {
              progress: Math.round((completed / total) * 100),
            });
            resolve([salt, target, data.nonce]);
          };

          worker.onerror = (err) => {
            clearTimeout(timeout);
            this.error(`Error in worker: ${err.message || err}`);
            reject(err);
          };

          worker.postMessage({
            salt,
            target,
            wasmUrl:
              window.CAP_CUSTOM_WASM_URL ||
              `https://cdn.jsdelivr.net/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm.min.js`,
          });
        });

      const results = [];
      try {
        for (let i = 0; i < challenge.length; i += this.#workersCount) {
          const chunk = challenge.slice(
            i,
            Math.min(i + this.#workersCount, challenge.length)
          );
          const chunkResults = await Promise.all(
            chunk.map((c, idx) => solveSingleChallenge(c, idx))
          );
          results.push(...chunkResults);
        }
      } finally {
        workers.forEach((w) => {
          if (w) {
            try {
              w.terminate();
            } catch (error) {
              console.error("[cap] error terminating worker:", error);
            }
          }
        });
      }

      return results;
    }

    setWorkersCount(workers) {
      const parsedWorkers = parseInt(workers, 10);
      const maxWorkers = Math.min(navigator.hardwareConcurrency || 8, 16);
      this.#workersCount =
        !isNaN(parsedWorkers) &&
        parsedWorkers > 0 &&
        parsedWorkers <= maxWorkers
          ? parsedWorkers
          : navigator.hardwareConcurrency || 8;
    }

    createUI() {
      this.#div.classList.add("captcha");
      this.#div.setAttribute("role", "button");
      this.#div.setAttribute("tabindex", "0");
      this.#div.setAttribute("disabled", "true");
      this.#div.innerHTML = `<div class="checkbox"></div><p>${this.getI18nText(
        "initial-state",
        "I'm a human"
      )}</p><a href="https://capjs.js.org/" class="credits" target="_blank" rel="follow noopener"><span>Secured by&nbsp;</span>Cap</a>`;

      this.#shadow.innerHTML = `<style>.captcha * {box-sizing:border-box;}.captcha{background-color:var(--cap-background,#fdfdfd);border:1px solid var(--cap-border-color,#dddddd8f);border-radius:var(--cap-border-radius,14px);
      user-select:none;height:var(--cap-widget-height, 30px);width:var(--cap-widget-width, 230px);display:flex;align-items:center;padding:var(--cap-widget-padding,14px);gap:var(--cap-gap,15px);cursor:pointer;transition:filter .2s,transform .2s;position:relative;-webkit-tap-highlight-color:rgba(255,255,255,0);overflow:hidden;color:var(--cap-color,#212121)}.captcha:hover{filter:brightness(98%)}.checkbox{width:var(--cap-checkbox-size,25px);height:var(--cap-checkbox-size,25px);border:var(--cap-checkbox-border,1px solid #aaaaaad1);border-radius:var(--cap-checkbox-border-radius,6px);background-color:var(--cap-checkbox-background,#fafafa91);transition:opacity .2s;margin-top:var(--cap-checkbox-margin,2px);margin-bottom:var(--cap-checkbox-margin,2px)}.captcha *{font-family:var(--cap-font,system,-apple-system,"BlinkMacSystemFont",".SFNSText-Regular","San Francisco","Roboto","Segoe UI","Helvetica Neue","Lucida Grande","Ubuntu","arial",sans-serif)}.captcha p{margin:0;font-weight:500;font-size:15px;user-select:none;transition:opacity .2s}.captcha[data-state=verifying]
.checkbox{background: none;display:flex;align-items:center;justify-content:center;transform: scale(1.1);border: none;border-radius: 50%;background: conic-gradient(var(--cap-spinner-color,#000) 0%, var(--cap-spinner-color,#000) var(--progress, 0%), var(--cap-spinner-background-color,#eee) var(--progress, 0%), var(--cap-spinner-background-color,#eee) 100%);position: relative;}.captcha[data-state=verifying] .checkbox::after {content: "";background-color: var(--cap-background,#fdfdfd);width: calc(100% - var(--cap-spinner-thickness,5px));height: calc(100% - var(--cap-spinner-thickness,5px));border-radius: 50%;margin:calc(var(--cap-spinner-thickness,5px) / 2)}.captcha[data-state=done] .checkbox{border:1px solid transparent;background-image:var(--cap-checkmark,url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cstyle%3E%40keyframes%20anim%7B0%25%7Bstroke-dashoffset%3A23.21320343017578px%7Dto%7Bstroke-dashoffset%3A0%7D%7D%3C%2Fstyle%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22%2300a67d%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m5%2012%205%205L20%207%22%20style%3D%22stroke-dashoffset%3A0%3Bstroke-dasharray%3A23.21320343017578px%3Banimation%3Aanim%20.5s%20ease%22%2F%3E%3C%2Fsvg%3E"));background-size:cover}.captcha[data-state=error] .checkbox{border:1px solid transparent;background-image:var(--cap-error-cross,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24'%3E%3Cpath fill='%23f55b50' d='M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8'/%3E%3C/svg%3E"));background-size:cover}.captcha[disabled]{cursor:not-allowed}.captcha[disabled][data-state=verifying]{cursor:progress}.captcha[disabled][data-state=done]{cursor:default}.captcha .credits{position:absolute;bottom:10px;right:10px;font-size:var(--cap-credits-font-size,12px);color:var(--cap-color,#212121);opacity:var(--cap-opacity-hover,0.8)}.captcha .credits span{display:none;text-decoration:underline}.captcha .credits:hover span{display:inline-block}</style>`;

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
        if (
          (e.key === "Enter" || e.key === " ") &&
          !this.#div.hasAttribute("disabled")
        ) {
          e.preventDefault();
          this.solve();
        }
      });

      this.addEventListener("progress", this.boundHandleProgress);
      this.addEventListener("solve", this.boundHandleSolve);
      this.addEventListener("error", this.boundHandleError);
      this.addEventListener("reset", this.boundHandleReset);
    }

    updateUI(state, text, disabled = false) {
      if (!this.#div) return;

      this.#div.setAttribute("data-state", state);

      this.#div.querySelector("p").innerText = text;

      if (disabled) {
        this.#div.setAttribute("disabled", "true");
      } else {
        this.#div.removeAttribute("disabled");
      }
    }

    handleProgress(event) {
      if (!this.#div) return;

      const progressElement = this.#div.querySelector("p");
      const checkboxElement = this.#div.querySelector(".checkbox");

      if (progressElement && checkboxElement) {
        checkboxElement.style.setProperty(
          "--progress",
          `${event.detail.progress}%`
        );
        progressElement.innerText = `${this.getI18nText(
          "verifying-label",
          "Verifying..."
        )} ${event.detail.progress}%`;
      }
      this.executeAttributeCode("onprogress", event);
    }

    handleSolve(event) {
      this.updateUI(
        "done",
        this.getI18nText("solved-label", "You're a human"),
        true
      );
      this.executeAttributeCode("onsolve", event);
    }

    handleError(event) {
      this.updateUI(
        "error",
        this.getI18nText("error-label", "Error. Try again.")
      );
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
      const fieldName =
        this.getAttribute("data-cap-hidden-field-name") || "cap-token";
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

      if (this.#workerUrl) {
        URL.revokeObjectURL(this.#workerUrl);
        this.#workerUrl = "";
      }
    }
  }

  // MARK: Invisible
  class Cap {
    constructor(config = {}, el) {
      let widget = el || document.createElement("cap-widget");

      Object.entries(config).forEach(([a, b]) => {
        widget.setAttribute(a, b);
      });

      if (config.apiEndpoint) {
        widget.setAttribute("data-cap-api-endpoint", config.apiEndpoint);
      } else {
        widget.remove();
        throw new Error("Missing API endpoint");
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
  } else {
    console.warn(
      "[cap] the cap-widget element has already been defined, skipping re-defining it.\nto prevent this, set window.CAP_DONT_SKIP_REDEFINE to true"
    );
  }

  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = Cap;
  } else if (typeof define === "function" && define.amd) {
    define([], function () {
      return Cap;
    });
  }

  if (typeof exports !== "undefined") {
    exports.default = Cap;
  }
})();
