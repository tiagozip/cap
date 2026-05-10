import { randomBytes, randomInt } from "node:crypto";
import { deflateRawSync } from "node:zlib";

let _obfuscator = null;
async function getObfuscator() {
  if (_obfuscator !== null) return _obfuscator;
  try {
    const mod = await import("javascript-obfuscator");
    _obfuscator = mod.default ?? mod;
  } catch {
    _obfuscator = false;
  }
  return _obfuscator;
}

let _esbuild = null;
async function getEsbuild() {
  if (_esbuild !== null) return _esbuild;
  try {
    _esbuild = await import("esbuild");
  } catch {
    _esbuild = false;
  }
  return _esbuild;
}

const STRING_LITERAL = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
function decodeJsString(quoted, body) {
  let safe = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      safe += c + body[++i];
    } else if (c === '"') {
      safe += '\\"';
    } else {
      safe += c;
    }
  }
  if (quoted === "'") safe = safe.replace(/\\'/g, "'");
  return JSON.parse(`"${safe}"`);
}

function customObfuscateStrings(script) {
  const matches = [...script.matchAll(STRING_LITERAL)];
  if (matches.length === 0) return script;
  const seen = new Map();
  const arr = [];
  for (const m of matches) {
    const value = decodeJsString(m[1], m[2]);
    if (!seen.has(value)) {
      seen.set(value, arr.length);
      arr.push(value);
    }
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const newIndex = new Map(arr.map((s, i) => [s, i]));
  const tName = `_T${randomBytes(3).toString("hex")}`;
  const out = script.replace(STRING_LITERAL, (_full, q, body) => {
    const value = decodeJsString(q, body);
    return `${tName}[${newIndex.get(value)}]`;
  });
  return `var ${tName}=${JSON.stringify(arr)};${out}`;
}

const rHex = (len = 16) => randomBytes(len).toString("hex").slice(0, len);

const fastRnd = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
const VAR_LETTERS = "abcdefghijklmnopqrstuvwxyz";
const VAR_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const rVar = (len) => {
  if (!len) len = ((Math.random() * 7) | 0) + 4;
  let s = VAR_LETTERS[(Math.random() * 26) | 0];
  for (let i = 1; i < len; i++) s += VAR_CHARS[(Math.random() * 36) | 0];
  return s;
};
const toInt32 = (n) => n | 0;

function domSumMock(x, y, z) {
  const root = { isRoot: true };

  function buildChain(parent, val) {
    let cur = parent;
    let v = val;
    for (let i = 0; i < 8; i++) {
      const child = { parentNode: cur, innerText: String(v) };
      if ((v & 1) === 0) cur = child;
      v = v >> 1;
    }
    return cur;
  }

  function walk(node, rootRef, sum) {
    if (!node || node === rootRef) return sum % 256;
    return walk(node.parentNode, rootRef, sum + parseInt(node.innerText, 10));
  }

  return toInt32(
    walk(buildChain(buildChain(buildChain(root, x), y), z), root, 0),
  );
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const WINDOW_PROP_MARKERS = [
  "_Selenium_IDE_Recorder",
  "_selenium",
  "calledSelenium",
  "__webdriverFunc",
  "__lastWatirAlert",
  "__lastWatirConfirm",
  "__lastWatirPrompt",
  "_WEBDRIVER_ELEM_CACHE",
  "ChromeDriverw",
  "awesomium",
  "CefSharp",
  "RunPerfTest",
  "fmget_targets",
  "geb",
  "spawn",
  "domAutomation",
  "domAutomationController",
  "wdioElectron",
  "callPhantom",
  "_phantom",
  "__nightmare",
  "nightmare",
  "__playwright__binding__",
  "__pwInitScripts",
];
const DOC_PROP_MARKERS = [
  "__selenium_evaluate",
  "selenium-evaluate",
  "__selenium_unwrapped",
  "__webdriver_script_fn",
  "__driver_evaluate",
  "__webdriver_evaluate",
  "__fxdriver_evaluate",
  "__driver_unwrapped",
  "__webdriver_unwrapped",
  "__fxdriver_unwrapped",
  "__webdriver_script_func",
  "__webdriver_script_function",
];
const ATTR_SUBSTRING_MARKERS = ["selenium", "webdriver", "driver"];
const STACK_SUBSTRING_MARKERS = ["pptr:", "UtilityScript.", "PhantomJS"];
const WINDOW_PREFIX_MARKERS = ["puppeteer_", "cdc_", "$cdc_"];
const UA_TOKEN_MARKERS = [
  "HeadlessChrome",
  "PhantomJS",
  "SlimerJS",
  "headless",
];
const WEBGL_VENDOR_MARKER = "Brian Paul";
const WEBGL_RENDERER_MARKER = "Mesa OffScreen";
const PRODUCTSUB_GECKO = "20030107";
const SEQUENTUM_MARKER = "Sequentum";

function hashWith(seed) {
  return (s) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  };
}

function buildBlockChecks(b, id, hF, hSet, h) {
  const winHashes = WINDOW_PROP_MARKERS.map(h);
  const docHashes = DOC_PROP_MARKERS.map(h);
  const attrSubHashes = ATTR_SUBSTRING_MARKERS.map(h);
  const stackSubHashes = STACK_SUBSTRING_MARKERS.map(h);
  const winPrefixHashes = WINDOW_PREFIX_MARKERS.map(h);
  const uaTokHashes = UA_TOKEN_MARKERS.map(h);
  const webglVendorHash = h(WEBGL_VENDOR_MARKER);
  const webglRendererHash = h(WEBGL_RENDERER_MARKER);
  const productSubGeckoHash = h(PRODUCTSUB_GECKO);
  const sequentumHash = h(SEQUENTUM_MARKER);
  
  const checks = [];

  checks.push(
    `if (!${b}) { try { var d = Object.getOwnPropertyDescriptors(navigator); var __wh = ${h("webdriver")}; for (const k in d) { if (${hF}(k) === __wh) { ${b} = true; break; } } if (!${b}) { var p = Object.getPrototypeOf(navigator); while (p && !${b}) { for (const k of Object.getOwnPropertyNames(p)) { if (${hF}(k) === __wh) { try { if (navigator[k]) ${b} = true; } catch {} break; } } p = Object.getPrototypeOf(p); } } } catch { ${b} = true; } }`,
  );

  checks.push(
    `if (!${b} && Object.getOwnPropertyNames(navigator).length !== 0) ${b} = true;`,
  );

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ${JSON.stringify(winPrefixHashes)}; for (const k of Object.getOwnPropertyNames(window)) { for (var pl = 4; pl <= 5; pl++) { if (${hSet}(${a}, ${hF}(k.slice(0, pl)))) { ${b} = true; break; } } if (${b}) break; } }`,
    );
  }

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ${JSON.stringify(winHashes)}; for (const k of Object.getOwnPropertyNames(window)) { if (${hSet}(${a}, ${hF}(k))) { ${b} = true; break; } } }`,
    );
  }

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ${JSON.stringify(docHashes)}; for (const k of Object.getOwnPropertyNames(document)) { if (${hSet}(${a}, ${hF}(k))) { ${b} = true; break; } } }`,
    );
  }

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { try { var ${a} = ${JSON.stringify(attrSubHashes)}; var an = document.documentElement.getAttributeNames(); for (const n of an) { for (const t of n.split(/[^a-z]+/i)) { if (t && ${hSet}(${a}, ${hF}(t.toLowerCase()))) { ${b} = true; break; } } if (${b}) break; } } catch { ${b} = true; } }`,
    );
  }

  {
    const a = rVar(),
      st = rVar();
    checks.push(
      `if (!${b}) { try { var ${a} = ${JSON.stringify(stackSubHashes)}; var ${st} = (new Error()).stack || ''; for (var i = 0; i + 5 <= ${st}.length; i++) { for (var sl = 5; sl <= 14; sl++) { if (i + sl > ${st}.length) break; if (${hSet}(${a}, ${hF}(${st}.substr(i, sl)))) { ${b} = true; break; } } if (${b}) break; } } catch {} }`,
    );
  }

  checks.push(
    `if (!${b}) { try { if (typeof window.exposedFn !== 'undefined') { var s = window.exposedFn.toString(); for (var i = 0; i + 19 <= s.length; i++) { if (${hF}(s.substr(i, 19)) === ${h("exposeBindingHandle")}) { ${b} = true; break; } } } } catch {} }`,
  );

  checks.push(
    `if (!${b} && typeof window.process !== 'undefined') { try { if (${hF}(window.process.type || '') === ${h("renderer")} || (window.process.versions && window.process.versions.electron)) ${b} = true; } catch { ${b} = true; } }`,
  );

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { try { var ${a} = ${JSON.stringify(uaTokHashes)}; var ua = navigator.userAgent || ''; for (const t of ua.split(/[\\s/(),;]/)) { if (t && ${hSet}(${a}, ${hF}(t))) { ${b} = true; break; } } if (!${b}) { var av = navigator.appVersion || ''; for (const t of av.split(/[\\s/(),;]/)) { if (t && ${hSet}(${a}, ${hF}(t))) { ${b} = true; break; } } } } catch {} }`,
    );
  }

  checks.push(
    `if (!${b}) { try { var c = document.createElement('canvas').getContext('webgl'); if (c) { var v = c.getParameter(c.VENDOR); var r = c.getParameter(c.RENDERER); if (${hF}(v || '') === ${webglVendorHash} && ${hF}(r || '') === ${webglRendererHash}) ${b} = true; } } catch {} }`,
  );

  checks.push(
    `if (!${b}) { try { if (document.hasFocus && document.hasFocus() && window.outerWidth === 0 && window.outerHeight === 0) ${b} = true; } catch { ${b} = true; } }`,
  );

  checks.push(
    `if (!${b}) { try { var es = Function.prototype.toString.call(eval); var found = false; for (var i = 0; i + 13 <= es.length; i++) { if (${hF}(es.substr(i, 13)) === ${h("[native code]")}) { found = true; break; } } if (!found) ${b} = true; } catch {} }`,
  );

  checks.push(
    `if (!${b}) { try { if (typeof Function.prototype.bind === 'undefined') ${b} = true; } catch {} }`,
  );

  checks.push(
    `if (!${b}) { try { if (window.external && typeof window.external.toString === 'function') { var s = window.external.toString(); for (var i = 0; i + 9 <= s.length; i++) { if (${hF}(s.substr(i, 9)) === ${sequentumHash}) { ${b} = true; break; } } } } catch { ${b} = true; } }`,
  );

  {
    const ok = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { try { if (navigator.mimeTypes) { var ${ok} = Object.getPrototypeOf(navigator.mimeTypes) === MimeTypeArray.prototype; for (var ${i} = 0; ${i} < navigator.mimeTypes.length && ${ok}; ${i}++) { ${ok} = Object.getPrototypeOf(navigator.mimeTypes[${i}]) === MimeType.prototype; } if (!${ok}) ${b} = true; } } catch {} }`,
    );
  }

  {
    const ua = rVar(),
      ps = rVar();
    checks.push(
      `if (!${b}) { try { var ${ps} = navigator.productSub; var ${ua} = navigator.userAgent || ''; if (${ps} && ${hF}(${ps}) !== ${productSubGeckoHash}) { var likeBlink = false; for (const t of ${ua}.toLowerCase().split(/[\\s/(),;]/)) { var hh = ${hF}(t); if (hh === ${h("chrome")} || hh === ${h("safari")} || hh === ${h("opera")}) { likeBlink = true; break; } } if (likeBlink) ${b} = true; } } catch {} }`,
    );
  }

  {
    const k = rVar();
    checks.push(
      `if (!${b}) { try { var ${k} = Object.getOwnPropertyNames(window); for (const n of ${k}) { var u = n.lastIndexOf('_'); if (u > 3 && u < n.length - 1) { var suf = n.slice(u + 1); var hh = ${hF}(suf); if (hh === ${h("Array")} || hh === ${h("Promise")} || hh === ${h("Symbol")}) { ${b} = true; break; } } } } catch {} }`,
    );
  }

  shuffle(checks);
  const sampled = checks.slice(0, Math.min(checks.length, 8));

  return `let ${b} = false;try {${sampled.join("")}} catch {${b} = true} if (${b}) {parent.postMessage({ type: 'cap:instr', nonce: ${JSON.stringify(id)}, result: '', blocked: true }, '*');return;}`;
}

function buildClientScript({
  id,
  vars,
  initVals,
  clientEqs,
  blockAutomatedBrowsers,
}) {
  const seed = randomInt(1, 0x7fffffff);
  const h = hashWith(seed);
  const hF = rVar();
  const hSet = rVar();
  const evalLocalVar = rVar();
  const evalSecret = randomInt(1_000_000, 0x7fffffff);
  const evalA = rVar();
  const evalB = rVar();
  const evalC = rVar();
  const helpers =
    `function ${hF}(s){let h=${seed}>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}return h>>>0;}` +
    `function ${hSet}(a,v){for(var i=0;i<a.length;i++)if(a[i]===v)return true;return false;}`;

  const blockChecks = blockAutomatedBrowsers
    ? buildBlockChecks(rVar(), id, hF, hSet, h)
    : "";

  const dvKey = rVar();
  const nKey = rVar();
  const outKey = rVar();

  const envChecks = [
    `try { const ${nKey}st = (new Error()).stack || ''; if (${nKey}st.indexOf('node:internal') !== -1 || ${nKey}st.indexOf('moduleEvaluation') !== -1 || ${nKey}st.indexOf('loadAndEvaluateModule') !== -1 || ${nKey}st.indexOf('file:///') !== -1 || ${nKey}st.indexOf('[eval]') !== -1 || /\\(native:/.test(${nKey}st)) return null; } catch { return null }`,

    `if (typeof HTMLElement !== 'function' || typeof Window !== 'function' || typeof Document !== 'function' || typeof Navigator !== 'function' || typeof Node !== 'function') return null; if (!(navigator instanceof Navigator) || !(document instanceof Document) || !(window instanceof Window) || !(document.body instanceof HTMLElement)) return null; if (globalThis !== window || window.self !== window || document.defaultView !== window) return null;`,

    `try { const ${nKey}ots = Object.prototype.toString; if (${hF}(${nKey}ots.call(navigator)) !== ${h("[object Navigator]")} || ${hF}(${nKey}ots.call(window)) !== ${h("[object Window]")} || ${hF}(${nKey}ots.call(document)) !== ${h("[object HTMLDocument]")}) return null; } catch { return null }`,

    `try { if (typeof EventTarget !== 'function' || !(document.body instanceof EventTarget) || !(window instanceof EventTarget)) return null; const ${nKey}probe = document.createElement('div'); let ${nKey}fired = 0; const ${nKey}ev = '_c' + (Date.now() & 0xffff).toString(36); const ${nKey}h = (e) => { if (e && e.detail === 0xc0de) ${nKey}fired++; }; ${nKey}probe.addEventListener(${nKey}ev, ${nKey}h); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); ${nKey}probe.removeEventListener(${nKey}ev, ${nKey}h); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); if (${nKey}fired !== 2) return null; } catch { return null }`,

    `try { const ${nKey}gf = new Function('return this'); const ${nKey}tg = ${nKey}gf(); if (${nKey}tg !== globalThis) return null; const ${nKey}leakHashes = ${JSON.stringify(["Bun", "process", "module", "require", "global", "__dirname", "Deno"].map(h))}; for (const ${nKey}k of Object.getOwnPropertyNames(${nKey}tg)) { if (${hSet}(${nKey}leakHashes, ${hF}(${nKey}k))) return null; } const ${nKey}fnArgs = new Function('a','b','c','return a+b+c'); if (${nKey}fnArgs.length !== 3) return null; if (${nKey}fnArgs(10,20,30) !== 60) return null; const ${nKey}src = Function.prototype.toString.call(${nKey}fnArgs); if (${nKey}src.indexOf('return a+b+c') === -1) return null; if (${nKey}src.indexOf('apply') !== -1 || ${nKey}src.indexOf('callArgs') !== -1 || ${nKey}src.indexOf('Reflect.') !== -1) return null; let ${nKey}thrown = null; try { new Function('throw new Error("x")')(); } catch (${nKey}e) { ${nKey}thrown = ${nKey}e; } if (!${nKey}thrown || !${nKey}thrown.stack) return null; const ${nKey}st2 = ${nKey}thrown.stack; if (${nKey}st2.indexOf('node:internal') !== -1 || ${nKey}st2.indexOf('moduleEvaluation') !== -1 || ${nKey}st2.indexOf('file:///') !== -1 || ${nKey}st2.indexOf('[eval]') !== -1 || /\\(native:/.test(${nKey}st2)) return null; } catch { return null }`,

    `try { const ${nKey}ie = (0, eval); const ${nKey}eg = ${nKey}ie('this'); if (${nKey}eg !== globalThis) return null; const ${nKey}leak2 = ${JSON.stringify(["Bun", "process", "require", "global", "__dirname", "Deno"].map(h))}; for (const ${nKey}k of Object.getOwnPropertyNames(${nKey}eg)) { if (${hSet}(${nKey}leak2, ${hF}(${nKey}k))) return null; } } catch { return null }`,

    `try { var ${evalLocalVar} = ${evalSecret}; var ${evalA} = '${evalLocalVar.slice(0, 2)}'; var ${evalB} = '${evalLocalVar.slice(2)}'; var ${evalC} = ${evalA} + ${evalB}; var ${evalLocalVar}r1 = (0, eval)('typeof ' + ${evalC}); if (${evalLocalVar}r1 !== 'undefined') return null; var ${evalLocalVar}r2 = eval(${evalC}); if (${evalLocalVar}r2 !== ${evalSecret}) return null; var ${evalLocalVar}r3 = eval(${evalA} + ${evalB} + '+1'); if (${evalLocalVar}r3 !== ${evalSecret + 1}) return null; var ${evalLocalVar}arr = ['(', '(', ')', '=', '>', 't', 'h', 'i', 's', ')', '(', ')']; var ${evalLocalVar}arrow = (0, eval)(${evalLocalVar}arr.join('')); if (${evalLocalVar}arrow !== globalThis) return null; var ${evalLocalVar}r4 = eval('(function(){return ' + ${evalC} + '*2;})()'); if (${evalLocalVar}r4 !== ${evalSecret * 2}) return null; } catch { return null }`,
  ];

  return `(function(){window.onload=async function(){try {${helpers}const ${dvKey}=await (async function(){${shuffle(envChecks).join("")}${blockChecks}
      var ${vars[0]}=${initVals[0]};var ${vars[1]}=${initVals[1]};var ${vars[2]}=${initVals[2]};var ${vars[3]}=${initVals[3]};${clientEqs}
      var ${outKey}={};${outKey}["${vars[0]}"]=${vars[0]};${outKey}["${vars[1]}"]=${vars[1]};${outKey}["${vars[2]}"]=${vars[2]};${outKey}["${vars[3]}"]=${vars[3]};return ${outKey};})();if (!${dvKey} || typeof ${dvKey} !== 'object') return;parent.postMessage({type: 'cap:instr',nonce:${JSON.stringify(id)},result:{i:${JSON.stringify(id)},state:${dvKey},ts:Date.now()}},'*');} catch {}};})();`;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function generateInstrumentation(opts = {}) {
  const id = rHex(32);
  const vars = Array.from({ length: 4 }, () => rVar(12));
  const blockAutomatedBrowsers = opts.blockAutomatedBrowsers === true;

  const initVals = [
    fastRnd(10, 250),
    fastRnd(10, 250),
    fastRnd(10, 250),
    fastRnd(10, 250),
  ];
  const vals = [...initVals];

  const correctKey = fastRnd(1000, 9000);
  let badKey = fastRnd(1000, 9000);
  while (badKey === correctKey) {
    badKey = fastRnd(1000, 9000);
  }

  vals[0] = toInt32(vals[0] ^ correctKey);

  const fnHelper = rVar();
  const domHelper = rVar();
  const helperDecls =
    `function ${fnHelper}(a,b,c){function F(d){this.v=function(){return this.k^d;}};var p={k:c};var i=new F(a);i.k=b;F.prototype=p;return i.v()|(new F(b)).v();}` +
    `function ${domHelper}(x,y,z){var d=document.createElement('div');d.style.display='none';document.body.appendChild(d);function A(p,v){for(var i=0;i<8;i++){var c=document.createElement('div');p.appendChild(c);c.innerText=v;if((v&1)==0)p=c;v=v>>1;}return p;}function B(n,r,s){if(!n||n==r)return s%256;while(n.children.length>0)n.removeChild(n.lastElementChild);return B(n.parentNode,r,s+parseInt(n.innerText));}var s=B(A(A(A(d,x),y),z),d,0);d.parentNode.removeChild(d);return s;}`;

  let clientEqs = `${helperDecls}${vars[0]} = ${vars[0]} ^ (navigator.userAgent ? ${correctKey} : ${badKey});`;

  for (let i = 0; i < 20; i++) {
    const op = fastRnd(0, 5);
    const dest = fastRnd(0, 3);
    const src1 = fastRnd(0, 3);
    const src2 = fastRnd(0, 3);
    const src3 = fastRnd(0, 3);
    const vD = vars[dest];
    const vS1 = vars[src1];
    const vS2 = vars[src2];
    const vS3 = vars[src3];

    if (op === 0) {
      clientEqs += `${vD} = ~(${vD} & ${vS1});`;
      vals[dest] = toInt32(~(vals[dest] & vals[src1]));
    } else if (op === 1) {
      clientEqs += `${vD} = ${vD} ^ ${vS1};`;
      vals[dest] = toInt32(vals[dest] ^ vals[src1]);
    } else if (op === 2) {
      clientEqs += `${vD} = ${vD} | ${vS1};`;
      vals[dest] = toInt32(vals[dest] | vals[src1]);
    } else if (op === 3) {
      clientEqs += `${vD} = ${vD} & ${vS1};`;
      vals[dest] = toInt32(vals[dest] & vals[src1]);
    } else if (op === 4) {
      clientEqs += `${vD} = ${fnHelper}(${vS1}, ${vS2}, ${vD});`;
      vals[dest] = toInt32(
        (vals[src2] ^ vals[src1]) | (vals[dest] ^ vals[src2]),
      );
    } else {
      clientEqs += `${vD} = ${domHelper}(${vS1}, ${vS2}, ${vS3});`;
      vals[dest] = toInt32(domSumMock(vals[src1], vals[src2], vals[src3]));
    }
  }

  const salts = [
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
  ];
  for (let i = 0; i < 4; i++) {
    clientEqs += `${vars[i]}=((${vars[i]}^${salts[i]})&0x7FFFFFFF)%900000+100000;`;
    vals[i] = (((vals[i] ^ salts[i]) & 0x7fffffff) % 900_000) + 100_000;
  }

  const script = buildClientScript({
    id,
    vars,
    initVals,
    clientEqs,
    blockAutomatedBrowsers,
  });

  const level = Math.max(1, Math.min(10, opts.obfuscationLevel ?? 3));

  let finalScript;
  if (level <= 3) {
    finalScript = script.replace(/\n\s*/g, "\n").replace(/^\s+/gm, "");
  } else if (level <= 7) {
    const s = customObfuscateStrings(script);
    const esbuild = await getEsbuild();
    if (esbuild) {
      const out = await esbuild.transform(s, {
        minify: true,
        legalComments: "none",
        target: "es2018",
      });
      finalScript = out.code;
    } else {
      finalScript = s.replace(/\n\s*/g, "\n").replace(/^\s+/gm, "");
    }
  } else {
    const obfuscator = await getObfuscator();
    if (!obfuscator) {
      let s = customObfuscateStrings(script);
      const esbuild = await getEsbuild();
      if (esbuild) {
        const out = await esbuild.transform(s, {
          minify: true,
          legalComments: "none",
          target: "es2018",
        });
        s = out.code;
      }
      finalScript = s;
    } else {
      const opts2 = {
        compact: true,
        ignoreRequireImports: true,
        identifierNamesGenerator: "mangled-shuffled",
        stringArray: true,
        stringArrayThreshold: 0.75,
        stringArrayEncoding: level >= 8 ? ["rc4"] : ["base64"],
        splitStrings: true,
        splitStringsChunkLength: randomInt(3, 16),
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: level >= 9 ? 0.75 : 0.4,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: level >= 9 ? 0.3 : 0.1,
        selfDefending: level >= 9,
        debugProtection: level >= 10,
        disableConsoleOutput: level >= 10,
      };

      finalScript = obfuscator.obfuscate(script, opts2).getObfuscatedCode();
    }
  }

  const compressed = deflateRawSync(Buffer.from(finalScript, "utf8"), {
    level: 1,
  });

  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;

  return {
    id,
    expires: Date.now() + ttlMs,
    expectedVals: vals,
    vars,
    blockAutomatedBrowsers,
    instrumentation: Buffer.from(compressed).toString("base64"),
  };
}

export function verifyInstrumentationResult(challengeMeta, payload) {
  if (!challengeMeta || typeof challengeMeta !== "object") {
    return { valid: false, reason: "missing_meta" };
  }
  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "missing_output" };
  }

  if (payload.i !== challengeMeta.id) {
    return { valid: false, reason: "id_mismatch" };
  }

  const actual = payload.state;
  if (!actual || typeof actual !== "object") {
    return { valid: false, reason: "invalid_state" };
  }

  if (
    !Array.isArray(challengeMeta.vars) ||
    !Array.isArray(challengeMeta.expectedVals)
  ) {
    return { valid: false, reason: "invalid_meta" };
  }

  const match = challengeMeta.vars.every(
    (v, i) => actual[v] === challengeMeta.expectedVals[i],
  );

  if (!match) {
    return { valid: false, reason: "failed_challenge" };
  }

  return { valid: true };
}
