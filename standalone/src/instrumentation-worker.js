import { randomBytes, randomInt } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import JavaScriptObfuscator from "javascript-obfuscator";

const rHex = (len = 16) => randomBytes(len).toString("hex").slice(0, len);
const rnd = (a, b) => randomInt(a, b + 1);
const rVar = (len = 12) =>
  "_" +
  randomBytes(len)
    .toString("hex")
    .slice(0, len - 1);
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

  return toInt32(walk(buildChain(buildChain(buildChain(root, x), y), z), root, 0));
}

function buildClientScript({ id, vars, initVals, clientEqs, blockAutomatedBrowsers }) {
  const blockChecks = blockAutomatedBrowsers
    ? `
  let _blocked = false;
  try {
  if (navigator.webdriver || (typeof window.cdc_adoQpoasnfa76pfcZLmcfl_ !== 'undefined') || (typeof window.__nightmare !== 'undefined') || (typeof window.__selenium_unwrapped !== 'undefined') || (typeof window.__driver_evaluate !== 'undefined') || (typeof window.__webdriver_script_fn !== 'undefined') || (typeof window.__$webdriverAsyncExecutor !== 'undefined') || (typeof window.__webdriver_evaluate !== 'undefined') || (typeof window.__selenium_evaluate !== 'undefined') || (typeof window.__webdriver_script_func !== 'undefined') || (typeof window.__webdriver_async_script !== 'undefined') || (navigator.plugins && navigator.plugins.length === 0) || (typeof window.exposedFn !== 'undefined') || window.exposedFn.toString()?.includes('exposeBindingHandle supports a single argument') || (window.__pwInitScripts !== undefined) || (Object.getOwnPropertyNames(navigator).length !== 0) || (Object.getOwnPropertyDescriptor(navigator, 'webdriver') !== undefined) || (new Error('Cap')).stack.toString().includes('pptr:') || (new Error('Cap')).stack.toString().includes('UtilityScript.')) {
    _blocked = true;
  }

  for (const key in window) {
    if (key.startsWith('puppeteer_')) {
    _blocked = true;
      break
    }
    if (key === '__playwright__binding__') {
      _blocked = true;
      break
    }
    if (typeof window[key] === 'function' && window[key].__installed === true) {
      _blocked = true;
      break
    }
  }
  } catch(_e) {}

  if (_blocked) {
    parent.postMessage({ type: 'cap:instr', nonce: ${JSON.stringify(id)}, result: '', blocked: true }, '*');
    return;
  }
`
    : "";

  return `    (function(){
'use strict';

var doVerification = async function() {
  if (navigator.toString() !== '[object Navigator]' || window.toString() !== '[object Window]' || document.toString() !== '[object HTMLDocument]' || typeof process !== 'undefined') {
    return null
  }

  if (!navigator.userAgent) return null

  try {
    const nativeFns = ['fetch']
    for (const fn of nativeFns) {
      if (!window[fn] || window[fn].toString().indexOf('[native code]') === -1) return null
    }
  } catch { return null }

  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.fillText('1', 10, 10)
    const data = canvas.toDataURL()
    if (data.length < 50) return null
  } catch {
    return null
  }

  try {
    const gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl')
    const renderer = gl?.getParameter(gl.RENDERER) || ''
    if (renderer && (renderer.toLowerCase().includes('swiftshader') || renderer.toLowerCase().includes('llvmpipe'))) return null
  } catch {}

  ${blockChecks}
  var ${vars[0]} = ${initVals[0]};
  var ${vars[1]} = ${initVals[1]};
  var ${vars[2]} = ${initVals[2]};
  var ${vars[3]} = ${initVals[3]};

  ${clientEqs}

  var res = {};
  res["${vars[0]}"] = ${vars[0]};
  res["${vars[1]}"] = ${vars[1]};
  res["${vars[2]}"] = ${vars[2]};
  res["${vars[3]}"] = ${vars[3]};
  return res;
};

window.onload = async function() {
  try {
    var result = await doVerification();
    if (!result || typeof result !== 'object') return;
    parent.postMessage({ type: 'cap:instr', nonce: ${JSON.stringify(id)}, result: { i: ${JSON.stringify(id)}, state: result, ts: Date.now() } }, '*');
  } catch(e) {
    parent.postMessage({ type: 'cap:error', reason: String(e) }, '*');
  }
};
})();`;
}

const TTL = 5 * 60 * 1000;

function generateInstrumentationChallenge(keyConfig = {}) {
  const id = rHex(32);
  const vars = Array.from({ length: 4 }, () => rVar(12));
  const blockAutomatedBrowsers = keyConfig.blockAutomatedBrowsers === true;

  let states, clientEqs, initVals;

  for (let attempt = 0; attempt < 20; attempt++) {
    initVals = Array.from({ length: 4 }, () => rnd(10, 250));

    const wdTrueKey = rnd(1000, 9000);
    let wdFalseKey = rnd(1000, 9000);
    while (wdFalseKey === wdTrueKey) {
      wdFalseKey = rnd(1000, 9000);
    }

    states = [
      { env: { webdriver: false }, vals: [...initVals] },
      { env: { webdriver: true }, vals: [...initVals] },
    ];
    for (const s of states) {
      s.vals[0] = toInt32(s.vals[0] ^ (s.env.webdriver ? wdTrueKey : wdFalseKey));
    }

    clientEqs = `${vars[0]} = ${vars[0]} ^ (navigator.webdriver ? ${wdTrueKey} : ${wdFalseKey});\n`;

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
        clientEqs += `${vD} = ~(${vD} & ${vS1});\n`;
        for (const s of states) s.vals[dest] = toInt32(~(s.vals[dest] & s.vals[src1]));
      } else if (op === 1) {
        clientEqs += `${vD} = ${vD} ^ ${vS1};\n`;
        for (const s of states) s.vals[dest] = toInt32(s.vals[dest] ^ s.vals[src1]);
      } else if (op === 2) {
        clientEqs += `${vD} = ${vD} | ${vS1};\n`;
        for (const s of states) s.vals[dest] = toInt32(s.vals[dest] | s.vals[src1]);
      } else if (op === 3) {
        clientEqs += `${vD} = ${vD} & ${vS1};\n`;
        for (const s of states) s.vals[dest] = toInt32(s.vals[dest] & s.vals[src1]);
      } else if (op === 4) {
        clientEqs += `${vD} = function(a,b,c){function F(d){this.v=function(){return this.k^d;}};var p={k:c};var i=new F(a);i.k=b;F.prototype=p;return i.v()|(new F(b)).v();}(${vS1}, ${vS2}, ${vD});\n`;
        for (const s of states) {
          s.vals[dest] = toInt32((s.vals[src2] ^ s.vals[src1]) | (s.vals[dest] ^ s.vals[src2]));
        }
      } else {
        clientEqs += `${vD} = function(x,y,z){var d=document.createElement('div');d.style.display='none';document.body.appendChild(d);function A(p,v){for(var i=0;i<8;i++){var c=document.createElement('div');p.appendChild(c);c.innerText=v;if((v&1)==0)p=c;v=v>>1;}return p;}function B(n,r,s){if(!n||n==r)return s%256;while(n.children.length>0)n.removeChild(n.lastElementChild);return B(n.parentNode,r,s+parseInt(n.innerText));}var s=B(A(A(A(d,x),y),z),d,0);d.parentNode.removeChild(d);return s;}(${vS1}, ${vS2}, ${vS3});\n`;
        for (const s of states) {
          s.vals[dest] = toInt32(domSumMock(s.vals[src1], s.vals[src2], s.vals[src3]));
        }
      }
    }

    if (!states[0].vals.every((v, i) => v === states[1].vals[i])) break;
  }

  const script = buildClientScript({
    id,
    vars,
    initVals,
    clientEqs,
    blockAutomatedBrowsers,
  });

  const obfuscated = JavaScriptObfuscator.obfuscate(script, {
    compact: true,
    controlFlowFlattening: false,
    controlFlowFlatteningThreshold: 0,
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: [],
    stringArrayThreshold: 0.5,
    identifierNamesGenerator: "mangled-shuffled",
    splitStrings: true,
    splitStringsChunkLength: randomInt(5, 26),
    debugProtection: false,
    disableConsoleOutput: false,
    selfDefending: false,
    ignoreRequireImports: true,
  }).getObfuscatedCode();

  const compressed = deflateRawSync(Buffer.from(obfuscated, "utf8"), {
    level: 1,
  });

  return {
    id,
    expires: Date.now() + TTL,
    validStates: states,
    vars,
    blockAutomatedBrowsers,
    instrumentation: Buffer.from(compressed).toString("base64"),
  };
}

process.on("message", (msg) => {
  try {
    const result = generateInstrumentationChallenge(msg.keyConfig || {});
    process.send({ ok: true, result });
  } catch (err) {
    process.send({ ok: false, error: String(err) });
  }
});
