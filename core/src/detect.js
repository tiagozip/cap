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
  tamper: "nullableObject",
};

const typeOk = (value, kind) => {
  if (kind === "string") return typeof value === "string";
  if (kind === "boolean") return typeof value === "boolean";
  if (kind === "object") return isPlainObject(value);
  if (kind === "array") return Array.isArray(value);
  if (kind === "nullableObject") return value === null || isPlainObject(value);
  if (kind === "nullableBoolean")
    return value === null || typeof value === "boolean";
  return false;
};

export function isMobileVector(S) {
  if (S?.uaData?.mobile === true) return true;
  return MOBILE_UA.test(String(S?.ua || ""));
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
  const distinct = new Set();
  for (const x of w) {
    if (Math.trunc(x) === x) {
      count++;
      distinct.add(x);
    }
  }
  return { count, distinct: distinct.size, n: w.length };
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
    "webdriver_true",
    S.webdriver !== true,
    `webdriver=${String(S.webdriver)}`,
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
    ? S.uaData.brands.join(" ")
    : "";
  const headless =
    /headlesschrome/i.test(brands) ||
    /headlesschrome/i.test(String(S.ua || ""));
  add(
    "headless_token",
    !headless,
    headless ? "HeadlessChrome present" : "absent",
  );

  const t = isPlainObject(S.tamper) ? S.tamper : {};
  const tampered = Object.keys(t).filter((k) => t[k] === false);
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

  const failed = checks.filter((c) => c.gating && !c.passed);
  return {
    pass: failed.length === 0,
    checks,
    blockedBy: failed.map((c) => c.id),
    riskFlags: checks.filter((c) => !c.gating && !c.passed).map((c) => c.id),
  };
}
