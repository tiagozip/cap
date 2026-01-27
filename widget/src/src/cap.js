(() => {
	const WASM_VERSION = "0.0.6";

	if (typeof window === "undefined") {
    return;
  }

	const capFetch = (...args) => {
		if (window?.CAP_CUSTOM_FETCH) {
			return window.CAP_CUSTOM_FETCH(...args);
		}
		return fetch(...args);
	};

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
				// this placeholder will be replaced with the actual worker by the build script

				new Blob([`%%workerScript%%`], {
					type: "application/javascript",
				}),
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
				this.setWorkersCount(parseInt(value, 10));
			}

			if (
				name === "data-cap-i18n-initial-state" &&
				this.#div &&
				this.#div?.querySelector("p")?.innerText
			) {
				this.#div.querySelector("p").innerText = this.getI18nText(
					"initial-state",
					"I'm a human",
				);
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
					true,
				);

				this.#div.setAttribute(
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
					} else if (!apiEndpoint)
						throw new Error(
							"Missing API endpoint. Either custom fetch or an API endpoint must be provided.",
						);

					if (!apiEndpoint.endsWith("/")) {
            apiEndpoint += "/";
          }

					const { challenge, token } = await (
						await capFetch(`${apiEndpoint}challenge`, {
							method: "POST",
						})
					).json();

					let challenges = challenge;

					if (!Array.isArray(challenges)) {
						let i = 0;

						challenges = Array.from({ length: challenge.c }, () => {
							i = i + 1;

							return [
								prng(`${token}${i}`, challenge.s),
								prng(`${token}${i}d`, challenge.d),
							];
						});
					}

					const solutions = await this.solveChallenges(challenges);

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
						this.getI18nText(
							"error-aria-label",
							"An error occurred, please try again",
						),
					);
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

					worker.onmessage = ({ data }) => {
						if (!data.found) return;

						completed++;
						this.dispatchEvent("progress", {
							progress: Math.round((completed / total) * 100),
						});

						resolve(data.nonce);
					};

					worker.onerror = (err) => {
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

					if (
						typeof WebAssembly !== "object" ||
						typeof WebAssembly?.instantiate !== "function"
					) {
						if (this.#shadow.querySelector(".warning")) return;
						const warningEl = document.createElement("div");
						warningEl.className = "warning";
						warningEl.style.cssText = `width: var(--cap-widget-width, 230px);background: rgb(237, 56, 46);color: white;padding: 4px 6px;padding-bottom: calc(var(--cap-border-radius, 14px) + 5px);font-size: 10px;box-sizing: border-box;font-family: system-ui;border-top-left-radius: 8px;border-top-right-radius: 8px;text-align: center;padding-bottom:calc(var(--cap-border-radius,14px) + 5px);user-select:none;margin-bottom: -35.5px;opacity: 0;transition: margin-bottom .3s,opacity .3s;`;
						warningEl.innerText =
							this.getI18nText("wasm-disabled", "Enable WASM for significantly faster solving");
						this.#shadow.insertBefore(warningEl, this.#shadow.firstChild);

						setTimeout(() => {
							warningEl.style.marginBottom = `calc(-1 * var(--cap-border-radius, 14px))`
							warningEl.style.opacity = 1;
						}, 10);
					}
				});

			const results = [];
			try {
				for (let i = 0; i < challenge.length; i += this.#workersCount) {
					const chunk = challenge.slice(
						i,
						Math.min(i + this.#workersCount, challenge.length),
					);
					const chunkResults = await Promise.all(
						chunk.map((c, idx) => solveSingleChallenge(c, idx)),
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
				!Number.isNaN(parsedWorkers) &&
				parsedWorkers > 0 &&
				parsedWorkers <= maxWorkers
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
			this.#div.innerHTML = `<div class="checkbox" part="checkbox"><svg class="progress-ring" viewBox="0 0 32 32"><circle class="progress-ring-bg" cx="16" cy="16" r="14"></circle><circle class="progress-ring-circle" cx="16" cy="16" r="14"></circle></svg></div><p part="label">${this.getI18nText(
				"initial-state",
				"I'm a human",
			)}</p><a part="attribution" aria-label="Secured by Cap" href="https://capjs.js.org/" class="credits" target="_blank" rel="follow noopener">Cap</a>`;

			this.#shadow.innerHTML = `<style${window.CAP_CSS_NONCE ? ` nonce=${window.CAP_CSS_NONCE}` : ""}>.captcha,.captcha * {box-sizing:border-box;}.captcha{background-color:var(--cap-background,#fdfdfd);border:1px solid var(--cap-border-color,#dddddd8f);border-radius:var(--cap-border-radius,14px);user-select:none;height:var(--cap-widget-height, 58px);width:var(--cap-widget-width, 230px);display:flex;align-items:center;padding:var(--cap-widget-padding,14px);gap:var(--cap-gap,15px);cursor:pointer;transition:filter .2s,transform .2s;position:relative;-webkit-tap-highlight-color:rgba(255,255,255,0);overflow:hidden;color:var(--cap-color,#212121)}.captcha:hover{filter:brightness(98%)}.checkbox{width:var(--cap-checkbox-size,25px);height:var(--cap-checkbox-size,25px);border:var(--cap-checkbox-border,1px solid #aaaaaad1);border-radius:var(--cap-checkbox-border-radius,6px);background-color:var(--cap-checkbox-background,#fafafa91);transition:opacity .2s;margin-top:var(--cap-checkbox-margin,2px);margin-bottom:var(--cap-checkbox-margin,2px)}.captcha *{font-family:var(--cap-font,system,-apple-system,"BlinkMacSystemFont",".SFNSText-Regular","San Francisco","Roboto","Segoe UI","Helvetica Neue","Lucida Grande","Ubuntu","arial",sans-serif)}.captcha p{margin:0;font-weight:500;font-size:15px;user-select:none;transition:opacity .2s}.checkbox .progress-ring{display:none;width:100%;height:100%;transform:rotate(-90deg)}.checkbox .progress-ring-bg{fill:none;stroke:var(--cap-spinner-background-color,#eee);stroke-width:var(--cap-spinner-thickness,3)}.checkbox .progress-ring-circle{fill:none;stroke:var(--cap-spinner-color,#000);stroke-width:var(--cap-spinner-thickness,3);stroke-linecap:round;stroke-dasharray:87.96;stroke-dashoffset:87.96;transition:stroke-dashoffset 0.3s ease}.captcha[data-state=verifying] .checkbox{background:none;display:flex;align-items:center;justify-content:center;transform:scale(1.1);border:none;border-radius:50%;background-color:transparent}.captcha[data-state=verifying] .checkbox .progress-ring{display:block}.captcha[data-state=done] .checkbox{border:1px solid transparent;background-image:var(--cap-checkmark,url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cstyle%3E%40keyframes%20anim%7B0%25%7Bstroke-dashoffset%3A23.21320343017578px%7Dto%7Bstroke-dashoffset%3A0%7D%7D%3C%2Fstyle%3E%3Cpath%20fill%3D%22none%22%20stroke%3D%22%2300a67d%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22m5%2012%205%205L20%207%22%20style%3D%22stroke-dashoffset%3A0%3Bstroke-dasharray%3A23.21320343017578px%3Banimation%3Aanim%20.5s%20ease%22%2F%3E%3C%2Fsvg%3E"));background-size:cover}.captcha[data-state=done] .checkbox .progress-ring{display:none}.captcha[data-state=error] .checkbox{border:1px solid transparent;background-image:var(--cap-error-cross,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 24 24'%3E%3Cpath fill='%23f55b50' d='M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8'/%3E%3C/svg%3E"));background-size:cover}.captcha[data-state=error] .checkbox .progress-ring{display:none}.captcha[disabled]{cursor:not-allowed}.captcha[disabled][data-state=verifying]{cursor:progress}.captcha[disabled][data-state=done]{cursor:default}.captcha .credits{position:absolute;bottom:10px;right:10px;font-size:12px;color:var(--cap-color,#212121);opacity:0.8;text-underline-offset: 1.5px;}</style>`;

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
					e.stopPropagation();
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
			const progressCircle = this.#div.querySelector(".progress-ring-circle");

			if (progressElement && progressCircle) {
				const circumference = 2 * Math.PI * 14;
				const offset = circumference - (event.detail.progress / 100) * circumference;
				progressCircle.style.strokeDashoffset = offset;
				progressElement.innerText = `${this.getI18nText(
					"verifying-label",
					"Verifying...",
				)} ${event.detail.progress}%`;
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
		}

		handleError(event) {
			this.updateUI(
				"error",
				this.getI18nText("error-label", "Error. Try again."),
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
	} else {
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
