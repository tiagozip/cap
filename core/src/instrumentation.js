import { randomBytes, randomInt } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { detectAutomation } from "./detect.js";

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
      const child = { parentNode: cur, textContent: String(v) };
      if ((v & 1) === 0) cur = child;
      v = v >> 1;
    }
    return cur;
  }

  function walk(node, rootRef, sum) {
    if (!node || node === rootRef) return sum % 256;
    return walk(node.parentNode, rootRef, sum + parseInt(node.textContent, 10));
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
  "setFontSpacingSeed",
  "setAudioFingerprintSeed",
  "setScreenDimensions",
  "setScreenColorDepth",
  "setNavigatorPlatform",
  "setNavigatorOscpu",
  "setNavigatorHardwareConcurrency",
  "setWebGLVendor",
  "setWebGLRenderer",
  "setFontList",
  "setSpeechVoices",
  "setWebRTCIPv4",
  "__playwright__binding__controller__",
  "__playwright_builtins__",
  "__pwWebSocketDispatch",
  "__playwright_mark_target__",
  "callPuppeteer",
  "callSelenium",
  "__phantomas",
  "__stagehandV3__",
  "__stagehandV3Injected",
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
const NAV_OWN_PROP_MARKERS = [
  "webdriver",
  "userAgent",
  "appVersion",
  "userAgentData",
  "platform",
  "vendor",
  "product",
  "productSub",
  "languages",
  "language",
  "plugins",
  "mimeTypes",
  "hardwareConcurrency",
  "deviceMemory",
  "maxTouchPoints",
  "permissions",
  "connection",
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
const AGENT_MARKS = [
  [
    "cic_active",
    "#claude-agent-glow-border,#claude-agent-stop-container,#claude-phantom-cursor,#claude-cursor-layer",
    null,
  ],
  ["cic_shared", "#claude-static-indicator-container", null],
  [
    "browser_use",
    "#browser-use-debug-highlights,[data-browser-use-highlight],[data-browser-use-interaction-highlight],[data-browser-use-coordinate-highlight],#playwright-highlight-container,[browser-user-highlight-id],#browser-use-demo-panel",
    ["__browserUseDemoPanelLoaded"],
  ],
  ["cic_legacy", "#claude-agent-animation-styles", null],
  [
    "codex",
    "#codex-agent-overlay-root,#codex-browser-sidebar-comments-root",
    null,
  ],
  ["browserflow", "#browserflow-container,.browserflow-container", null],
  [
    "thunderbit",
    "#thunderbit-crx-scout-overlay,#thunderbit-crx-side-bar",
    null,
  ],
  [
    "fellou",
    "#eko-highlight-container",
    ["__FELLOU_TAB_ID__", "FELLOU_PARTITION", "FELLOU_WEBVIEW_PRELOAD_PATH"],
  ],
  [
    "stagehand",
    "#__v3_cursor_overlay__,[data-stagehand-mask]",
    ["__stagehandV3__", "__stagehandV3Injected"],
  ],
  [
    "twocaptcha",
    "head > captcha-widgets",
    ["registerCaptchaWidget", "isCaptchaWidgetRegistered"],
  ],
  ["comet", "#pplx-agent-overlay-stop-button", null],
  [
    "genspark",
    "#genspark-float-bar,#gs-overlay-cursor-style",
    ["navigator.genspark"],
  ],
  ["sigma", null, ["__SIGMA__"]],
  ["manus", "#manus-action-mask-host", ["__manusOriginalPostMessage"]],
  ["antigravity", "html[data-jetski-tab-id]", null],
  ["cursor", null, ["__cursorDialogConfig"]],
  ["rtrvr", "[rtrvr-mw-host-id],html[rtrvr-mw-busy]", null],
  [
    "rtrvr_installed",
    "html[rtrvr-mw-ready]",
    ["__RTRVR_MAIN_WORLD_INITIALIZED__"],
  ],
  ["harpa_installed", "html > __hrp__", ["__hrp_globals"]],
  ["monica", "#monica-action-mask-host", null],
  ["monica_installed", "#monica-content-root", null],
  ["sider", "#sider-agent-glow-border", null],
  ["sider_installed", "chatgpt-sidebar", null],
  [
    "maxai_installed",
    "#USE_CHAT_GPT_AI_ROOT,max-ai-minimum-app",
    ["__MAXAI__EXTENSION__VERSION__"],
  ],
  ["nova_act", "[nova-act-id]", null],
  ["agentql", "[tf623_id]", null],
  [
    "hyperagent",
    null,
    [
      "__hyperagent_getScrollableElementXpaths",
      "__hyperagent_collectBoundingBoxes",
    ],
  ],
  [
    "agent_browser",
    "[data-agent-browser-located],#__agent_browser_annotations__,agent-browser-recording-cursor,[data-__ab-ci]",
    null,
  ],
  [
    "do_browser",
    "#redo-active-glow,#redo-active-glow-style",
    ["__redoGlowState"],
  ],
  ["nanobrowser", "[data-nanobrowser-border]", null],
  ["dassi", "#dassi-neon-overlay-root", null],
  [
    "kimi",
    "#kimi-webbridge-agent-visuals,link[data-wb-cursor]",
    ["__kimiWebBridgeVisuals"],
  ],
  [
    "magnitude",
    "style[data-cursor-effects],style[data-type-effects]",
    ["__mouseEffectsInitialized", "__typeEffectsInitialized"],
  ],
  ["lavague", ".lavague-highlight", null],
  ["kernel", null, ["__kernelEventInjected"]],
  [
    "skyvern",
    "[data-skyvern-otp-box],#boundingBoxContainer",
    [
      "GlobalSkyvernFrameIndex",
      "globalDomDepthMap",
      "globalParsedElementCounter",
    ],
  ],
];
const MARK_ATTRS = {
  "data-__ab-ci": "agent_browser",
  "nova-act-id": "nova_act",
  tf623_id: "agentql",
  "rtrvr-mw-host-id": "rtrvr",
  "rtrvr-mw-busy": "rtrvr",
  "data-nanobrowser-border": "nanobrowser",
  "data-jetski-tab-id": "antigravity",
};
const SENSITIVE_FIELDS =
  'input[type="password"],[autocomplete~="one-time-code"],[autocomplete~="current-password"],[autocomplete~="new-password"],[autocomplete^="cc-"]';
const MAX_BOUND_CODES = 32;
const WEBGL_VENDOR_MARKER = "Brian Paul";
const WEBGL_RENDERER_MARKER = "Mesa OffScreen";
const PRODUCTSUB_GECKO = "20030107";
const SEQUENTUM_MARKER = "Sequentum";

const PROBE_FONT_STACKS = [
  "sans-serif",
  "serif",
  "monospace",
  "Arial",
  "'Times New Roman'",
  "'Courier New'",
  "'Segoe UI'",
  "'SF Pro Text'",
  "'Helvetica Neue'",
  "'Ubuntu'",
  "'DejaVu Sans'",
  "'Roboto'",
  "Tahoma",
  "Calibri",
  "'Cantarell'",
  "'Liberation Sans'",
  "'Noto Sans'",
];

function buildProbe(P) {
  const sf = rVar();
  const nat = rVar();
  const fields = [
    `${sf}("ua",function(){return navigator.userAgent});`,
    `${sf}("productSub",function(){return navigator.productSub});`,
    `${sf}("webdriver",function(){return navigator.webdriver});`,
    `${sf}("oscpu",function(){return navigator.oscpu===undefined?"__undefined":navigator.oscpu});`,
    `${sf}("deviceMemory",function(){return navigator.deviceMemory});`,
    `${sf}("uaDataPresent",function(){return !!navigator.userAgentData});`,
    `${sf}("uaData",function(){var u=navigator.userAgentData;return u?{mobile:u.mobile,brands:(u.brands||[]).map(function(b){return b.brand+"/"+b.version})}:null});`,
    `${sf}("plugins",function(){return {length:navigator.plugins.length}});`,
    `${sf}("pdfViewerEnabled",function(){return navigator.pdfViewerEnabled});`,
    `${sf}("engine",function(){return {hasMozInnerScreenX:typeof window.mozInnerScreenX!=="undefined",hasChrome:typeof window.chrome!=="undefined"}});`,
    `${sf}("screen",function(){return {width:screen.width,height:screen.height,dpr:devicePixelRatio}});`,
    `${sf}("outerWH",function(){return [outerWidth,outerHeight]});`,
    `${sf}("isExtended",function(){return screen.isExtended===undefined?null:screen.isExtended});`,
    `${sf}("fontWidths",function(){var sp=document.createElement("span");sp.style.cssText="position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap";sp.textContent="mmmmmmmmmmlli WwWwGg @#Xj";document.body.appendChild(sp);var st=${JSON.stringify(PROBE_FONT_STACKS)};var out=[];for(var i=0;i<st.length;i++){sp.style.fontFamily=st[i];out.push(Math.round(sp.getBoundingClientRect().width*100)/100)}document.body.removeChild(sp);return out});`,
    `${sf}("maxTouchPoints",function(){return navigator.maxTouchPoints});`,
    `${sf}("juggler",function(){if(typeof window.mozInnerScreenX!=="number")return null;try{var w=new Worker("chrome://juggler/content");try{w.terminate()}catch(e){}return true}catch(e){return false}});`,
    `${sf}("evalLen",function(){return Function.prototype.toString.call(eval).length});`,
    `${sf}("langs",function(){var l=navigator.languages||[];return [l.length,l[0]===navigator.language]});`,
    `${sf}("activeText",function(){var d=document.createElement("div");d.style.setProperty("color-scheme","light","important");d.style.setProperty("color","ActiveText","important");document.body.appendChild(d);var c=getComputedStyle(d).color;d.remove();return [c,matchMedia("(forced-colors: active)").matches]});`,
    `${sf}("stealth",function(){var f=document.createElement("iframe");f.srcdoc="x";var r=window.chrome&&window.chrome.runtime;var m=r&&r.sendMessage;return {iframe:!!f.contentWindow,runtime:typeof m==="function"&&Object.prototype.hasOwnProperty.call(m,"prototype")}});`,
    `${sf}("lies",function(){var out=[],g=function(o,k){var d=o&&Object.getOwnPropertyDescriptor(o,k);return d&&d.get},N=Navigator.prototype,list=[["webdriver",g(N,"webdriver")],["languages",g(N,"languages")],["plugins",g(N,"plugins")],["hardwareConcurrency",g(N,"hardwareConcurrency")],["vendor",g(N,"vendor")],["platform",g(N,"platform")],["userAgent",g(N,"userAgent")],["permissionsQuery",window.Permissions&&Permissions.prototype.query],["getParameter",window.WebGLRenderingContext&&WebGLRenderingContext.prototype.getParameter],["canPlayType",HTMLMediaElement.prototype.canPlayType],["fnToString",Function.prototype.toString],["contentWindow",g(HTMLIFrameElement.prototype,"contentWindow")]];for(var i=0;i<list.length;i++){var f=list[i][1];if(typeof f!=="function")continue;var bad=Object.prototype.hasOwnProperty.call(f,"prototype")||Object.getOwnPropertyNames(f).sort().join()!=="length,name";if(!bad){var pr=Object.getPrototypeOf(f);try{Object.setPrototypeOf(f,Object.create(f));bad=true}catch(e){}finally{try{Object.setPrototypeOf(f,pr)}catch(e){}}}if(bad)out.push(list[i][0])}return out});`,
    `${sf}("cv",function(){var s=Math.random()*1e9|0,d=function(){var c=document.createElement("canvas");c.width=64;c.height=16;var x=c.getContext("2d"),r=s;for(var i=0;i<24;i++){r=(r*1103515245+12345)&2147483647;x.fillStyle="rgb("+(r&255)+","+(r>>8&255)+","+(r>>16&255)+")";x.fillRect(i*3%64,(r>>4)%16,5,5)}x.font="11px sans-serif";x.fillText("Cap"+s,2,12);return c.toDataURL()};var a=d(),b=d();return [a===b?1:0,a.length]});`,
    `${sf}("na",function(){var f=new Float32Array(1),u=new Uint8Array(f.buffer);f[0]=Infinity;f[0]=f[0]-f[0];return u[3]});`,
    `${sf}("ig",function(){var f=document.createElement("iframe");f.style.display="none";document.body.appendChild(f);try{var w=f.contentWindow,k=Object.getOwnPropertyNames(w),i=k.lastIndexOf("webkitResolveLocalFileSystemURL"),o=[];if(i<0)return null;for(var j=i+1;j<k.length&&o.length<12;j++){var n=k[j],v=null;if(n==="chrome")continue;try{v=w[n]}catch(e){}if(typeof v==="function"&&/\\[native code\\]/.test(Function.prototype.toString.call(v)))continue;o.push(n.slice(0,40))}return o}finally{f.remove()}});`,
    `${sf}("sd",function(){var o=[],gd=Object.getOwnPropertyDescriptor,gn=Object.getOwnPropertyNames;try{if(gn(screen).length)o.push("screen")}catch(e){}try{if(gn(navigator).length)o.push("navigator")}catch(e){}try{if(gd(document,"createElement"))o.push("createElement")}catch(e){}try{var l=gd(Navigator.prototype,"languages");if(l&&(!l.get||"value" in l||l.set))o.push("languages")}catch(e){}try{if(new Event("x").isTrusted!==false)o.push("isTrusted")}catch(e){}try{if(typeof objectToInspect!=="undefined")o.push("objectToInspect")}catch(e){}try{var fr=document.createElement("iframe");fr.style.display="none";document.body.appendChild(fr);try{var w=fr.contentWindow,ts=w.Function.prototype.toString,g=gd(w.Navigator.prototype,"hardwareConcurrency").get,bad=false;delete w.Function;delete w.Object;try{ts.call(g)}catch(e){bad=true}if(bad)o.push("toStringProxy")}finally{fr.remove()}}catch(e){}return o});`,
    `${sf}("no",function(){var k=Object.getOwnPropertyNames(Navigator.prototype),c=k.indexOf("constructor"),w=["webdriver","userAgent","platform","languages","language","plugins","mimeTypes","hardwareConcurrency","vendor","appVersion"],o=[];if(c<0)return null;for(var i=0;i<w.length;i++)if(k.indexOf(w[i])>c)o.push(w[i]);return o});`,
    `${sf}("glsh",function(){var c=document.createElement("canvas").getContext("webgl");if(!c)return null;var o={r:null,t:null};try{var x=c.getExtension("WEBGL_debug_renderer_info");o.r=x?String(c.getParameter(x.UNMASKED_RENDERER_WEBGL)).slice(0,120):null;var ds=c.getExtension("WEBGL_debug_shaders");if(ds){var s=c.createShader(c.VERTEX_SHADER);c.shaderSource(s,"attribute vec4 p;void main(){gl_Position=p;}");c.compileShader(s);var t=ds.getTranslatedShaderSource(s)||"";o.t=/metal_stdlib/.test(t)?"metal":/\\bfloat4\\b|SV_Position/.test(t)?"hlsl":/#version|gl_Position/.test(t)?"glsl":t?"other":""}}finally{var lc=c.getExtension("WEBGL_lose_context");if(lc)lc.loseContext()}return o});`,
    `${sf}("fm",function(){var sp=document.createElement("span");sp.style.cssText="position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap;font-family:'zxqv cap missing'";sp.textContent="mmmmmmmmmmlli WwWwGg @#Xj";document.body.appendChild(sp);var w=Math.round(sp.getBoundingClientRect().width*100)/100;sp.remove();return w});`,
    `${sf}("em",function(){var sp=document.createElement("span");sp.style.cssText="position:absolute;left:-9999px;top:-9999px;font-size:64px;line-height:normal;white-space:nowrap";sp.textContent="\u{1F600}\u{1F44D}\u{1F3FD}";document.body.appendChild(sp);var r=sp.getBoundingClientRect();sp.remove();return [Math.round(r.width*100)/100,Math.round(r.height*100)/100]});`,
    `${sf}("tamper",function(){return {getParameterWebGL:${nat}(WebGLRenderingContext.prototype.getParameter),toDataURL:${nat}(HTMLCanvasElement.prototype.toDataURL),getImageData:${nat}(CanvasRenderingContext2D.prototype.getImageData),permissionsQuery:navigator.permissions?${nat}(navigator.permissions.query):true,fnToString:${nat}(Function.prototype.toString)}});`,
  ];
  shuffle(fields);
  const nv = rVar();
  const gpP = rVar();
  const vcP = rVar();
  const collect = `function(){var n=navigator,tz=null,b=null;try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}try{b=n.userAgentData?n.userAgentData.brands.map(function(x){return x.brand+"/"+x.version}).join(","):null}catch(e){}var gl=null;try{var c=new OffscreenCanvas(1,1).getContext("webgl");if(c){var x=c.getExtension("WEBGL_debug_renderer_info");gl=x?c.getParameter(x.UNMASKED_RENDERER_WEBGL):null;var lc=c.getExtension("WEBGL_lose_context");if(lc)lc.loseContext()}}catch(e){}return {ua:n.userAgent,platform:n.platform,languages:(n.languages||[]).join(","),hc:n.hardwareConcurrency,tz:tz,brands:b,brave:!!n.brave,ddg:typeof n.duckduckgo==="object",gl:gl}}`;
  return (
    `var ${P}={};function ${sf}(k,f){try{${P}[k]=f()}catch(e){${P}[k]=null}}` +
    `function ${nat}(fn){try{return /\\{\\s*\\[native code\\]\\s*\\}/.test(Function.prototype.toString.call(fn))}catch(e){return true}}` +
    fields.join("") +
    `var ${nv}=${collect};${sf}("mainNav",${nv});` +
    `var ${gpP}=new Promise(function(r){try{var g=navigator.gpu;if(!g){r(null);return}var t=setTimeout(function(){r(null)},900);g.requestAdapter().then(function(a){clearTimeout(t);if(!a){r({v:"",a:"",f:false,n:true});return}var i=a.info||{};r({v:String(i.vendor||"").slice(0,32),a:String(i.architecture||"").slice(0,32),f:!!(i.isFallbackAdapter||a.isFallbackAdapter),n:false})},function(){clearTimeout(t);r(null)})}catch(e){r(null)}});` +
    `var ${vcP}=new Promise(function(r){try{var s=speechSynthesis,f=function(){var v=s.getVoices();if(!v.length)return false;var g=0;for(var i=0;i<v.length;i++)if(/^Google /.test(v[i].name))g++;r([v.length,g]);return true};if(f())return;var t=setTimeout(function(){r(null)},900);s.addEventListener("voiceschanged",function(){if(f())clearTimeout(t)})}catch(e){r(null)}});` +
    `${P}.hev=await new Promise(function(r){var u=navigator.userAgentData;if(!u||!u.getHighEntropyValues){r(null);return}var t=setTimeout(function(){r(null)},1000);u.getHighEntropyValues(["platformVersion","architecture","uaFullVersion","bitness","fullVersionList"]).then(function(v){clearTimeout(t);r({pv:v.platformVersion||"",ar:v.architecture||"",fv:v.uaFullVersion||"",bi:v.bitness||"",fl:(v.fullVersionList||[]).map(function(x){return x.brand}).join(",")})},function(){clearTimeout(t);r(null)})});` +
    `${P}.workerNav=await new Promise(function(r){var w,t,u;function d(v){clearTimeout(t);try{if(w)w.terminate()}catch(x){}try{if(u)URL.revokeObjectURL(u)}catch(x){}r(v)}try{u=URL.createObjectURL(new Blob([${JSON.stringify(`postMessage((${collect})())`)}],{type:"text/javascript"}));w=new Worker(u)}catch(e){d(null);return}t=setTimeout(function(){d(null)},1500);w.onmessage=function(e){d(e.data&&typeof e.data==="object"?e.data:null)};w.onerror=function(){d(null)}});` +
    `${P}.gpu=await ${gpP};${P}.voices=await ${vcP};`
  );
}

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
  const navOwnHashes = NAV_OWN_PROP_MARKERS.map(h);
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

  {
    const a = rVar();
    checks.push(
      `if (!${b}) { try { var ${a} = ${JSON.stringify(navOwnHashes)}; for (const k of Object.getOwnPropertyNames(navigator)) { if (${hSet}(${a}, ${hF}(k)) && !(${hF}(k) === ${h("hardwareConcurrency")} && typeof navigator.brave === "object" && (function () { var d = Object.getOwnPropertyDescriptor(navigator, k), g = Object.getOwnPropertyDescriptor(Navigator.prototype, k); return !!d && !d.get && !d.set && !d.writable && !d.configurable && Number.isInteger(d.value) && d.value >= 2 && !!g && !!g.get && d.value <= g.get.call(navigator); })())) { ${b} = true; break; } } } catch { ${b} = true; } }`,
    );
  }

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

  return `let ${b} = false;try {${checks.join("")}} catch {${b} = true} if (${b}) {parent.postMessage({ type: 'cap:instr', nonce: ${JSON.stringify(id)}, result: '', blocked: true }, '*');return;}`;
}

const CDP_PROBE = `function(E,C,w,n){var p=0,k=0,e,s=Object.getOwnPropertyDescriptor(E,"prepareStackTrace");if(!s||s.configurable){Object.defineProperty(E,"prepareStackTrace",{configurable:true,writable:true,value:function(x){if(x===e)p++;return String(x)}});try{for(var i=0;i<3;i++){e=new E("x");C.debug(e)}}finally{if(s)Object.defineProperty(E,"prepareStackTrace",s);else delete E.prepareStackTrace}}var X=class extends E{get name(){k++;return "Error"}};for(var j=0;j<3;j++)C.debug(new X("x"));return p>0||(k>6&&(typeof w.chrome!=="undefined"||!!n.userAgentData))}`;

const COLLECTOR_HEAD = `function($W,$F,$cfg,$cdp){
var $ap=Reflect.apply,$gopd=Object.getOwnPropertyDescriptor,$ael=$F.EventTarget.prototype.addEventListener,$rel0=$F.EventTarget.prototype.removeEventListener,$fnow=$F.Performance.prototype.now,$tsg=$gopd($F.Event.prototype,"timeStamp").get;
var $gets={};["performance","innerWidth","innerHeight"].forEach(function($k){try{var $d=$gopd($F,$k)||$gopd($F.Window.prototype,$k);if($d&&$d.get)$gets[$k]=$d.get}catch($x){}});
var $read=function($o,$k){try{return $o[$k]}catch($x){}try{if($gets[$k])return $ap($gets[$k],$o,[])}catch($x){}return null};
var $D=$W.document,$perf=$read($W,"performance"),$offs=[],$seen=[],$opt={capture:true,passive:true},$mo=null,$io=null,$ia=null,$trace=null;
var $pnow=function(){try{return $ap($fnow,$perf,[])}catch($x){return $ap($fnow,$F.performance,[])}};
var $origin=$pnow();
var $on=function($t,$y,$f,$o){var $p=$o||$opt,$g=function($e){try{$ap($tsg,$e,[])}catch($x){return}return $ap($f,this,[$e])};$ap($ael,$t,[$y,$g,$p]);$offs.push(function(){$ap($rel0,$t,[$y,$g,$p])})};
var $mark=function($c){if($seen.indexOf($c)<0)$seen.push($c)};
var $scan=function($r){for(var $i=0;$i<$cfg.marks.length;$i++){var $m=$cfg.marks[$i];if($seen.indexOf($m[0])>=0)continue;try{if(($m[1]&&(($r.matches&&$r.matches($m[1]))||($r.querySelector&&$r.querySelector($m[1]))))||($m[2]&&$m[2].some(function($g){return $g.indexOf("navigator.")===0?$g.slice(10) in $W.navigator:$g in $W})))$mark($m[0])}catch($e){}}};
var $comet=function(){try{var $h=$D.body||$D.documentElement;if($seen.indexOf("comet")>=0||!$h)return;var $d=$D.createElement("div");$d.id="pplx-agent-0_0-overlay-stop-button";$d.style.cssText="position:absolute;left:-99999px;visibility:hidden";$h.appendChild($d);var $s=$W.getComputedStyle($d);if($s.zIndex==="2147483647"&&$s.minHeight==="32px")$mark("comet");$d.remove()}catch($e){}};
var $sens=function($e){try{var $t=$e.composedPath()[0];return !!($t&&$t.closest&&$t.closest($cfg.sens))}catch($x){return false}};
if($cfg.ia){try{var $cnt=[0,0];var $syn=function($e){if($e.isTrusted||$sens($e))return;if($e.type==="click")$cnt[0]=Math.min(255,$cnt[0]+1);else $cnt[1]=Math.min(255,$cnt[1]+1)};$on($W,"click",$syn);$on($W,"keydown",$syn);$ia=$cnt}catch($x){$ia=null}}
`;

const COLLECTOR_TRACE = `if($cfg.bh){try{$trace=(function(){
var $moves=[],$keys=[],$open=new Map(),$recent=[],$n=[0,0,0,0,0,0,0,0,0,0,0],$lastKey=-Infinity,$shift=false,$lsi=-Infinity,$ls=-Infinity,$us=-1,$sx=$W.scrollX,$sy=$W.scrollY,$act=null,$vis=-1,$press=null,$pt={mouse:0,pen:1,touch:2};
var $rel=function($t){return Math.max(0,Math.round(($t-$origin)*10)/10)};
var $r1=function($x){return Math.round($x*10)/10};
var $r2=function($x){return Math.round($x*100)/100};
var $ptype=function($e){return Object.prototype.hasOwnProperty.call($pt,$e.pointerType)?$pt[$e.pointerType]:0};
var $touch=function($t){$recent.push($rel($t));if($recent.length>16)$recent.shift()};
var $judge=function($t){if(!($t-$lsi<1000||$t-$origin<1000)){$n[7]++;$us=$rel($t)}};
var $check=function($t){var $x=$W.scrollX,$y=$W.scrollY;if($x===$sx&&$y===$sy)return;$sx=$x;$sy=$y;if($t-$ls>150)$judge($t);$ls=$t};
var $hidden=function(){return $D.visibilityState==="hidden"?1:0};
$on($W,"pointermove",function($e){if(!$e.isTrusted)return;if($e.pointerType==="touch"||$e.pointerType==="pen")$lsi=$e.timeStamp;$check($e.timeStamp);$n[4]++;$touch($e.timeStamp);var $c=1;try{$c=$e.getCoalescedEvents?$e.getCoalescedEvents().length:1}catch($x){}$moves.push([$rel($e.timeStamp),$r2($e.clientX),$r2($e.clientY),Math.min($c,1000),$ptype($e)]);if($moves.length>320)$moves.shift()});
$on($W,"pointerdown",function($e){if(!$e.isTrusted)return;$n[6]++;$check($e.timeStamp);$lsi=$e.timeStamp;$touch($e.timeStamp)});
$on($W,"click",function($e){if(!$e.isTrusted)$n[0]++});
$on($W,"keydown",function($e){if(!$e.isTrusted){$n[1]++;return}$touch($e.timeStamp);$lsi=$e.timeStamp;$check($e.timeStamp);$lastKey=$e.timeStamp;if($e.key==="Shift")$shift=true;if($e.repeat||$e.isComposing||$sens($e))return;if($e.shiftKey&&!$shift&&$e.key&&$e.key.length===1&&$e.key!==$e.key.toLowerCase())$n[10]++;$n[5]++;var $en=[$rel($e.timeStamp),-1];$keys.push($en);if($keys.length>64)$keys.shift();$open.set($e.code||$e.key,$en)});
$on($W,"keyup",function($e){if(!$e.isTrusted)return;if($e.key==="Shift")$shift=false;var $id=$e.code||$e.key,$en=$open.get($id);if(!$en)return;$open.delete($id);$en[1]=Math.min(60000,$r1($rel($e.timeStamp)-$en[0]))});
$on($W,"wheel",function($e){if(!$e.isTrusted)return;$n[2]++;$lsi=$e.timeStamp;$check($e.timeStamp);$touch($e.timeStamp)});
$on($W,"scroll",function($e){var $t=$e.timeStamp,$mv=$W.scrollX!==$sx||$W.scrollY!==$sy;$sx=$W.scrollX;$sy=$W.scrollY;if($mv&&$t-$ls>150)$judge($t);$ls=$t});
$on($W,"paste",function(){$n[3]++});
$on($W,"input",function($e){if(!$e.isTrusted){$n[9]++;return}if($e.inputType==="insertText"&&!$e.isComposing&&$e.timeStamp-$lastKey>50&&!$sens($e))$n[8]++});
var $trg=null;try{var $rt=$F.frameElement&&$F.frameElement.getRootNode();$trg=$rt&&$rt!==$D&&$rt.querySelector?$rt.querySelector(".captcha-trigger"):null}catch($x){}
if($trg){
try{$io=new $W.IntersectionObserver(function($es){for(var $i=0;$i<$es.length;$i++){if($es[$i].isIntersecting&&$vis<0){$vis=$rel($es[$i].time);$io.disconnect()}}});$io.observe($trg)}catch($x){}
var $pa=function($e){var $r=$trg.getBoundingClientRect();return {k:0,tr:$e.isTrusted?1:0,hid:$hidden(),pt:$ptype($e),t:$rel($e.timeStamp),u:-1,x:$r1($e.clientX),y:$r1($e.clientY),cx:$r1($e.clientX-($r.left+$r.width/2)),cy:$r1($e.clientY-($r.top+$r.height/2)),w:$r1($r.width),h:$r1($r.height),sox:$r1($e.screenX-$e.clientX),soy:$r1($e.screenY-$e.clientY),cw:$r1(Math.min(10000,$e.width||0)),ch:$r1(Math.min(10000,$e.height||0)),pr:Math.max(0,Math.min(1,$e.pressure||0))}};
var $po={passive:true};
$on($trg,"pointerdown",function($e){if($e.button!==0)return;$press=$pa($e)},$po);
$on($trg,"pointerup",function($e){if($press&&$press.u<0)$press.u=$rel($e.timeStamp);if(!$e.isTrusted&&$press)$press.tr=0},$po);
$on($trg,"click",function($e){var $t=$rel($e.timeStamp);if($press&&$t-$press.t<5000){if(!$e.isTrusted)$press.tr=0;$act=$press}else if(!($act&&$act.k===1&&$t-$act.t<1000)){$act={k:2,tr:$e.isTrusted?1:0,hid:$hidden(),t:$t,u:-1}}$press=null},$po);
$on($trg,"keydown",function($e){if($e.target!==$trg||$e.repeat)return;if($e.key!=="Enter"&&$e.key!==" ")return;var $a={k:1,tr:$e.isTrusted?1:0,hid:$hidden(),t:$rel($e.timeStamp),u:-1};$act=$a;var $cd=$e.code||$e.key;var $up=function($v){if(($v.code||$v.key)!==$cd)return;$a.u=$rel($v.timeStamp);$W.removeEventListener("keyup",$up,true)};$W.addEventListener("keyup",$up,true);$offs.push(function(){$W.removeEventListener("keyup",$up,true)})},$po);
}
return function(){var $a=$act,$at=$a?$a.t:Infinity,$last=0;for(var $i=0;$i<$recent.length;$i++){var $t=$recent[$i];if($t<$at-100&&$t>$last)$last=$t}var $fs=0;try{$fs=$D.fullscreenElement?1:0}catch($x){}var $best=Infinity,$dl=Date.now()+5;for(var $j=0;$j<3&&Date.now()<$dl;$j++){var $p=$pnow(),$q=$p;while($q===$p&&Date.now()<$dl)$q=$pnow();if($q>$p)$best=Math.min($best,$q-$p)}
return {v:1,res:isFinite($best)?Math.min(1000,$r1($best*1000)/1000):1000,now:$rel($pnow()),vis:$vis>=0?$vis:-1,last:$a?$last:-1,us:$us,env:[$W.innerWidth,$W.innerHeight,$r1($W.devicePixelRatio||1),$W.matchMedia&&$W.matchMedia("(pointer: fine)").matches?1:0,$fs,$W.outerHeight-$W.innerHeight,$W.screenX||0,$W.screenY||0],n:$n.slice(),m:$moves,k:$keys,a:$a}};
})()}catch($x){$trace=null}}
`;

const COLLECTOR_TAIL = `try{$scan($D)}catch($x){}$comet();
if($cfg.bh||$cfg.ia){try{$mo=new $W.MutationObserver(function($rs){for(var $i=0;$i<$rs.length;$i++){var $r=$rs[$i];if($r.type==="attributes"){if(Object.prototype.hasOwnProperty.call($cfg.attrs,$r.attributeName))$mark($cfg.attrs[$r.attributeName]);continue}for(var $j=0;$j<$r.addedNodes.length;$j++){if($r.addedNodes[$j].nodeType===1)$scan($r.addedNodes[$j])}}});$mo.observe($D.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:Object.keys($cfg.attrs)})}catch($x){}}
return {
host:function(){var $o={};try{var $nv=$W.navigator;$o.nav={ua:$nv.userAgent,platform:$nv.platform,languages:($nv.languages||[]).join(","),hc:$nv.hardwareConcurrency,brands:$nv.userAgentData?$nv.userAgentData.brands.map(function($x){return $x.brand+"/"+$x.version}).join(","):null,webdriver:$nv.webdriver===true,ddg:typeof $nv.duckduckgo==="object"}}catch($x){}try{var $en=$F.Performance.prototype.getEntriesByType.call($perf,"navigation")[0];$o.doc=!!$en&&$en.nextHopProtocol===""&&$en.transferSize>0&&($en.deliveryType||"")===""&&$en.workerStart===0}catch($x){}try{$o.cdp=!!$cdp($W.Error,$W.console,$W,$W.navigator)}catch($x){}try{var $at=$D.documentElement.attributes,$an=[];for(var $i=0;$i<$at.length&&$an.length<16;$i++)$an.push(String($at[$i].name).slice(0,48));$o.ha=$an}catch($x){}return $o},
marks:function(){try{$scan($D)}catch($x){}$comet();return $seen.slice()},
vp:function(){var $w=$read($W,"innerWidth"),$h=$read($W,"innerHeight");return typeof $w==="number"&&typeof $h==="number"?[$w,$h]:null},
ia:function(){return $ia?$ia.slice():null},
trace:function(){return $trace?$trace():null},
stop:function(){for(var $i=0;$i<$offs.length;$i++){try{$offs[$i]()}catch($x){}}$offs=[];if($mo)$mo.disconnect();if($io)$io.disconnect()}
}}`;

const WASM_PROBE = `(function(){try{return new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0])) instanceof WebAssembly.Module?1:0}catch(e){return 0}})()`;

const NATIVE_PRELUDE = String.raw`var $ap,$keys,$isArr,$sort,$cca,$fcc,$nts,$pnow,$pobj,$P,$ce=0;
var $ok=(function(){try{var $fts=Function.prototype.toString,$app=Reflect.apply,$idx=String.prototype.indexOf;
var $nat=function($f){return typeof $f==="function"&&$app($idx,$app($fts,$f,[]),["[native code]"])>0};
var $list=[$fts,$app,$idx,Object.keys,Array.isArray,Array.prototype.sort,Array.prototype.slice,Array.prototype.indexOf,Array.prototype.push,String.prototype.charCodeAt,String.fromCharCode,Number.prototype.toString,Object.freeze,Object.defineProperty,Performance.prototype.now,JSON.parse,Math.round,Math.max,Math.min,eval,Function,EvalError,Object.getOwnPropertyDescriptor(Event.prototype,"timeStamp").get];
if(typeof EventTarget.prototype.addEventListener!=="function")return false;
for(var $i=0;$i<$list.length;$i++)if(!$nat($list[$i]))return false;
var $EE=EvalError,$ev=null,$fn=null;
$app(EventTarget.prototype.addEventListener,document,["securitypolicyviolation",function($e){try{if($ce===1&&$e.isTrusted&&$e.blockedURI==="eval"&&$app($idx,""+$e.violatedDirective,["script-src"])===0)$ce=2}catch($x){}},true]);
try{(0,eval)("0")}catch($x){$ev=$x}
try{Function("")}catch($x){$fn=$x}
if(($ev===null)!==($fn===null))return false;
if($ev!==null){if(!($ev instanceof $EE)||!($fn instanceof $EE))return false;$ce=1}
$ap=$app;$keys=Object.keys;$isArr=Array.isArray;$sort=Array.prototype.sort;$cca=String.prototype.charCodeAt;$fcc=String.fromCharCode;$nts=Number.prototype.toString;$pnow=Performance.prototype.now;$pobj=performance;$P=parent;
var $fz=Object.freeze,$dp=Object.defineProperty;
var $objs=[Object.prototype,Array.prototype,String.prototype,Number.prototype,Boolean.prototype,Function.prototype,Promise.prototype,Performance.prototype,Object,Array,String,Number,JSON,Math,Reflect,Promise];
for(var $j=0;$j<$objs.length;$j++)$fz($objs[$j]);
var $g=["Object","Array","String","Number","JSON","Math","Reflect","Promise","Function","performance","parent"];
for(var $k=0;$k<$g.length;$k++){try{$dp(window,$g[$k],{value:window[$g[$k]],writable:false,configurable:false})}catch($x){}}
return true}catch($x){return false}})();
var $now=function(){return $ap($pnow,$pobj,[])};
var $Q=function($s){var $o='"';for(var $i=0;$i<$s.length;$i++){var $c=$ap($cca,$s,[$i]);if($c===34)$o+='\\"';else if($c===92)$o+='\\\\';else if($c<32)$o+=$c===8?'\\b':$c===12?'\\f':$c===10?'\\n':$c===13?'\\r':$c===9?'\\t':'\\u00'+($c<16?'0':'')+$ap($nts,$c,[16]);else if($c>=55296&&$c<=57343){var $n=$i+1<$s.length?$ap($cca,$s,[$i+1]):0;if($c<=56319&&$n>=56320&&$n<=57343){$o+=$fcc($c,$n);$i++}else $o+='\\u'+$ap($nts,$c,[16])}else $o+=$fcc($c)}return $o+'"'};
var $S=function($v){if($v===null)return "null";var $t=typeof $v;if($t==="boolean")return $v?"true":"false";if($t==="number")return $v===$v&&$v!==1/0&&$v!==-1/0?""+$v:"null";if($t==="string")return $Q($v);if($t!=="object")return undefined;var $o,$i,$x;if($isArr($v)){$o="[";for($i=0;$i<$v.length;$i++){$x=$S($v[$i]);$o+=($i?",":"")+($x===undefined?"null":$x)}return $o+"]"}var $k=$ap($sort,$keys($v),[]),$f=true;$o="{";for($i=0;$i<$k.length;$i++){$x=$S($v[$k[$i]]);if($x===undefined)continue;$o+=($f?"":",")+$Q($k[$i])+":"+$x;$f=false}return $o+"}"};
var $H=function($s,$seed){var $h=$seed>>>0;for(var $i=0;$i<$s.length;$i++){$h^=$ap($cca,$s,[$i]);$h=($h+($h<<1)+($h<<4)+($h<<7)+($h<<8)+($h<<24))>>>0}return $h>>>0};
`;

function randomizeNames(src, names = new Map()) {
  const used = new Set(names.values());
  return src.replace(/\$[A-Za-z][A-Za-z0-9]*/g, (m) => {
    if (!names.has(m)) {
      let v = rVar();
      while (used.has(v)) v = rVar();
      used.add(v);
      names.set(m, v);
    }
    return names.get(m);
  });
}

function buildAgentScan(agAll, hF, hSet, h) {
  const add = rVar();
  const cdpProbe = rVar();
  const c = rVar();
  const i = rVar();
  const list = rVar();
  const el = rVar();
  const cs = rVar();
  const err = rVar();
  const winHashes = JSON.stringify(WINDOW_PROP_MARKERS.map(h));
  const prefixHashes = JSON.stringify(WINDOW_PREFIX_MARKERS.map(h));
  const frameGlobals = AGENT_MARKS.filter((m) => m[2]).map((m) => [m[0], m[2]]);
  const parts = [
    `try{var ${list}=${JSON.stringify(frameGlobals)};for(var ${i}=0;${i}<${list}.length;${i}++){if(${list}[${i}][1].some(function(${c}){return ${c}.indexOf("navigator.")===0?${c}.slice(10) in navigator:${c} in window}))${add}(${list}[${i}][0])}}catch(${err}){}`,
    `try{var ${list}=Object.getOwnPropertyNames(window);for(var ${i}=0;${i}<${list}.length;${i}++){var ${c}=${list}[${i}];if(${hSet}(${winHashes},${hF}(${c}))||${hSet}(${prefixHashes},${hF}(${c}.slice(0,4)))||${hSet}(${prefixHashes},${hF}(${c}.slice(0,5)))||${hSet}(${prefixHashes},${hF}(${c}.slice(0,10)))){${add}("automation");break}}}catch(${err}){}`,
    `try{var ${el}=document.createElement("div");${el}.id="pplx-agent-0_0-overlay-stop-button";${el}.style.cssText="position:absolute;left:-99999px;visibility:hidden";document.body.appendChild(${el});var ${cs}=getComputedStyle(${el});if(${cs}.zIndex==="2147483647"&&${cs}.minHeight==="32px")${add}("comet");${el}.remove()}catch(${err}){}`,
    `try{if(${cdpProbe}(Error,console,window,navigator))${add}("cdp_trap")}catch(${err}){}`,
    `try{if(!/\\{\\s*\\[native code\\]\\s*\\}/.test(Function.prototype.toString.call(Element.prototype.attachShadow)))${add}("shadow_patched")}catch(${err}){}`,
  ];
  return `var ${add}=function(${c}){if(${agAll}.indexOf(${c})<0)${agAll}.push(${c})};var ${cdpProbe}=${CDP_PROBE};${shuffle(parts).join("")}`;
}

function buildClientScript({
  id,
  vars,
  initVals,
  clientEqs,
  blockAutomatedBrowsers,
  checkSeed,
  seedKeys,
  salts,
  fold,
  cfg,
  noWasm,
}) {
  const h = hashWith(checkSeed);
  const pn = new Map();
  const prelude = randomizeNames(NATIVE_PRELUDE, pn);
  const N = (k) => pn.get(k);
  const hF = rVar();
  const hSet = rVar();
  const evalLocalVar = rVar();
  const evalSecret = randomInt(1_000_000, 0x7fffffff);
  const evalA = rVar();
  const evalB = rVar();
  const evalC = rVar();
  const helpers =
    `function ${hF}(s){return ${N("$H")}(s,${checkSeed})}` +
    `function ${hSet}(a,v){for(var i=0;i<a.length;i++)if(a[i]===v)return true;return false;}`;

  const blockChecks = blockAutomatedBrowsers
    ? buildBlockChecks(rVar(), id, hF, hSet, h)
    : "";

  const dvKey = rVar();
  const nKey = rVar();
  const outKey = rVar();
  const pKey = rVar();
  const agAll = rVar();
  const col = rVar();
  const fin = rVar();
  const finP = rVar();
  const t0 = rVar();
  const data = rVar();
  const ser = rVar();
  const g1 = rVar();
  const g2 = rVar();
  const mk = rVar();
  const st = rVar();
  const res = rVar();
  const emit = rVar();
  const lw = rVar();
  const iso = rVar();
  const nonce = JSON.stringify(id);
  const mix = vars.map((v) => `${dvKey}[${JSON.stringify(v)}]`).join('+","+');
  const observe = cfg.bh === 1 || cfg.ia === 1;
  const agentScan = buildAgentScan(agAll, hF, hSet, h);

  const envChecks = [
    `try { const ${nKey}st = (new Error()).stack || ''; if (${nKey}st.indexOf('node:internal') !== -1 || ${nKey}st.indexOf('moduleEvaluation') !== -1 || ${nKey}st.indexOf('loadAndEvaluateModule') !== -1 || ${nKey}st.indexOf('file:///') !== -1 || ${nKey}st.indexOf('[eval]') !== -1 || /\\(native:/.test(${nKey}st)) return null; } catch { return null }`,

    `if (typeof HTMLElement !== 'function' || typeof Window !== 'function' || typeof Document !== 'function' || typeof Navigator !== 'function' || typeof Node !== 'function') return null; if (!(navigator instanceof Navigator) || !(document instanceof Document) || !(window instanceof Window) || !(document.body instanceof HTMLElement)) return null; if (globalThis !== window || window.self !== window || document.defaultView !== window) return null;`,

    `try { const ${nKey}ots = Object.prototype.toString; if (${hF}(${nKey}ots.call(navigator)) !== ${h("[object Navigator]")} || ${hF}(${nKey}ots.call(window)) !== ${h("[object Window]")} || ${hF}(${nKey}ots.call(document)) !== ${h("[object HTMLDocument]")}) return null; } catch { return null }`,

    `try { if (typeof EventTarget !== 'function' || !(document.body instanceof EventTarget) || !(window instanceof EventTarget)) return null; const ${nKey}probe = document.createElement('div'); let ${nKey}fired = 0; const ${nKey}ev = '_c' + (Date.now() & 0xffff).toString(36); const ${nKey}h = (e) => { if (e && e.detail === 0xc0de) ${nKey}fired++; }; ${nKey}probe.addEventListener(${nKey}ev, ${nKey}h); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); ${nKey}probe.removeEventListener(${nKey}ev, ${nKey}h); ${nKey}probe.dispatchEvent(new CustomEvent(${nKey}ev, { detail: 0xc0de })); if (${nKey}fired !== 2) return null; } catch { return null }`,

    `if (!${N("$ce")}) { try { const ${nKey}gf = new Function('return this'); const ${nKey}tg = ${nKey}gf(); if (${nKey}tg !== globalThis) return null; const ${nKey}leakHashes = ${JSON.stringify(["Bun", "process", "module", "require", "global", "__dirname", "Deno"].map(h))}; for (const ${nKey}k of Object.getOwnPropertyNames(${nKey}tg)) { if (${hSet}(${nKey}leakHashes, ${hF}(${nKey}k))) return null; } const ${nKey}fnArgs = new Function('a','b','c','return a+b+c'); if (${nKey}fnArgs.length !== 3) return null; if (${nKey}fnArgs(10,20,30) !== 60) return null; const ${nKey}src = Function.prototype.toString.call(${nKey}fnArgs); if (${nKey}src.indexOf('return a+b+c') === -1) return null; if (${nKey}src.indexOf('apply') !== -1 || ${nKey}src.indexOf('callArgs') !== -1 || ${nKey}src.indexOf('Reflect.') !== -1) return null; let ${nKey}thrown = null; try { new Function('throw new Error("x")')(); } catch (${nKey}e) { ${nKey}thrown = ${nKey}e; } if (!${nKey}thrown || !${nKey}thrown.stack) return null; const ${nKey}st2 = ${nKey}thrown.stack; if (${nKey}st2.indexOf('node:internal') !== -1 || ${nKey}st2.indexOf('moduleEvaluation') !== -1 || ${nKey}st2.indexOf('file:///') !== -1 || ${nKey}st2.indexOf('[eval]') !== -1 || /\\(native:/.test(${nKey}st2)) return null; } catch { return null } }`,

    `if (!${N("$ce")}) { try { const ${nKey}ie = (0, eval); const ${nKey}eg = ${nKey}ie('this'); if (${nKey}eg !== globalThis) return null; const ${nKey}leak2 = ${JSON.stringify(["Bun", "process", "require", "global", "__dirname", "Deno"].map(h))}; for (const ${nKey}k of Object.getOwnPropertyNames(${nKey}eg)) { if (${hSet}(${nKey}leak2, ${hF}(${nKey}k))) return null; } } catch { return null } }`,

    `try { const ${nKey}sg = (function () { return this; })(); if (!${nKey}sg || ${nKey}sg !== globalThis || ${nKey}sg !== window) return null; const ${nKey}leak3 = ${JSON.stringify(["Bun", "process", "module", "require", "global", "__dirname", "Deno"].map(h))}; for (const ${nKey}k of Object.getOwnPropertyNames(${nKey}sg)) { if (${hSet}(${nKey}leak3, ${hF}(${nKey}k))) return null; } } catch { return null }`,

    `if (!${N("$ce")}) { try { if (!new Function(${JSON.stringify(`try { var ${evalLocalVar} = ${evalSecret}; var ${evalA} = '${evalLocalVar.slice(0, 2)}'; var ${evalB} = '${evalLocalVar.slice(2)}'; var ${evalC} = ${evalA} + ${evalB}; var ${evalLocalVar}r1 = (0, eval)('typeof ' + ${evalC}); if (${evalLocalVar}r1 !== 'undefined') return false; var ${evalLocalVar}r2 = eval(${evalC}); if (${evalLocalVar}r2 !== ${evalSecret}) return false; var ${evalLocalVar}r3 = eval(${evalA} + ${evalB} + '+1'); if (${evalLocalVar}r3 !== ${evalSecret + 1}) return false; var ${evalLocalVar}arr = ['(', '(', ')', '=', '>', 't', 'h', 'i', 's', ')', '(', ')']; var ${evalLocalVar}arrow = (0, eval)(${evalLocalVar}arr.join('')); if (${evalLocalVar}arrow !== globalThis) return false; var ${evalLocalVar}r4 = eval('(function(){return ' + ${evalC} + '*2;})()'); if (${evalLocalVar}r4 !== ${evalSecret * 2}) return false; return true; } catch { return false }`)})()) return null; } catch { return null } }`,
  ];

  const folds = vars
    .map((v, i) => {
      const k = JSON.stringify(v);
      const extra = `${i === fold[0] ? `^${g1}` : ""}${i === fold[1] ? `^${g2}` : ""}`;
      return `${st}[${k}]=((${dvKey}[${k}]^${salts[i]}${extra})&0x7FFFFFFF)%900000+100000;`;
    })
    .join("");

  const collected = shuffle([
    `v:1`,
    `el:Math.max(0,Math.round(${N("$now")}()-${t0}))`,
    `p:${pKey}`,
    `vp:${col}?${col}.vp():null`,
    `hp:${col}?${col}.host():null`,
    `ag:${agAll}.slice(0,${MAX_BOUND_CODES})`,
    `ce:${N("$ce")}`,
    `ia:${cfg.ia ? `${col}?${col}.ia():null` : "null"}`,
    `bh:${cfg.bh ? `${col}?${col}.trace():null` : "null"}`,
    ...(noWasm ? [`wa:${WASM_PROBE}`] : []),
  ]).join(",");

  const post = (m) => `${N("$P")}.postMessage(${m},"*")`;
  return `(function(){${prelude}if(!${N("$ok")}){parent.postMessage({type:"cap:error",nonce:${nonce},reason:"natives_tampered"},"*");return}${helpers}var ${iso}=0;try{${N("$P")}.document.nodeType}catch(e){${iso}=1}var ${t0}=${N("$now")}(),${fin},${finP}=new Promise(function(r){${fin}=r}),${col}=null;window.addEventListener("message",function(e){var d=e.data;if(e.source===${N("$P")}&&d&&d.type==="cap:finalize"&&d.nonce===${nonce})${fin}()});try{${col}=(${randomizeNames(`${COLLECTOR_HEAD}${cfg.bh ? COLLECTOR_TRACE : ""}${COLLECTOR_TAIL}`)})(${iso}?window:parent,window,JSON.parse(${JSON.stringify(JSON.stringify(cfg))}),${CDP_PROBE})}catch(e){${col}=null}window.addEventListener("pagehide",function(){try{if(${col})${col}.stop()}catch(e){}});${post(`{type:"cap:ready",nonce:${nonce},observe:${observe}}`)};window.onload=async function(){var ${dvKey}=null;try {var ${agAll}=[];${dvKey}=await (async function(){${shuffle(envChecks).join("")}${blockChecks}${agentScan}
      var ${vars[0]}=${initVals[0]};var ${vars[1]}=${initVals[1]};var ${vars[2]}=${initVals[2]};var ${vars[3]}=${initVals[3]};${clientEqs}
      var ${outKey}={};${outKey}["${vars[0]}"]=${vars[0]};${outKey}["${vars[1]}"]=${vars[1]};${outKey}["${vars[2]}"]=${vars[2]};${outKey}["${vars[3]}"]=${vars[3]};return ${outKey};})();if (!${dvKey} || typeof ${dvKey} !== 'object') throw 0;${buildProbe(pKey)}var ${emit}=function(${lw}){if(${col}){var ${mk}=${col}.marks();for(var i=0;i<${mk}.length;i++)if(${agAll}.indexOf(${mk}[i])<0)${agAll}.push(${mk}[i])}${agAll}.sort();var ${data}={${collected}};if(${lw}){${data}.ia=null;${data}.bh=null;${data}.lw=1}if(${iso}){${data}.ia=null;${data}.bh=null;${data}.is=1}var ${ser}=${N("$S")}(${data}),${g1}=${N("$H")}(${ser},(${seedKeys[0][1]}^${N("$H")}(${mix},${seedKeys[0][0]}))>>>0),${g2}=${N("$H")}(${ser},(${seedKeys[1][1]}^${N("$H")}(${mix},${seedKeys[1][0]}))>>>0),${st}={};${folds}return {i:${nonce},state:${st},d:${ser}}};${observe ? `${post(`{type:"cap:instr",nonce:${nonce},early:true,result:${emit}(1)}`)};await ${finP};` : ""}var ${res}=${emit}(0);if(${col})${col}.stop();${post(`{type:"cap:instr",nonce:${nonce},result:${res}}`)};} catch (e) {try{if(${col})${col}.stop()}catch(x){}${post(`{type:"cap:error",nonce:${nonce},reason:${dvKey}?"script_failed":"env_failed"}`)}}};})();`;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function generateInstrumentation(opts = {}) {
  const id = rHex(32);
  const vars = Array.from({ length: 4 }, () => rVar(12));
  const blockAutomatedBrowsers = opts.blockAutomatedBrowsers === true;
  const blockAutomatedInteractions = opts.blockAutomatedInteractions === true;
  const detectAutomatedInteractions =
    opts.detectAutomatedInteractions === true || blockAutomatedInteractions;
  const behavior = opts.behavior === true;
  const behaviorEnforced = behavior && opts.behaviorEnforced === true;
  const noWasm = opts.noWasm === true;

  let initVals;
  let vals;
  let clientEqs;
  do {
    initVals = [
      fastRnd(10, 250),
      fastRnd(10, 250),
      fastRnd(10, 250),
      fastRnd(10, 250),
    ];
    vals = [...initVals];

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
      `function ${domHelper}(x,y,z){var d=document.createElement('div');d.style.display='none';document.body.appendChild(d);function A(p,v){for(var i=0;i<8;i++){var c=document.createElement('div');p.appendChild(c);c.textContent=v;if((v&1)==0)p=c;v=v>>1;}return p;}function B(n,r,s){if(!n||n==r)return s%256;while(n.children.length>0)n.removeChild(n.lastElementChild);return B(n.parentNode,r,s+parseInt(n.textContent));}var s=B(A(A(A(d,x),y),z),d,0);d.parentNode.removeChild(d);return s;}`;

    clientEqs = `${helperDecls}${vars[0]} = ${vars[0]} ^ (navigator.userAgent ? ${correctKey} : ${badKey});`;

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
  } while (vals.filter((v) => v !== 0).length < 2);

  const salts = [
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
    fastRnd(100_000, 999_999),
  ];
  const seeds = [randomInt(1, 0x7fffffff), randomInt(1, 0x7fffffff)];
  const checkSeed = randomInt(1, 0x7fffffff);
  const seedKeys = seeds.map((seed) => {
    const c = randomInt(1, 0x7fffffff);
    return [c, toInt32(seed ^ hashWith(c)(vals.join(",")))];
  });
  const first = fastRnd(0, 3);
  const fold = [first, (first + fastRnd(1, 3)) % 4];
  const binding = { pv: vals, sl: salts, hs: seeds, j: fold };

  const script = buildClientScript({
    id,
    vars,
    initVals,
    clientEqs,
    blockAutomatedBrowsers,
    checkSeed,
    seedKeys,
    salts,
    fold,
    cfg: {
      bh: behavior ? 1 : 0,
      ia: detectAutomatedInteractions ? 1 : 0,
      sens: SENSITIVE_FIELDS,
      marks: AGENT_MARKS,
      attrs: MARK_ATTRS,
    },
    noWasm,
  });

  const level = Math.max(1, Math.min(10, opts.obfuscationLevel ?? 5));

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
  const iat = Date.now();

  return {
    id,
    iat,
    expires: iat + ttlMs,
    vars,
    blockAutomatedBrowsers,
    blockAutomatedInteractions,
    detectAutomatedInteractions,
    behavior,
    behaviorEnforced,
    ...(noWasm && { noWasm }),
    binding,
    instrumentation: Buffer.from(compressed).toString("base64"),
  };
}

export const MAX_BOUND_DATA = 65_536;
const CLOCK_SLACK_MS = 5_000;
const DATA_KEYS = new Set([
  "v",
  "el",
  "p",
  "vp",
  "hp",
  "ag",
  "ia",
  "bh",
  "ce",
  "lw",
  "is",
  "wa",
]);
const PAYLOAD_KEYS = new Set(["i", "state", "d"]);
const LEGACY_PAYLOAD_KEYS = new Set(["vp", "p", "ts"]);
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isPlain = (o) => !!o && typeof o === "object" && !Array.isArray(o);

export function canonicalize(v) {
  if (Array.isArray(v)) {
    return v.map((x) =>
      x === undefined || typeof x === "function" ? null : canonicalize(x),
    );
  }
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const x = v[k];
      if (x !== undefined && typeof x !== "function") out[k] = canonicalize(x);
    }
    return out;
  }
  return v;
}

export function serializeBound(data) {
  return JSON.stringify(canonicalize(data));
}

export function boundValues(binding, serialized) {
  const g1 = hashWith(binding.hs[0])(serialized);
  const g2 = hashWith(binding.hs[1])(serialized);
  return binding.pv.map(
    (v, i) =>
      (((v ^
        binding.sl[i] ^
        (i === binding.j[0] ? g1 : 0) ^
        (i === binding.j[1] ? g2 : 0)) &
        0x7fffffff) %
        900_000) +
      100_000,
  );
}

function parseBound(serialized) {
  try {
    let unsafe = false;
    const parsed = JSON.parse(serialized, (k, v) => {
      if (UNSAFE_KEYS.has(k)) unsafe = true;
      return v;
    });
    if (unsafe || !isPlain(parsed)) return null;
    if (serializeBound(parsed) !== serialized) return null;
    return parsed;
  } catch {
    return null;
  }
}

const canonicalCodes = (list, max) =>
  Array.isArray(list) &&
  list.length <= max &&
  list.every(
    (c, i) =>
      typeof c === "string" &&
      /^[a-z_]{1,24}$/.test(c) &&
      (i === 0 || list[i - 1] < c),
  );

const isNumPair = (x) =>
  Array.isArray(x) &&
  x.length === 2 &&
  x.every((n) => typeof n === "number" && Number.isFinite(n));

const optional = (x, ok) => x === undefined || x === null || ok(x);
const isStr = (x) => typeof x === "string";

function boundDataValid(d) {
  if (Object.keys(d).some((k) => !DATA_KEYS.has(k))) return false;
  if (d.v !== 1 || !Number.isInteger(d.el) || d.el < 0) return false;
  if (!canonicalCodes(d.ag, MAX_BOUND_CODES)) return false;
  if (d.p !== null && !isPlain(d.p)) return false;
  if (d.hp !== null && !isPlain(d.hp)) return false;
  if (d.bh !== null && !isPlain(d.bh)) return false;
  if (d.vp !== null && !isNumPair(d.vp)) return false;
  if (d.ce !== undefined && d.ce !== 0 && d.ce !== 1 && d.ce !== 2)
    return false;
  if (d.wa !== undefined && d.wa !== 0 && d.wa !== 1) return false;
  if (d.lw !== undefined && (d.lw !== 1 || d.ia !== null || d.bh !== null)) {
    return false;
  }
  if (d.is !== undefined && (d.is !== 1 || d.ia !== null || d.bh !== null)) {
    return false;
  }
  if (
    d.ia !== null &&
    !(
      Array.isArray(d.ia) &&
      d.ia.length === 2 &&
      d.ia.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    )
  ) {
    return false;
  }
  const p = d.p ?? {};
  return (
    optional(d.hp?.nav?.brands, isStr) &&
    optional(p.mainNav?.brands, isStr) &&
    optional(p.ua, isStr) &&
    optional(p.webdriver, (x) => typeof x === "boolean") &&
    optional(p.uaData?.brands, (x) => Array.isArray(x) && x.every(isStr)) &&
    optional(
      p.langs,
      (x) =>
        Array.isArray(x) && Number.isFinite(x[0]) && typeof x[1] === "boolean",
    )
  );
}

const failed = { valid: false, reason: "failed_challenge" };

export function verifyInstrumentationResult(
  challengeMeta,
  payload,
  now = Date.now(),
) {
  try {
    if (!isPlain(challengeMeta)) {
      return { valid: false, reason: "missing_meta" };
    }
    if (!isPlain(payload)) {
      return { valid: false, reason: "missing_output" };
    }
    if (payload.i !== challengeMeta.id) {
      return { valid: false, reason: "id_mismatch" };
    }
    const state = payload.state;
    if (!isPlain(state)) {
      return { valid: false, reason: "invalid_state" };
    }
    const vars = challengeMeta.vars;
    if (!Array.isArray(vars)) {
      return { valid: false, reason: "invalid_meta" };
    }
    if (
      Object.keys(payload).some(
        (k) => !PAYLOAD_KEYS.has(k) && !LEGACY_PAYLOAD_KEYS.has(k),
      )
    ) {
      return failed;
    }
    if (
      Object.keys(state).length !== vars.length ||
      vars.some((v) => !Object.hasOwn(state, v) || !Number.isInteger(state[v]))
    ) {
      return failed;
    }

    const binding = challengeMeta.binding;
    let expected = challengeMeta.expectedVals;
    if (binding) {
      if (typeof payload.d !== "string") return failed;
      if (payload.d.length > MAX_BOUND_DATA) {
        return { valid: false, reason: "instr_oversized" };
      }
      expected = boundValues(binding, payload.d);
    } else if (!Array.isArray(expected)) {
      return { valid: false, reason: "invalid_meta" };
    }

    if (!vars.every((v, i) => state[v] === expected[i])) return failed;

    if (!binding) {
      if (challengeMeta.blockAutomatedBrowsers || challengeMeta.noWasm) {
        return { valid: false, reason: "instr_probe_missing" };
      }
      if (challengeMeta.behavior) {
        return { valid: false, reason: "behavior_missing" };
      }
      return { valid: true, riskFlags: [], trace: null };
    }

    const data = parseBound(payload.d);
    if (!data || !boundDataValid(data)) return failed;

    if (Number.isFinite(challengeMeta.iat)) {
      const ttl =
        (challengeMeta.expires ?? Number.POSITIVE_INFINITY) - challengeMeta.iat;
      if (
        challengeMeta.iat + data.el > now + CLOCK_SLACK_MS ||
        data.el > ttl + CLOCK_SLACK_MS
      ) {
        return { valid: false, reason: "instr_stale" };
      }
    }

    const legacy = data.lw === 1;
    const isolated = data.is === 1 && !legacy;
    const reduced = legacy || isolated;
    const outdated = {
      valid: false,
      reason: isolated ? "instr_isolated" : "instr_widget_outdated",
    };
    if (challengeMeta.behavior === true && data.bh === null) {
      if (!reduced) return { valid: false, reason: "behavior_missing" };
      if (challengeMeta.behaviorEnforced !== false) return outdated;
    }

    const unreachable = reduced
      ? outdated
      : { valid: false, reason: "instr_host_unreachable" };
    if (data.hp === null && challengeMeta.blockAutomatedBrowsers === true) {
      return unreachable;
    }
    if (
      data.ia === null &&
      (reduced
        ? challengeMeta.blockAutomatedInteractions === true
        : challengeMeta.detectAutomatedInteractions === true)
    ) {
      return unreachable;
    }

    const riskFlags = [];
    if (data.hp === null) riskFlags.push("host_unreachable");
    if (legacy) riskFlags.push("legacy_widget");
    if (isolated) riskFlags.push("isolated_frame");
    if (data.ce > 0) riskFlags.push("csp_eval_blocked");
    if (challengeMeta.noWasm === true) {
      if (data.wa !== 0)
        return { valid: false, reason: "instr_wasm_available" };
      riskFlags.push("wasm_fallback");
    }

    const interactionFlags = [];
    if (
      challengeMeta.detectAutomatedInteractions === true &&
      data.ia !== null
    ) {
      if (data.ia[0] >= 3)
        interactionFlags.push("interaction_synthetic_clicks");
      if (data.ia[1] >= 3) {
        interactionFlags.push("interaction_synthetic_keydowns");
      }
    }

    if (
      challengeMeta.blockAutomatedInteractions === true &&
      interactionFlags.length
    ) {
      return {
        valid: false,
        reason: "instr_automated_interaction",
        blockedBy: interactionFlags,
      };
    }

    const brands = [data.hp?.nav?.brands, data.p?.mainNav?.brands]
      .map((b) => (isStr(b) ? b : ""))
      .join(",");
    const agent = {
      all: data.ag,
      host: data.hp !== null,
      legacy,
      isolated,
      browser:
        data.p?.mainNav?.brave === true || /(^|,)Brave\//.test(brands)
          ? "brave"
          : /(^|,)Google Chrome\//.test(brands)
            ? "chrome"
            : null,
    };
    const boundFlags = data.ag.includes("automation")
      ? ["automation_globals"]
      : [];
    const trace = data.bh;

    if (data.p) {
      const vector = {
        ...data.p,
        ...(data.vp && { innerWH: data.vp }),
        cdp: {
          trap: data.ag.includes("cdp_trap") || data.hp?.cdp === true,
          shadow: !data.ag.includes("shadow_patched"),
        },
        ...(data.hp && { host: data.hp }),
      };
      const d = detectAutomation(vector, {
        fontStackCount: PROBE_FONT_STACKS.length,
      });
      if (challengeMeta.blockAutomatedBrowsers && !d.pass) {
        return {
          valid: false,
          reason: "instr_automated_browser",
          blockedBy: d.blockedBy,
          checks: d.checks,
        };
      }
      return {
        valid: true,
        riskFlags: [
          ...d.riskFlags,
          ...interactionFlags,
          ...boundFlags,
          ...riskFlags,
        ],
        blockedBy: d.blockedBy,
        checks: d.checks,
        agent,
        trace,
      };
    }

    if (challengeMeta.blockAutomatedBrowsers) {
      return { valid: false, reason: "instr_probe_missing" };
    }

    return {
      valid: true,
      riskFlags: [...interactionFlags, ...boundFlags, ...riskFlags],
      agent,
      trace,
    };
  } catch {
    return failed;
  }
}
