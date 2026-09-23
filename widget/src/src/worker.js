(() => {
  const wlog = (method, ...args) => {
    if (!self.CAP_SILENT) console[method]("[cap worker]", ...args);
  };

  const HASHWX_CLOCK_EVERY = 256;
  const HASHWX_YIELD_MS = 16;
  const HASHWX_PROGRESS_MS = 150;
  let stopRequested = false;
  const yieldChannel = typeof MessageChannel === "function" ? new MessageChannel() : null;
  const macrotask = () =>
    new Promise((resolve) => {
      if (!yieldChannel) return setTimeout(resolve, 0);
      yieldChannel.port1.onmessage = () => resolve();
      yieldChannel.port2.postMessage(0);
    });

  const solveFallback = async ({ salt, target }) => {
    let nonce = 0;
    const batchSize = 50000;
    const encoder = new TextEncoder();

    const targetBits = target.length * 4;
    const fullBytes = Math.floor(targetBits / 8);
    const remainingBits = targetBits % 8;

    const paddedTarget = target.length % 2 === 0 ? target : `${target}0`;
    const targetBytesLength = paddedTarget.length / 2;
    const targetBytes = new Uint8Array(targetBytesLength);
    for (let k = 0; k < targetBytesLength; k++) {
      targetBytes[k] = parseInt(paddedTarget.substring(k * 2, k * 2 + 2), 16);
    }

    const partialMask = remainingBits > 0 ? (0xff << (8 - remainingBits)) & 0xff : 0;

    while (true) {
      try {
        for (let i = 0; i < batchSize; i++) {
          const inputString = salt + nonce;
          const inputBytes = encoder.encode(inputString);

          const hashBuffer = await crypto.subtle.digest("SHA-256", inputBytes);

          const hashBytes = new Uint8Array(hashBuffer);

          let matches = true;

          for (let k = 0; k < fullBytes; k++) {
            if (hashBytes[k] !== targetBytes[k]) {
              matches = false;
              break;
            }
          }

          if (matches && remainingBits > 0) {
            if ((hashBytes[fullBytes] & partialMask) !== (targetBytes[fullBytes] & partialMask)) {
              matches = false;
            }
          }

          if (matches) {
            self.postMessage({ nonce, found: true });
            return;
          }

          nonce++;
        }
      } catch (error) {
        wlog("error","fallback solver crashed:", error.message || error);
        self.postMessage({
          found: false,
          error: error.message,
        });
        return;
      }
    }
  };

  const solveRsw = (data) => {
    const N = BigInt(`0x${data.N}`);
    let y = BigInt(`0x${data.x}`);
    const t = data.t | 0;
    const chunk = Math.max(64, Math.floor(t / 50));
    const t0 = performance.now();
    for (let i = 0; i < t; i += chunk) {
      const end = Math.min(t, i + chunk);
      for (let j = i; j < end; j++) y = (y * y) % N;
      if (end < t) self.postMessage({ progress: end / t });
    }
    self.postMessage({
      found: true,
      y: y.toString(16),
      durationMs: (performance.now() - t0).toFixed(2),
    });
  };

  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const sha256Into = (bytes, out) => {
    const len = bytes.length;
    const blocks = ((len + 8) >> 6) + 1;
    const padded = new Uint8Array(blocks << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    const bitLen = len * 8;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0, false);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let b = 0; b < blocks; b++) {
      const off = b << 6;
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + (i << 2), false);
      for (let i = 16; i < 64; i++) {
        const x = w[i - 15], y = w[i - 2];
        const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & bb) ^ (a & c) ^ (bb & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + bb) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    const odv = new DataView(out.buffer, out.byteOffset, 32);
    odv.setUint32(0, h0, false); odv.setUint32(4, h1, false);
    odv.setUint32(8, h2, false); odv.setUint32(12, h3, false);
    odv.setUint32(16, h4, false); odv.setUint32(20, h5, false);
    odv.setUint32(24, h6, false); odv.setUint32(28, h7, false);
  };

  let hashwxRuntime = null;

  const getHashwxRuntime = (hashwxModule) => {
    if (hashwxRuntime) return hashwxRuntime;

    const instance = new WebAssembly.Instance(hashwxModule, {});
    const w = instance.exports;
    if (w._initialize) w._initialize();

    let compiled = true;
    let ctx = w.hashwx_alloc(1);
    if (ctx === -1 || ctx === 0) {
      compiled = false;
      ctx = w.hashwx_alloc(0);
    }
    if (ctx <= 0) throw new Error("hashwx_alloc failed");

    hashwxRuntime = {
      w,
      ctx,
      compiled,
      seedPtr: w.hashwx_seed(ctx),
      regPtr: compiled ? w.hashwx_registers(ctx) : 0,
      memPtr: compiled ? w.hashwx_memory(ctx) : 0,
    };
    return hashwxRuntime;
  };

  const solveHashwx = async (data) => {
    const { c, d, n, workerIndex, workerCount, hashwxModule } = data;
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(d) || d < 1) {
      throw new Error("malformed hashwx challenge payload");
    }
    const noncesPerHash = n >>> 0;
    const target = ((1n << 64n) - 1n) / BigInt(d);
    stopRequested = false;

    const { w, ctx, compiled, seedPtr, regPtr, memPtr } =
      getHashwxRuntime(hashwxModule);

    const challenge = new Uint8Array(32);
    for (let i = 0; i < 32; i++) challenge[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
    const seedInput = new Uint8Array(40);
    seedInput.set(challenge, 0);
    const seedOut = new Uint8Array(32);

    const t0 = performance.now();
    let hashes = 0;
    let lastYield = t0;
    let lastReport = t0;

    try {
      for (let block = workerIndex; ; block += workerCount) {
        let rest = block;
        for (let i = 0; i < 8; i++) { seedInput[32 + i] = rest & 0xff; rest = Math.floor(rest / 256); }
        sha256Into(seedInput, seedOut);
        new Uint8Array(w.memory.buffer, seedPtr, 32).set(seedOut);
        w.hashwx_make(ctx, seedPtr);

        let side = null;
        if (compiled) {
          const codePtr = w.hashwx_module(ctx);
          const codeSize = w.hashwx_module_size(ctx);
          const bytes = new Uint8Array(w.memory.buffer, codePtr, codeSize).slice();
          side = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
            env: { memory: w.memory },
          }).exports.exec;
        }

        const base = BigInt(block) * BigInt(noncesPerHash);
        for (let k = 0; k < noncesPerHash; k++) {
          const nonce = base + BigInt(k);
          let hash;
          if (compiled) {
            w.hashwx_exec_begin(ctx, nonce);
            side(regPtr, memPtr);
            hash = BigInt.asUintN(64, w.hashwx_exec_final(ctx));
          } else {
            hash = BigInt.asUintN(64, w.hashwx_exec(ctx, nonce));
          }
          hashes++;
          if (hash <= target) {
            self.postMessage({
              found: true,
              nonce: nonce.toString(),
              hashes,
              compiled,
              durationMs: (performance.now() - t0).toFixed(2),
            });
            return;
          }
          if ((hashes & (HASHWX_CLOCK_EVERY - 1)) === 0) {
            const now = performance.now();
            if (now - lastYield >= HASHWX_YIELD_MS) {
              if (now - lastReport >= HASHWX_PROGRESS_MS) {
                lastReport = now;
                self.postMessage({ progress: hashes });
              }
              await macrotask();
              lastYield = performance.now();
              if (stopRequested) {
                return self.postMessage({ found: false, error: "stopped" });
              }
            }
          }
        }
      }
    } catch (error) {
      hashwxRuntime = null;
      throw error;
    }
  };

  if (typeof WebAssembly !== "object" || typeof WebAssembly?.instantiate !== "function") {
    wlog("warn","WebAssembly unavailable, using JS fallback solver (significantly slower)");

    self.onmessage = async ({ data }) => {
      if (data?.kind === "stop") {
        stopRequested = true;
        return;
      }
      if (data?.kind === "rsw") return solveRsw(data);
      if (data?.kind === "hashwx") {
        return self.postMessage({
          found: false,
          error: "hashwx requires WebAssembly",
        });
      }
      return solveFallback({ salt: data.salt, target: data.target });
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
          const newLen = offset + str.length * 3;
          ptr = realloc(ptr, len, newLen, 1) >>> 0;
          len = newLen;
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
      wlog("error","wasm init failed:", e.message || e);
      return false;
    }
  };

  self.onmessage = async ({ data }) => {
    if (data?.kind === "stop") {
      stopRequested = true;
      return;
    }
    if (data?.kind === "rsw") return solveRsw(data);
    if (data?.kind === "hashwx") {
      try {
        return await solveHashwx(data);
      } catch (error) {
        wlog("error", "hashwx solver threw:", error.message || error);
        return self.postMessage({ found: false, error: error.message || String(error) });
      }
    }
    const { salt, target, wasmModule } = data;
    if (wasmModule instanceof WebAssembly.Module && solve_pow_function === null) {
      const ok = initFromModule(wasmModule);
      if (!ok) {
        wlog("warn","wasm init failed, falling back to JS solver");
        return solveFallback({ salt, target });
      }
    }

    if (solve_pow_function === null) {
      wlog("warn","no wasm module provided, falling back to JS solver");
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
      wlog("error","solve_pow threw:", error.message || error);

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
