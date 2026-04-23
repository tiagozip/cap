import { randomBytes, randomInt } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import JavaScriptObfuscator from "javascript-obfuscator";

const rHex = (len = 16) => randomBytes(len).toString("hex").slice(0, len);
const rnd = (a, b) => randomInt(a, b + 1);
const rVar = (len) => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  
  if (!len) len = Math.floor(Math.random() * 7) + 4;

  let rest = "";
  const bytes = randomBytes(len - 1);
  for (let i = 0; i < len - 1; i++) {
    rest += chars[bytes[i] % chars.length];
  }

  return `${letters[Math.floor(Math.random() * letters.length)]}${rest}`;
};
const toInt32 = (n) => n | 0;

const transpiler = new Bun.Transpiler({ loader: "js", minifyWhitespace: true });

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

  return toInt32(walk(buildChain(buildChain(buildChain(root, x), y), z), root, 0));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildBlockChecks(b, id) {
  const checks = [];

  checks.push(`if (navigator.webdriver) ${b} = true;`);

  {
    const v = rVar();
    checks.push(
      `if (!${b}) { try { var ${v} = Object.getOwnPropertyDescriptor(navigator, 'webdriver'); if (${v} !== undefined) ${b} = true; } catch { ${b} = true } }`,
    );
  }

  checks.push(`if (!${b} && Object.getOwnPropertyNames(navigator).length !== 0) ${b} = true;`);

  {
    const v = rVar();
    checks.push(
      `if (!${b}) { var ${v} = Object.getOwnPropertyNames(window).filter(function(k) { return /^cdc_|^\\$cdc_/.test(k); }); if (${v}.length > 0) ${b} = true; }`,
    );
  }

  {
    const a = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ['_Selenium_IDE_Recorder','_selenium','calledSelenium','__webdriverFunc','__lastWatirAlert','__lastWatirConfirm','__lastWatirPrompt','_WEBDRIVER_ELEM_CACHE','ChromeDriverw']; for (var ${i}=0; ${i}<${a}.length; ${i}++) { if (${a}[${i}] in window) { ${b} = true; break; } } }`,
    );
  }

  {
    const a = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ['__selenium_evaluate','selenium-evaluate','__selenium_unwrapped','__webdriver_script_fn','__driver_evaluate','__webdriver_evaluate','__fxdriver_evaluate','__driver_unwrapped','__webdriver_unwrapped','__fxdriver_unwrapped','__webdriver_script_func','__webdriver_script_function']; for (var ${i}=0; ${i}<${a}.length; ${i}++) { if (${a}[${i}] in document) { ${b} = true; break; } } }`,
    );
  }

  {
    const a = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { try { var ${a} = document.documentElement.getAttributeNames(); for (var ${i}=0; ${i}<${a}.length; ${i}++) { if (/selenium|webdriver|driver/.test(${a}[${i}])) { ${b} = true; break; } } } catch { ${b} = true } }`,
    );
  }

  checks.push(
    `if (!${b}) { if (window.callPhantom || window._phantom) ${b} = true; try { if (/PhantomJS/i.test((new Error).stack || '')) ${b} = true; } catch {} }`,
  );

  {
    const v = rVar(),
      k = rVar();
    checks.push(
      `if (!${b}) { try { var ${v} = (new Error('This error has been triggered as part of a Cap challenge and is safe to ignore')).stack || ''; if (${v}.indexOf('pptr:') !== -1 || ${v}.indexOf('UtilityScript.') !== -1) ${b} = true; } catch {} if (!${b}) { for (var ${k} in window) { if (${k}.indexOf('puppeteer_') === 0) { ${b} = true; break; } } } }`,
    );
  }

  checks.push(
    `if (!${b}) { if (window.__playwright__binding__ !== undefined || window.__pwInitScripts !== undefined) ${b} = true; try { if (typeof window.exposedFn !== 'undefined' && window.exposedFn.toString().indexOf('exposeBindingHandle') !== -1) ${b} = true; } catch { } }`,
  );

  checks.push(
    `if (!${b} && (window.__nightmare !== undefined || window.nightmare !== undefined)) ${b} = true;`,
  );

  {
    const a = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { var ${a} = ['awesomium','CefSharp','RunPerfTest','fmget_targets','geb','spawn','domAutomation','domAutomationController','wdioElectron']; for (var ${i}=0; ${i}<${a}.length; ${i}++) { if (${a}[${i}] in window) { ${b} = true; break; } } }`,
    );
  }

  checks.push(
    `if (!${b} && typeof window.process !== 'undefined') { try { if (window.process.type === 'renderer' || (window.process.versions && window.process.versions.electron)) ${b} = true; } catch { ${b} = true; } }`,
  );

  checks.push(
    `if (!${b}) { try { if (/HeadlessChrome|PhantomJS|SlimerJS/i.test(navigator.userAgent)) ${b} = true; if (/headless/i.test(navigator.appVersion || '')) ${b} = true; } catch {} }`,
  );

  {
    const c = rVar(),
      v = rVar(),
      r = rVar();
    checks.push(
      `if (!${b}) { try { var ${c} = document.createElement('canvas').getContext('webgl'); if (${c}) { var ${v} = ${c}.getParameter(${c}.VENDOR); var ${r} = ${c}.getParameter(${c}.RENDERER); if (${v} === 'Brian Paul' && ${r} === 'Mesa OffScreen') ${b} = true; } } catch {} }`,
    );
  }

  checks.push(
    `if (!${b}) { try { if (document.hasFocus && document.hasFocus() && window.outerWidth === 0 && window.outerHeight === 0) ${b} = true; } catch { ${b} = true; } }`,
  );

  checks.push(
    `if (!${b}) { try { if (eval.toString().indexOf('[native code]') === -1) ${b} = true; } catch {} }`,
  );

  checks.push(
    `if (!${b}) { try { if (typeof Function.prototype.bind === 'undefined') ${b} = true; } catch {} }`,
  );

  checks.push(
    `if (!${b}) { try { if (window.external && typeof window.external.toString === 'function' && /Sequentum/i.test(window.external.toString())) ${b} = true; } catch { ${b} = true} }`,
  );

  {
    const ok = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { try { if (navigator.mimeTypes) { var ${ok} = Object.getPrototypeOf(navigator.mimeTypes) === MimeTypeArray.prototype; for (var ${i}=0; ${i}<navigator.mimeTypes.length && ${ok}; ${i}++) { ${ok} = Object.getPrototypeOf(navigator.mimeTypes[${i}]) === MimeType.prototype; } if (!${ok}) ${b} = true; } } catch {} }`,
    );
  }

  {
    const ps = rVar(),
      ua = rVar();
    checks.push(
      `if (!${b}) { try { var ${ps} = navigator.productSub; var ${ua} = navigator.userAgent.toLowerCase(); if (${ps} && ${ps} !== '20030107' && (${ua}.indexOf('chrome') !== -1 || ${ua}.indexOf('safari') !== -1 || ${ua}.indexOf('opera') !== -1)) ${b} = true; } catch {} }`,
    );
  }

  {
    const k = rVar(),
      re = rVar(),
      i = rVar();
    checks.push(
      `if (!${b}) { try { var ${k} = Object.getOwnPropertyNames(window); var ${re} = /^([a-z]){3}_.*_(Array|Promise|Symbol)$/; for (var ${i}=0; ${i}<${k}.length; ${i}++) { if (${re}.test(${k}[${i}])) { ${b} = true; break; } } } catch {} }`,
    );
  }

  shuffle(checks);
  return `let ${b} = false;try {${checks.join("")}} catch {${b} = true} if (${b}) {parent.postMessage({ type: 'cap:instr', nonce: ${JSON.stringify(id)}, result: '', blocked: true }, '*');return;}`;
}

function buildClientScript({ id, vars, initVals, clientEqs, blockAutomatedBrowsers }) {
  const blockChecks = blockAutomatedBrowsers ? buildBlockChecks(rVar(), id) : "";

  const dvKey = rVar();
  const atobKey = rVar();
  const canvasKey = rVar();
  const nKey = rVar();
  const outKey = rVar();

  return `(function(){window.onload=async function(){try {const ${dvKey}=await (async function(){${shuffle([
    `if (navigator.toString() !== '[object Navigator]' || window.toString() !== '[object Window]' || document.toString() !== '[object HTMLDocument]' || typeof process !== 'undefined') return null;`,

    `if (!navigator.userAgent) return null;`,

    `try { const ${nKey}n = ["fetch","setTimeout","setInterval","clearTimeout","clearInterval","decodeURI","decodeURIComponent","encodeURI","encodeURIComponent","isFinite","isNaN","parseFloat","parseInt","atob","btoa","eval","requestAnimationFrame","cancelAnimationFrame","addEventListener","removeEventListener","dispatchEvent","blur","focus","queueMicrotask","Date","RegExp","Error","Number","Boolean","String","Object","Function","Array","Map","Set","WeakMap","WeakSet","ArrayBuffer"]; for (const ${nKey}f of ${nKey}n) { if (!window[${nKey}f] || window[${nKey}f].toString().indexOf('[native code]') === -1) return null } } catch { return null }`,

    `try { const ${canvasKey} = document.createElement('canvas'); const ${canvasKey}c = ${canvasKey}.getContext('2d'); ${canvasKey}c.fillText('1', 10, 10); const ${canvasKey}d = ${canvasKey}.toDataURL(); if (${canvasKey}d.length < 50) return null; } catch { return null }`,

    `try { const ${nKey}g = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl'); const ${nKey}r = ${nKey}g.RENDERER && ${nKey}g.getParameter(${nKey}g.RENDERER); if (${nKey}r && (${nKey}r.toLowerCase().includes('swiftshader') || ${nKey}r.toLowerCase().includes('llvmpipe'))) return null; } catch {}`,

    `if (window.atob("${btoa(atobKey)}")!=="${atobKey}") return null;`,
  ]).join("")}${blockChecks}
      var ${vars[0]}=${initVals[0]};var ${vars[1]}=${initVals[1]};var ${vars[2]}=${initVals[2]};var ${vars[3]}=${initVals[3]};${clientEqs}
      var ${outKey}={};${outKey}["${vars[0]}"]=${vars[0]};${outKey}["${vars[1]}"]=${vars[1]};${outKey}["${vars[2]}"]=${vars[2]};${outKey}["${vars[3]}"]=${vars[3]};return ${outKey};})();if (!${dvKey} || typeof ${dvKey} !== 'object') return;parent.postMessage({type: 'cap:instr',nonce:${JSON.stringify(id)},result:{i:${JSON.stringify(id)},state:${dvKey},ts:Date.now()}},'*');} catch {}};})();`;
}

const TTL = 5 * 60 * 1000;

async function generateInstrumentationChallenge(keyConfig = {}) {
  const id = rHex(32);
  const vars = Array.from({ length: 4 }, () => rVar(12));
  const blockAutomatedBrowsers = keyConfig.blockAutomatedBrowsers === true;

  let clientEqs;
  const initVals = Array.from({ length: 4 }, () => rnd(10, 250));
  const vals = [...initVals];

  const correctKey = rnd(1000, 9000);
  let badKey = rnd(1000, 9000);
  while (badKey === correctKey) {
    badKey = rnd(1000, 9000);
  }

  vals[0] = toInt32(vals[0] ^ correctKey);

  clientEqs = `${vars[0]} = ${vars[0]} ^ (navigator.userAgent ? ${correctKey} : ${badKey});`;

  for (let i = 0; i < 35; i++) {
    const op = rnd(0, 5);
    const dest = rnd(0, 3);
    const src1 = rnd(0, 3);
    const src2 = rnd(0, 3);
    const src3 = rnd(0, 3);
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
      clientEqs += `${vD} = function(a,b,c){function F(d){this.v=function(){return this.k^d;}};var p={k:c};var i=new F(a);i.k=b;F.prototype=p;return i.v()|(new F(b)).v();}(${vS1}, ${vS2}, ${vD});`;
      vals[dest] = toInt32((vals[src2] ^ vals[src1]) | (vals[dest] ^ vals[src2]));
    } else {
      clientEqs += `${vD} = function(x,y,z){var d=document.createElement('div');d.style.display='none';document.body.appendChild(d);function A(p,v){for(var i=0;i<8;i++){var c=document.createElement('div');p.appendChild(c);c.innerText=v;if((v&1)==0)p=c;v=v>>1;}return p;}function B(n,r,s){if(!n||n==r)return s%256;while(n.children.length>0)n.removeChild(n.lastElementChild);return B(n.parentNode,r,s+parseInt(n.innerText));}var s=B(A(A(A(d,x),y),z),d,0);d.parentNode.removeChild(d);return s;}(${vS1}, ${vS2}, ${vS3});`;
      vals[dest] = toInt32(domSumMock(vals[src1], vals[src2], vals[src3]));
    }
  }

  const salts = Array.from({ length: 4 }, () => rnd(100_000, 999_999));
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

  const level = Math.max(1, Math.min(10, keyConfig.obfuscationLevel ?? 3));

  let finalScript;
  if (level === 1) {
    finalScript = script.replace(/\n\s*/g, "\n").replace(/^\s+/gm, "");
  } else if (level === 2) {
    finalScript = await transpiler.transform(script);
  } else {
    const opts = {
      compact: true,
      ignoreRequireImports: true,
      identifierNamesGenerator: "mangled-shuffled",
      stringArray: level >= 4,
      stringArrayThreshold: level >= 7 ? 0.75 : 0.5,
      stringArrayEncoding: level >= 8 ? ["rc4"] : level >= 6 ? ["base64"] : [],
      splitStrings: level >= 5,
      splitStringsChunkLength: level >= 5 ? randomInt(3, 16) : 10,
      controlFlowFlattening: level >= 7,
      controlFlowFlatteningThreshold: level >= 9 ? 0.75 : 0.4,
      deadCodeInjection: level >= 8,
      deadCodeInjectionThreshold: level >= 9 ? 0.3 : 0.1,
      selfDefending: level >= 9,
      debugProtection: level >= 10,
      disableConsoleOutput: level >= 10,
    };

    finalScript = JavaScriptObfuscator.obfuscate(script, opts).getObfuscatedCode();
  }

  const compressed = deflateRawSync(Buffer.from(finalScript, "utf8"), {
    level: 1,
  });

  return {
    id,
    expires: Date.now() + TTL,
    expectedVals: vals,
    vars,
    blockAutomatedBrowsers,
    instrumentation: Buffer.from(compressed).toString("base64"),
  };
}

process.on("message", async (msg) => {
  try {
    const result = await generateInstrumentationChallenge(msg.keyConfig || {});
    process.send({ id: msg.id, ok: true, result });
  } catch (err) {
    process.send({ id: msg.id, ok: false, error: String(err) });
  }
});
