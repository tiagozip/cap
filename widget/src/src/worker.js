(() => {
	const solveFallback = async ({ salt, target }) => {
		let nonce = 0;
		const batchSize = 50000;
		const encoder = new TextEncoder();

		const targetBytes = new Uint8Array(target.length / 2);
		for (let k = 0; k < targetBytes.length; k++) {
			targetBytes[k] = parseInt(target.substring(k * 2, k * 2 + 2), 16);
		}
		const targetBytesLength = targetBytes.length;

		while (true) {
			try {
				for (let i = 0; i < batchSize; i++) {
					const inputString = salt + nonce;
					const inputBytes = encoder.encode(inputString);

					const hashBuffer = await crypto.subtle.digest("SHA-256", inputBytes);

					const hashBytes = new Uint8Array(hashBuffer, 0, targetBytesLength);

					let matches = true;
					for (let k = 0; k < targetBytesLength; k++) {
						if (hashBytes[k] !== targetBytes[k]) {
							matches = false;
							break;
						}
					}

					if (matches) {
						self.postMessage({ nonce, found: true });
						return;
					}

					nonce++;
				}
			} catch (error) {
				console.error("[cap worker]", error);
				self.postMessage({
					found: false,
					error: error.message,
				});
				return;
			}
		}
	};

	if (
		typeof WebAssembly !== "object" ||
		typeof WebAssembly?.instantiate !== "function"
	) {
		console.warn(
			"[cap worker] wasm not supported, falling back to alternative solver. this will be significantly slower.",
		);

		self.onmessage = async ({ data: { salt, target } }) => {
			return solveFallback({ salt, target });
		};

		return;
	}

	let wasmCacheUrl, solve_pow_function;

	self.onmessage = async ({ data: { salt, target, wasmUrl } }) => {
		let fb;

		if (wasmCacheUrl !== wasmUrl) {
			wasmCacheUrl = wasmUrl;
			await import(wasmUrl)
				.then((wasmModule) => {
					return wasmModule.default().then((instance) => {
						solve_pow_function = (
							instance?.exports ? instance.exports : wasmModule
						).solve_pow;
					});
				})
				.catch((e) => {
					console.error("[cap worker] using fallback solver due to error:", e);
					fb = true;

					return solveFallback({ salt, target });
				});

			if (fb) return;
		}

		try {
			const startTime = performance.now();
			const nonce = solve_pow_function(salt, target);
			const endTime = performance.now();

			self.postMessage({
				nonce: Number(nonce),
				found: true,
				durationMs: (endTime - startTime).toFixed(2),
			});
		} catch (error) {
			console.error("[cap worker]", error);
			
			self.postMessage({
				found: false,
				error: error.message || String(error),
			});
		}
	};

	self.onerror = (error) => {
		self.postMessage({
			found: false,
			error,
		});
	};
})();
