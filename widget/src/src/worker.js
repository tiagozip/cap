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

  if (typeof WebAssembly !== "object" || typeof WebAssembly?.instantiate !== "function") {
    console.warn(
      "[cap worker] wasm not supported, falling back to alternative solver. this will be significantly slower.",
    );

    self.onmessage = async ({ data: { salt, target } }) => {
      return solveFallback({ salt, target });
    };

    return;
  }

  let solve_pow_function = null;

  const initFromModule = (wasmModule) => {
    try {
      let wasm;
      let WASM_VECTOR_LEN = 0;
      let cachedUint8ArrayMemory = null;

      const getMemory = () => {
        if (cachedUint8ArrayMemory === null || cachedUint8ArrayMemory.byteLength === 0) {
          cachedUint8ArrayMemory = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory;
      };

      const encoder = new TextEncoder();

      const passStringToWasm = (str, malloc, realloc) => {
        if (realloc === undefined) {
          const encoded = encoder.encode(str);
          const ptr = malloc(encoded.length, 1) >>> 0;
          getMemory()
            .subarray(ptr, ptr + encoded.length)
            .set(encoded);
          WASM_VECTOR_LEN = encoded.length;
          return ptr;
        }

        let len = str.length;
        let ptr = malloc(len, 1) >>> 0;
        const mem = getMemory();
        let offset = 0;

        for (; offset < len; offset++) {
          const code = str.charCodeAt(offset);
          if (code > 127) break;
          mem[ptr + offset] = code;
        }

        if (offset !== len) {
          if (offset !== 0) str = str.slice(offset);
          ptr = realloc(ptr, len, (len = offset + str.length * 3), 1) >>> 0;
          const subarray = getMemory().subarray(ptr + offset, ptr + len);
          const { written } = encoder.encodeInto(str, subarray);
          offset += written;
          ptr = realloc(ptr, len, offset, 1) >>> 0;
        }

        WASM_VECTOR_LEN = offset;
        return ptr;
      };

      const imports = { wbg: {} };
      imports.wbg.__wbindgen_init_externref_table = () => {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
      };

      const instance = new WebAssembly.Instance(wasmModule, imports);
      wasm = instance.exports;
      
      if (wasm.__wbindgen_start) wasm.__wbindgen_start();

      solve_pow_function = (salt, target) => {
        const saltPtr = passStringToWasm(salt, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const saltLen = WASM_VECTOR_LEN;
        const targetPtr = passStringToWasm(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const targetLen = WASM_VECTOR_LEN;
        return BigInt.asUintN(64, wasm.solve_pow(saltPtr, saltLen, targetPtr, targetLen));
      };

      return true;
    } catch (e) {
      console.error("[cap worker] failed to init wasm from module:", e);
      return false;
    }
  };

  self.onmessage = async ({ data: { salt, target, wasmModule } }) => {
    if (wasmModule instanceof WebAssembly.Module && solve_pow_function === null) {
      const ok = initFromModule(wasmModule);
      if (!ok) {
        console.warn("[cap worker] wasm init failed, falling back to JS solver.");
        return solveFallback({ salt, target });
      }
    }

    if (solve_pow_function === null) {
      console.warn("[cap worker] no wasm module provided, falling back to JS solver.");
      return solveFallback({ salt, target });
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
