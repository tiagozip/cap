const MOBILE_UA =
  /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Mobile Safari|; Mobile|Silk|Kindle|Tizen|Opera Mini/i;

const MAX_FONT_WIDTHS = 64;
const MAX_TAMPER_KEYS = 8;
const MAX_TAMPER_KEY_LENGTH = 32;
const MAX_DETAIL_FIELDS = 6;
const OUTER_HEIGHT_SLACK = 16;

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
  const quantized = !!geo && geo.count >= 5 && geo.distinct >= 3;
  add(
    "geometry_quantized",
    !quantized,
    geo
      ? `${geo.count}/${geo.n} whole-px, ${geo.distinct} distinct`
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
  const singleMonitor = S.isExtended === false;
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
      : "monitor layout unknown",
  );

  const viewportIsScreen =
    !mobile &&
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

  const mn = isPlainObject(S.mainNav) ? S.mainNav : null;
  const wn = isPlainObject(S.workerNav) ? S.workerNav : null;
  const mismatched = [];
  if (mn && wn) {
    const fields = ["ua", "platform", "tz", "brands"];
    if (mn.brave !== true) fields.push("languages", "hc", "gl");
    for (const f of fields) {
      const a = mn[f];
      const b = wn[f];
      if (a === null || a === undefined || b === null || b === undefined)
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
    if (mn.brave !== true) fields.push("languages", "hc");
    for (const f of fields) {
      const a = mn[f];
      const b = hn[f];
      if (a === null || a === undefined || b === null || b === undefined)
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

  const failed = checks.filter((c) => c.gating && !c.passed);
  return {
    pass: failed.length === 0,
    checks,
    blockedBy: failed.map((c) => c.id),
    riskFlags: checks.filter((c) => !c.gating && !c.passed).map((c) => c.id),
  };
}
