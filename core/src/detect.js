const MOBILE_UA =
  /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Mobile Safari|; Mobile|Silk|Kindle|Tizen|Opera Mini/i;

const MAX_FONT_WIDTHS = 64;
const MAX_TAMPER_KEYS = 8;
const MAX_TAMPER_KEY_LENGTH = 32;
const MAX_DETAIL_FIELDS = 6;
const OUTER_HEIGHT_SLACK = 16;
const BRAVE_SCREENS = new Set([
  "1280x800",
  "1366x768",
  "1440x900",
  "1680x1050",
  "1920x1080",
  "2560x1440",
  "3840x2160",
]);

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isPlainObject = (x) => !!x && typeof x === "object" && !Array.isArray(x);

const PROBE_FIELD_TYPES = {
  ua: "string",
  productSub: "string",
  oscpu: "string",
  uaDataPresent: "boolean",
  uaData: "nullableObject",
  plugins: "object",
  engine: "object",
  screen: "object",
  outerWH: "array",
  isExtended: "nullableBoolean",
  fontWidths: "array",
  maxTouchPoints: "number",
  mainNav: "object",
  tamper: "nullableObject",
};

const typeOk = (value, kind) => {
  if (kind === "string") return typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "number") return isNum(value);
  if (kind === "object") return isPlainObject(value);
  if (kind === "array") return Array.isArray(value);
  if (kind === "nullableObject") return value === null || isPlainObject(value);
  if (kind === "nullableBoolean")
    return value === null || typeof value === "boolean";
  return false;
};

export function isMobileVector(S) {
  if (S?.uaData?.mobile === true) return true;
  return MOBILE_UA.test(typeof S?.ua === "string" ? S.ua : "");
}

export function probeCompleteness(S, fontStackCount) {
  if (!isPlainObject(S)) return ["probe"];
  const bad = [];
  for (const field of Object.keys(PROBE_FIELD_TYPES)) {
    if (!typeOk(S[field], PROBE_FIELD_TYPES[field])) bad.push(field);
  }
  if (
    Array.isArray(S.fontWidths) &&
    isNum(fontStackCount) &&
    S.fontWidths.length !== fontStackCount
  ) {
    bad.push("fontWidths.length");
  }
  return bad;
}

export function geometryStats(fontWidths) {
  const w = (Array.isArray(fontWidths) ? fontWidths : [])
    .slice(0, MAX_FONT_WIDTHS)
    .filter(isNum);
  if (w.length < 6) return null;
  let count = 0;
  let blank = 0;
  const distinct = new Set();
  for (const x of w) {
    if (x <= 0) blank++;
    if (Math.trunc(x) === x) {
      count++;
      distinct.add(x);
    }
  }
  return { count, blank, distinct: distinct.size, n: w.length };
}

export function detectAutomation(S, opts = {}) {
  if (!S || typeof S !== "object") {
    return {
      pass: false,
      checks: [],
      blockedBy: ["probe_missing"],
      riskFlags: [],
    };
  }

  const ua = typeof S.ua === "string" ? S.ua : "";
  const checks = [];
  const add = (id, passed, detail, gating = true) =>
    checks.push({ id, passed: passed !== false, detail, gating });

  const incomplete = probeCompleteness(S, opts.fontStackCount);
  add(
    "probe_incomplete",
    incomplete.length === 0,
    incomplete.length
      ? `missing or malformed: ${incomplete.slice(0, MAX_DETAIL_FIELDS).join(", ")}`
      : "all fields present",
  );

  const gecko =
    S.engine?.hasMozInnerScreenX === true ||
    (S.productSub === "20100101" && S.uaDataPresent === false) ||
    (typeof S.oscpu === "string" && S.oscpu !== "__undefined");
  const chromium = S.uaDataPresent === true || S.engine?.hasChrome === true;
  const mobile = isMobileVector(S);

  const geo = geometryStats(S.fontWidths);
  const dpr = isNum(S.screen?.dpr) ? S.screen.dpr : null;
  const hintedText =
    dpr !== null &&
    !mobile &&
    ((/\bCrOS\b/.test(ua) && Math.round(dpr) === dpr) ||
      (/\bLinux\b/.test(ua) &&
        !/\bAndroid\b/.test(ua) &&
        (dpr <= 1 || (gecko && Math.round(dpr) === dpr))));
  const quantized = !!geo && geo.count >= 5 && geo.distinct >= 3 && !hintedText;
  add(
    "geometry_quantized",
    !quantized,
    geo
      ? `${geo.count}/${geo.n} whole-px, ${geo.distinct} distinct${hintedText ? ", hinted text expected" : ""}`
      : "not measured",
  );

  add(
    "geometry_unmeasured",
    !geo || geo.blank < geo.n,
    geo ? `${geo.blank}/${geo.n} widths are zero` : "not measured",
  );

  add(
    "webdriver_true",
    S.webdriver !== true,
    `webdriver=${typeof S.webdriver === "boolean" ? S.webdriver : typeof S.webdriver}`,
  );

  const stripped = chromium && S.webdriver === undefined;
  add(
    "webdriver_stripped",
    !stripped,
    chromium ? (stripped ? "removed" : "ok") : "not a chromium engine",
  );

  const contradiction =
    gecko && (isNum(S.deviceMemory) || S.uaDataPresent === true);
  add("gecko_contradiction", !contradiction, gecko ? "gecko engine" : "n/a");

  const sc = S.screen || {};
  const ow = Array.isArray(S.outerWH) ? S.outerWH : [];
  const iw = Array.isArray(S.innerWH) ? S.innerWH : [];
  const braveScreen =
    S.mainNav?.brave === true && BRAVE_SCREENS.has(`${sc.width}x${sc.height}`);
  const singleMonitor = S.isExtended === false && !braveScreen;
  const outerTaller =
    isNum(ow[1]) && isNum(sc.height) && ow[1] > sc.height + OUTER_HEIGHT_SLACK;
  const exceeds = outerTaller && singleMonitor;
  add(
    "window_exceeds_screen",
    !exceeds,
    singleMonitor
      ? exceeds
        ? `outerHeight ${ow[1]} > screen.height ${sc.height}`
        : "ok"
      : braveScreen
        ? "brave screen bucket"
        : "monitor layout unknown",
  );

  const viewportIsScreen =
    !mobile &&
    !braveScreen &&
    isNum(iw[0]) &&
    isNum(iw[1]) &&
    iw[0] === sc.width &&
    iw[1] === sc.height &&
    isNum(ow[1]) &&
    ow[1] > iw[1];
  add(
    "viewport_override",
    !viewportIsScreen,
    viewportIsScreen
      ? `viewport ${iw[0]}x${iw[1]} == screen, window ${ow[1]} tall`
      : "ok",
  );

  const brands = Array.isArray(S.uaData?.brands)
    ? S.uaData.brands.filter((b) => typeof b === "string").join(" ")
    : "";
  const headless = /headlesschrome/i.test(brands) || /headlesschrome/i.test(ua);
  add(
    "headless_token",
    !headless,
    headless ? "HeadlessChrome present" : "absent",
  );

  const hev = isPlainObject(S.hev) ? S.hev : null;
  const blankHints =
    chromium &&
    !mobile &&
    S.uaDataPresent === true &&
    ((Array.isArray(S.uaData?.brands) && S.uaData.brands.length === 0) ||
      (!!hev && hev.fv === "" && hev.fl === ""));
  add(
    "ua_hints_blank",
    !blankHints,
    blankHints ? "user agent overridden without client hints" : "ok",
  );

  const st = isPlainObject(S.stealth) ? S.stealth : {};
  const stealthHits = ["iframe", "runtime"].filter((k) => st[k] === true);
  add(
    "stealth_patches",
    stealthHits.length === 0,
    stealthHits.length ? `patched: ${stealthHits.join(", ")}` : "ok",
  );

  const juggler = gecko && S.juggler === true;
  add(
    "juggler_package",
    !juggler,
    gecko
      ? juggler
        ? "chrome://juggler registered"
        : "absent"
      : "not a gecko engine",
  );

  const chromeMissing =
    S.uaDataPresent === true &&
    !mobile &&
    S.maxTouchPoints === 0 &&
    S.engine?.hasChrome === false &&
    !/QtWebEngine/i.test(ua);
  add(
    "chrome_object_missing",
    !chromeMissing,
    chromeMissing ? "chromium without window.chrome" : "ok",
  );

  const withoutDdg = (v) =>
    typeof v === "string"
      ? v
          .split(",")
          .filter((x) => !x.startsWith("DuckDuckGo/"))
          .join(",")
      : v;
  const mn = isPlainObject(S.mainNav) ? S.mainNav : null;
  const wn = isPlainObject(S.workerNav) ? S.workerNav : null;
  const mismatched = [];
  if (mn && wn) {
    const fields = ["ua", "platform", "tz", "brands"];
    if (mn.brave !== true) fields.push("languages", "hc", "gl");
    const iosDesktop =
      mn.platform === "MacIntel" &&
      /^(iPad|iPhone|iPod)/.test(wn.platform ?? "") &&
      S.maxTouchPoints > 1;
    const geckoDesktopMode = (() => {
      if (!gecko) return false;
      const desk =
        /^Mozilla\/5\.0 \(X11; Linux x86_64; rv:(\d+)\.0\) Gecko\/20100101 Firefox\/(\d+)\.0$/.exec(
          mn.ua ?? "",
        );
      const droid =
        /^Mozilla\/5\.0 \(Android [\d.]+; (?:Mobile|Tablet|TV); rv:(\d+)\.0\) Gecko\/(\d+)\.0 Firefox\/(\d+)\.0$/.exec(
          wn.ua ?? "",
        );
      return (
        !!desk &&
        !!droid &&
        new Set([...desk.slice(1), ...droid.slice(1)]).size === 1
      );
    })();
    const noisedCores = (() => {
      if (!/\bChrome\//.test(ua)) return false;
      if (!Number.isInteger(mn.hc) || !Number.isInteger(wn.hc)) return false;
      const n = Math.min(16, Math.max(2, wn.hc)) & ~1;
      return (
        mn.hc === n || (n > 2 && mn.hc === n - 2) || (n > 4 && mn.hc === n - 4)
      );
    })();
    for (const f of fields) {
      const a = mn[f];
      const b = wn[f];
      if (a === null || a === undefined || b === null || b === undefined)
        continue;
      if (f === "platform" && iosDesktop) continue;
      if (f === "ua" && geckoDesktopMode) continue;
      if (
        f === "hc" &&
        (noisedCores || (mn.ddg === true && (a === 4 || a === 8)))
      )
        continue;
      if (f === "brands" && mn.ddg === true && withoutDdg(a) === withoutDdg(b))
        continue;
      if (a !== b) mismatched.push(f);
    }
  }
  add(
    "worker_mismatch",
    mismatched.length === 0,
    mn && wn
      ? mismatched.length
        ? `differs in worker: ${mismatched.join(", ")}`
        : "consistent"
      : "not measured",
  );

  const t = isPlainObject(S.tamper) ? S.tamper : {};
  const lies = Array.isArray(S.lies)
    ? S.lies.filter((k) => typeof k === "string")
    : [];
  const tampered = [
    ...new Set([...Object.keys(t).filter((k) => t[k] === false), ...lies]),
  ];
  add(
    "native_tamper",
    tampered.length === 0,
    tampered.length
      ? `JS-overridden: ${tampered
          .slice(0, MAX_TAMPER_KEYS)
          .map((k) => String(k).slice(0, MAX_TAMPER_KEY_LENGTH))
          .join(", ")}`
      : "native",
    false,
  );

  const claimsGecko = /Firefox\//.test(ua) && !/Seamonkey/i.test(ua);
  const claimsBlink = /Chrome\/|CriOS\//.test(ua);
  const claimsWebkit = /Safari\//.test(ua) && !claimsBlink;
  const evalLen = isNum(S.evalLen) ? S.evalLen : null;
  const engineLie =
    !mobile &&
    evalLen !== null &&
    ((evalLen === 33 && (claimsGecko || claimsWebkit)) ||
      (evalLen === 37 && claimsBlink));
  add(
    "engine_mismatch",
    !engineLie,
    evalLen === null
      ? "not measured"
      : engineLie
        ? `eval source length ${evalLen} contradicts the user agent`
        : "consistent",
    false,
  );

  const at = Array.isArray(S.activeText) ? S.activeText : [];
  const major = Number(/Chrome\/(\d+)/.exec(ua)?.[1] ?? 0);
  const osLie =
    /Windows NT/.test(ua) &&
    major >= 138 &&
    at[0] === "rgb(255, 0, 0)" &&
    at[1] === false;
  add(
    "os_mismatch",
    !osLie,
    osLie ? "claims Windows but renders like Linux or macOS" : "ok",
    false,
  );

  const lg = Array.isArray(S.langs) ? S.langs : [];
  const langOdd = lg[0] === 0 || (isNum(lg[0]) && lg[0] > 0 && lg[1] === false);
  add(
    "languages_inconsistent",
    !langOdd,
    langOdd
      ? lg[0] === 0
        ? "navigator.languages is empty"
        : "languages[0] differs from language"
      : "ok",
    false,
  );

  const host = isPlainObject(S.host) ? S.host : null;
  const hn = isPlainObject(host?.nav) ? host.nav : null;
  const frameDiff = [];
  if (hn && mn) {
    const fields = ["platform", "brands"];
    if (mn.brave !== true) fields.push("languages");
    if (mn.brave !== true && mn.ddg !== true && hn.ddg !== true)
      fields.push("hc");
    for (const f of fields) {
      const a = mn[f];
      const b = hn[f];
      if (a === null || a === undefined || b === null || b === undefined)
        continue;
      if (
        f === "brands" &&
        (mn.ddg === true || hn.ddg === true) &&
        withoutDdg(a) === withoutDdg(b)
      )
        continue;
      if (a !== b) frameDiff.push(f);
    }
    if (hn.webdriver === true && S.webdriver !== true)
      frameDiff.push("webdriver");
  }
  add(
    "frame_mismatch",
    frameDiff.length === 0,
    hn
      ? frameDiff.length
        ? `page and Cap frame differ in: ${frameDiff.join(", ")}`
        : "consistent"
      : "not measured",
    false,
  );

  const intercepted = host?.doc === true;
  add(
    "document_intercepted",
    !intercepted,
    intercepted ? "the page was served by an automation tool" : "ok",
    false,
  );

  const trap = S.cdp?.trap === true;
  add(
    "cdp_console_trap",
    !trap,
    trap ? "a DevTools client formatted logged errors" : "not attached",
    false,
  );

  const shadowPatched = S.cdp?.shadow === false;
  add(
    "attach_shadow_patched",
    !shadowPatched,
    shadowPatched ? "attachShadow is not native" : "native",
    false,
  );

  const gl = typeof S.mainNav?.gl === "string" ? S.mainNav.gl : "";
  const fallbackGpu = !mobile && S.gpu?.f === true;
  const softGl =
    fallbackGpu ||
    (!mobile &&
      /SwiftShader|llvmpipe|softpipe|Mesa OffScreen|Microsoft Basic Render/i.test(
        gl,
      ));
  add(
    "software_renderer",
    !softGl,
    gl || fallbackGpu
      ? softGl
        ? fallbackGpu
          ? "WebGPU gave a fallback adapter"
          : gl.slice(0, 80)
        : "hardware"
      : "not measured",
    false,
  );

  const cv = Array.isArray(S.cv) ? S.cv : null;
  const noisy = cv?.[0] === 0 && isNum(cv[1]) && cv[1] > 64;
  add(
    "canvas_noise",
    !noisy,
    cv
      ? noisy
        ? "two identical drawings read back differently"
        : "stable"
      : "not measured",
    false,
  );

  const arch = typeof hev?.ar === "string" ? hev.ar.toLowerCase() : "";
  const nanArch = S.na === 255 ? "x86" : S.na === 127 ? "arm" : null;
  const desktopMode =
    arch === "x86" &&
    nanArch === "arm" &&
    /^Linux (armv|aarch64)/.test(S.mainNav?.platform ?? "");
  const archLie =
    nanArch !== null &&
    (arch === "x86" || arch === "arm") &&
    arch !== nanArch &&
    !desktopMode;
  add(
    "arch_mismatch",
    !archLie,
    nanArch && arch
      ? archLie
        ? `client hints say ${arch}, the CPU behaves like ${nanArch}`
        : desktopMode
          ? "Android in desktop mode"
          : "consistent"
      : "not measured",
  );

  const ig = Array.isArray(S.ig)
    ? S.ig.filter((k) => typeof k === "string").slice(0, 12)
    : null;
  add(
    "injected_globals",
    !ig?.length,
    ig
      ? ig.length
        ? `added to every frame: ${ig
            .slice(0, MAX_TAMPER_KEYS)
            .map((k) => k.slice(0, MAX_TAMPER_KEY_LENGTH))
            .join(", ")}`
        : "none"
      : "not measured",
    false,
  );

  const sd = Array.isArray(S.sd)
    ? S.sd.filter((k) => typeof k === "string")
    : [];
  const forged = sd.filter((k) => k === "isTrusted" || k === "objectToInspect");
  add(
    "devtools_globals",
    forged.length === 0,
    forged.length ? `found: ${forged.join(", ")}` : "ok",
  );
  const patchedDesc = sd
    .filter((k) => !forged.includes(k))
    .slice(0, MAX_TAMPER_KEYS);
  add(
    "stealth_descriptors",
    patchedDesc.length === 0,
    patchedDesc.length ? `redefined: ${patchedDesc.join(", ")}` : "ok",
    false,
  );

  const blink = chromium || S.evalLen === 33;
  const no =
    blink && Array.isArray(S.no)
      ? S.no.filter((k) => typeof k === "string")
      : [];
  add(
    "navigator_order",
    no.length === 0,
    blink
      ? no.length
        ? `re-added after the fact: ${no.slice(0, MAX_TAMPER_KEYS).join(", ")}`
        : "ok"
      : "not a chromium engine",
    false,
  );

  const glsh = isPlainObject(S.glsh) ? S.glsh : null;
  const glRenderer = typeof glsh?.r === "string" ? glsh.r : gl;
  const claimsMetal = /Metal|^Apple GPU$/i.test(glRenderer);
  const translated = ["hlsl", "metal", "glsl"].includes(glsh?.t)
    ? glsh.t
    : null;
  const shaderLie =
    !!glRenderer && !!translated && claimsMetal !== (translated === "metal");
  add(
    "shader_mismatch",
    !shaderLie,
    !glRenderer || !translated
      ? "not measured"
      : !shaderLie
        ? "consistent"
        : claimsMetal
          ? `renderer claims Metal, shaders compile to ${translated}`
          : "renderer hides Metal, shaders compile to metal",
    false,
  );

  const family = (str) => {
    const x = String(str ?? "");
    if (/nvidia|geforce|quadro|rtx/i.test(x)) return "nvidia";
    if (/\bamd\b|radeon|\bati\b/i.test(x)) return "amd";
    if (/intel/i.test(x)) return "intel";
    if (/apple/i.test(x)) return "apple";
    if (/qualcomm|adreno/i.test(x)) return "qualcomm";
    if (/\bmali\b|\barm\b/i.test(x)) return "arm";
    if (/swiftshader|google/i.test(x)) return "google";
    return null;
  };
  const gpu = isPlainObject(S.gpu) ? S.gpu : null;
  const gpuFam = gpu && !gpu.n ? family(gpu.v) : null;
  const glFam = family(glRenderer);
  const gpuLie = !!gpuFam && !!glFam && gpuFam !== glFam && !mobile;
  add(
    "webgpu_mismatch",
    !gpuLie,
    gpuFam && glFam
      ? gpuLie
        ? `WebGL says ${glFam}, WebGPU says ${gpuFam}`
        : "consistent"
      : "not measured",
    false,
  );

  const vc = Array.isArray(S.voices) ? S.voices : null;
  const branded = /(^|\s)Google Chrome\//.test(brands) && !mobile;
  const noGoogleVoices = branded && isNum(vc?.[0]) && vc[0] > 0 && vc[1] === 0;
  add(
    "voices_missing",
    !noGoogleVoices,
    branded
      ? vc
        ? noGoogleVoices
          ? "Google Chrome without its Google voices"
          : "ok"
        : "not measured"
      : "not Google Chrome",
    false,
  );

  const fw = Array.isArray(S.fontWidths) ? S.fontWidths : [];
  const has = (i) =>
    isNum(fw[i]) && isNum(S.fm) && Math.abs(fw[i] - S.fm) > 0.5;
  const fontsKnown = isNum(S.fm) && fw.length >= 13;
  const winNoFonts = fontsKnown && /Windows NT/.test(ua) && !mobile && !has(6);
  const macNoFonts = fontsKnown && /Macintosh/.test(ua) && !has(8);
  add(
    "os_fonts_mismatch",
    !winNoFonts && !macNoFonts,
    fontsKnown
      ? winNoFonts
        ? "claims Windows without Segoe UI"
        : macNoFonts
          ? "claims macOS without Helvetica Neue"
          : "consistent"
      : "not measured",
    false,
  );

  const ha = Array.isArray(host?.ha)
    ? host.ha.filter((k) => typeof k === "string")
    : [];
  const autoAttrs = ha.filter((k) =>
    /playwright|puppeteer|selenium|webdriver|cdp|automation|crawl|scrap/i.test(
      k,
    ),
  );
  add(
    "html_automation_attr",
    autoAttrs.length === 0,
    autoAttrs.length
      ? `on <html>: ${autoAttrs.slice(0, MAX_TAMPER_KEYS).join(", ")}`
      : "ok",
    false,
  );

  const failed = checks.filter((c) => c.gating && !c.passed);
  return {
    pass: failed.length === 0,
    checks,
    blockedBy: failed.map((c) => c.id),
    riskFlags: checks.filter((c) => !c.gating && !c.passed).map((c) => c.id),
  };
}
