// Cloudflare Workers forbid WebAssembly.compile at runtime, so wasm has to be
// imported as a precompiled module. Wrangler resolves this file through the
// "workerd" condition on the "#hashwx-module" import in package.json.
import hashwxModule from "./hashwx.wasm";

export default hashwxModule;
