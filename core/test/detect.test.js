import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { detectAutomation, geometryStats } from "../src/detect.js";
import { validateChallenge } from "../src/index.js";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";
import {
  boundPayload,
  issue,
  solveChallengeFromPublic,
  TEST_SECRET,
} from "./helpers.js";

const frac = (n) => Array.from({ length: n }, (_, i) => 1200.88 + i * 3.17);
const ints = (n) => Array.from({ length: n }, (_, i) => 1200 + i * 3);

const nav = (over = {}) => ({
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  platform: "MacIntel",
  languages: "en-US,en",
  hc: 8,
  tz: "Europe/Lisbon",
  brands: "Google Chrome/151,Chromium/151,Not.A/Brand/99",
  brave: false,
  ...over,
});

const chromeHuman = () => ({
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  productSub: "20030107",
  webdriver: false,
  oscpu: "__undefined",
  deviceMemory: 8,
  uaDataPresent: true,
  uaData: {
    mobile: false,
    brands: ["Google Chrome/151", "Chromium/151", "Not.A/Brand/99"],
  },
  plugins: { length: 5 },
  pdfViewerEnabled: true,
  engine: { hasMozInnerScreenX: false, hasChrome: true },
  maxTouchPoints: 0,
  juggler: null,
  mainNav: nav(),
  workerNav: nav({ brands: null }),
  screen: { width: 1920, height: 1080 },
  innerWH: [945, 868],
  outerWH: [945, 1060],
  isExtended: false,
  fontWidths: frac(17),
  tamper: {
    getParameterWebGL: true,
    toDataURL: true,
    getImageData: true,
    permissionsQuery: true,
    fnToString: true,
  },
});

const firefoxHuman = () => ({
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:154.0) Gecko/20100101 Firefox/154.0",
  productSub: "20100101",
  webdriver: false,
  oscpu: "Intel Mac OS X 10.15",
  deviceMemory: undefined,
  uaDataPresent: false,
  uaData: null,
  plugins: { length: 5 },
  pdfViewerEnabled: true,
  engine: { hasMozInnerScreenX: true, hasChrome: false },
  maxTouchPoints: 0,
  juggler: false,
  mainNav: nav(),
  screen: { width: 1920, height: 1080 },
  innerWH: [1200, 900],
  outerWH: [1200, 985],
  isExtended: false,
  fontWidths: frac(17),
  tamper: {
    getParameterWebGL: true,
    toDataURL: true,
    getImageData: true,
    permissionsQuery: true,
    fnToString: true,
  },
});

const safariHuman = () => ({
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15",
  productSub: "20030107",
  webdriver: false,
  oscpu: "__undefined",
  deviceMemory: undefined,
  uaDataPresent: false,
  uaData: null,
  plugins: { length: 2 },
  pdfViewerEnabled: true,
  engine: { hasMozInnerScreenX: false, hasChrome: false },
  maxTouchPoints: 0,
  mainNav: nav(),
  screen: { width: 1728, height: 1117 },
  innerWH: [1200, 900],
  outerWH: [1200, 980],
  isExtended: false,
  fontWidths: frac(17),
  tamper: {
    getParameterWebGL: true,
    toDataURL: true,
    getImageData: true,
    permissionsQuery: true,
    fnToString: true,
  },
});

describe("geometryStats", () => {
  test("null under 6 samples", () => {
    expect(geometryStats([1, 2, 3])).toBeNull();
    expect(geometryStats(null)).toBeNull();
  });
  test("counts whole-pixel widths and distinct values", () => {
    expect(geometryStats([1200, 1200, 1200, 1300, 1.5, 2.5])).toEqual({
      count: 4,
      blank: 0,
      distinct: 2,
      n: 6,
    });
  });
});

describe("detectAutomation humans", () => {
  test("desktop chrome passes", () => {
    const r = detectAutomation(chromeHuman());
    expect(r.pass).toBe(true);
    expect(r.blockedBy).toEqual([]);
    expect(r.riskFlags).toEqual([]);
  });

  test("firefox passes", () => {
    expect(detectAutomation(firefoxHuman()).pass).toBe(true);
  });

  test("ungoogled chromium (no brand, chrome-for-testing) passes", () => {
    const S = chromeHuman();
    S.uaData.brands = ["Chromium/141", "Not.A/Brand/99"];
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("android webview with zero plugins and no window.chrome passes", () => {
    const S = chromeHuman();
    S.ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.0.0 Mobile Safari/537.36";
    S.uaData = { mobile: true, brands: ["Chromium/151"] };
    S.plugins = { length: 0 };
    S.pdfViewerEnabled = false;
    S.engine.hasChrome = false;
    S.screen = { width: 412, height: 915 };
    S.innerWH = [412, 915];
    S.outerWH = [412, 915];
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("single-font system with many identical integer widths passes", () => {
    const S = chromeHuman();
    S.fontWidths = Array(17).fill(1200);
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("multi-monitor window taller than current screen passes", () => {
    const S = chromeHuman();
    S.isExtended = true;
    S.outerWH = [1600, 1400];
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("safari without navigator.webdriver passes", () => {
    const S = safariHuman();
    S.webdriver = undefined;
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(true);
    expect(r.blockedBy).toEqual([]);
  });

  test("edge on ios passes (reported broken by kramli.de)", () => {
    const S = {
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      productSub: "20030107",
      webdriver: undefined,
      oscpu: "__undefined",
      deviceMemory: undefined,
      uaDataPresent: false,
      uaData: null,
      plugins: { length: 0 },
      pdfViewerEnabled: true,
      engine: { hasMozInnerScreenX: false, hasChrome: false },
      maxTouchPoints: 5,
      mainNav: nav(),
      screen: { width: 390, height: 844 },
      innerWH: [390, 664],
      outerWH: [390, 844],
      isExtended: null,
      fontWidths: frac(17),
      tamper: {
        getParameterWebGL: true,
        toDataURL: true,
        getImageData: true,
        permissionsQuery: true,
        fnToString: true,
      },
    };
    const wire = JSON.parse(JSON.stringify(S));
    const r = detectAutomation(wire, { fontStackCount: 17 });
    expect(r.pass).toBe(true);
    expect(r.blockedBy).toEqual([]);
  });

  test("ios browsers with an overshooting outerHeight pass", () => {
    const S = safariHuman();
    S.ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1";
    S.webdriver = undefined;
    S.isExtended = null;
    S.screen = { width: 390, height: 844 };
    S.outerWH = [390, 900];
    expect(detectAutomation(S, { fontStackCount: 17 }).pass).toBe(true);
  });

  test("old webkit webview without navigator.webdriver passes", () => {
    const S = safariHuman();
    S.ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
    S.webdriver = undefined;
    expect(detectAutomation(S, { fontStackCount: 17 }).pass).toBe(true);
  });

  test("firefox on a taller second monitor passes", () => {
    const S = firefoxHuman();
    S.isExtended = null;
    S.screen = { width: 1920, height: 1080 };
    S.outerWH = [1200, 1400];
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(true);
    expect(r.blockedBy).toEqual([]);
  });

  test("safari on a taller second monitor passes", () => {
    const S = safariHuman();
    S.isExtended = null;
    S.outerWH = [1200, 1600];
    expect(detectAutomation(S, { fontStackCount: 17 }).pass).toBe(true);
  });

  test("maximized window overhanging the screen edge passes", () => {
    const S = chromeHuman();
    S.screen = { width: 1920, height: 1080 };
    S.outerWH = [1920, 1088];
    expect(detectAutomation(S, { fontStackCount: 17 }).pass).toBe(true);
  });

  test("font-poor system with two integer fallbacks passes", () => {
    const S = firefoxHuman();
    const w = frac(17);
    for (let i = 0; i < 9; i++) w[i] = i % 2 === 0 ? 1200 : 1400;
    S.fontWidths = w;
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(true);
  });

  test("a complete probe reports no completeness failure", () => {
    for (const S of [chromeHuman(), firefoxHuman(), safariHuman()]) {
      const r = detectAutomation(S, { fontStackCount: 17 });
      expect(r.blockedBy).not.toContain("probe_incomplete");
    }
  });

  test("undefined-only fields may be dropped by JSON without failing", () => {
    const S = JSON.parse(JSON.stringify(firefoxHuman()));
    expect("deviceMemory" in S).toBe(false);
    expect(detectAutomation(S, { fontStackCount: 17 }).pass).toBe(true);
  });

  test("privacy extension patching canvas is a risk flag, not a block", () => {
    const S = chromeHuman();
    S.tamper.toDataURL = false;
    const r = detectAutomation(S);
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toEqual(["native_tamper"]);
  });

  test("CDP console trap and patched attachShadow are risk flags, not blocks", () => {
    const S = chromeHuman();
    S.cdp = { trap: true, shadow: false };
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toEqual(["cdp_console_trap", "attach_shadow_patched"]);
  });

  test("a clean or missing cdp field raises no flags", () => {
    const S = chromeHuman();
    expect(detectAutomation(S, { fontStackCount: 17 }).riskFlags).toEqual([]);
    S.cdp = { trap: false, shadow: true };
    expect(detectAutomation(S, { fontStackCount: 17 }).riskFlags).toEqual([]);
  });

  test("missing viewport (old widget) does not block", () => {
    const S = chromeHuman();
    delete S.innerWH;
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("brave farbling cores and languages differently in a worker passes", () => {
    const S = chromeHuman();
    S.mainNav = nav({ brave: true, hc: 4, languages: "en-US" });
    S.workerNav = nav({
      brave: true,
      hc: 6,
      languages: "en-US,en",
      brands: null,
    });
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("worker that failed to start does not block", () => {
    const S = chromeHuman();
    S.workerNav = null;
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("chromium on a touch device without window.chrome passes", () => {
    const S = chromeHuman();
    S.engine.hasChrome = false;
    S.maxTouchPoints = 5;
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("mobile chromium without window.chrome passes", () => {
    const S = chromeHuman();
    S.engine.hasChrome = false;
    S.uaData.mobile = true;
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("an iPad in desktop mode passes with an iPad worker platform", () => {
    const S = safariHuman();
    S.maxTouchPoints = 5;
    S.mainNav = nav({ ua: S.ua, brands: null });
    S.workerNav = nav({ ua: S.ua, platform: "iPad", brands: null });
    expect(detectAutomation(S).pass).toBe(true);
  });

  test("an iPad worker platform without touch still blocks", () => {
    const S = safariHuman();
    S.mainNav = nav({ ua: S.ua, brands: null });
    S.workerNav = nav({ ua: S.ua, platform: "iPad", brands: null });
    expect(detectAutomation(S).blockedBy).toContain("worker_mismatch");
  });

  test("Helium core noise passes for every value it can pick", () => {
    for (const [real, shown] of [
      [20, 16],
      [20, 14],
      [20, 12],
      [8, 4],
      [7, 6],
      [4, 2],
    ]) {
      const S = chromeHuman();
      S.mainNav = nav({ hc: shown });
      S.workerNav = nav({ hc: real });
      expect(detectAutomation(S).blockedBy).not.toContain("worker_mismatch");
    }
  });

  test("core counts Helium can't produce still block", () => {
    for (const [real, shown] of [
      [4, 8],
      [20, 10],
      [8, 2],
      [8, 5],
    ]) {
      const S = chromeHuman();
      S.mainNav = nav({ hc: shown });
      S.workerNav = nav({ hc: real });
      expect(detectAutomation(S).blockedBy).toContain("worker_mismatch");
    }
  });

  test("a lower page core count outside Chromium still blocks", () => {
    const S = safariHuman();
    S.mainNav = nav({ ua: S.ua, brands: null, hc: 6 });
    S.workerNav = nav({ ua: S.ua, brands: null, hc: 8 });
    expect(detectAutomation(S).blockedBy).toContain("worker_mismatch");
  });

  test("Safari reporting Apple GPU and compiling Metal passes", () => {
    const S = safariHuman();
    S.glsh = { r: "Apple GPU", t: "metal" };
    expect(detectAutomation(S).riskFlags).not.toContain("shader_mismatch");
  });

  test("hinted text on ChromeOS at 1x passes", () => {
    const S = chromeHuman();
    S.ua =
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
    S.screen = { width: 1366, height: 768, dpr: 1 };
    S.fontWidths = ints(17);
    expect(detectAutomation(S).blockedBy).not.toContain("geometry_quantized");
  });

  test("hinted text on Linux at 1x passes", () => {
    const S = chromeHuman();
    S.ua =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
    S.screen = { width: 1920, height: 1080, dpr: 1 };
    S.fontWidths = ints(17);
    expect(detectAutomation(S).blockedBy).not.toContain("geometry_quantized");
  });

  test("juggler flag on a non-gecko engine is ignored", () => {
    const S = safariHuman();
    S.juggler = true;
    expect(detectAutomation(S).pass).toBe(true);
  });
});

describe("detectAutomation bots", () => {
  test("camoufox quantized geometry", () => {
    const S = firefoxHuman();
    S.fontWidths = ints(17);
    const r = detectAutomation(S);
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toEqual(["geometry_quantized"]);
  });

  test("whole-pixel text on Linux at 2x still blocks", () => {
    const S = chromeHuman();
    S.ua =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
    S.screen = { width: 1920, height: 1080, dpr: 2 };
    S.fontWidths = ints(17);
    expect(detectAutomation(S).blockedBy).toContain("geometry_quantized");
  });

  test("whole-pixel text on ChromeOS at a fractional scale still blocks", () => {
    const S = chromeHuman();
    S.ua =
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
    S.screen = { width: 1366, height: 768, dpr: 1.25 };
    S.fontWidths = ints(17);
    expect(detectAutomation(S).blockedBy).toContain("geometry_quantized");
  });

  test("font widths measured in an unrendered frame are all zero", () => {
    const S = chromeHuman();
    S.fontWidths = Array(17).fill(0);
    const r = detectAutomation(S);
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toEqual(["geometry_unmeasured"]);
  });

  test("plain playwright: webdriver true", () => {
    const S = chromeHuman();
    S.webdriver = true;
    expect(detectAutomation(S).blockedBy).toContain("webdriver_true");
  });

  test("webdriver deleted on blink", () => {
    const S = chromeHuman();
    S.webdriver = undefined;
    expect(detectAutomation(S).blockedBy).toContain("webdriver_stripped");
  });

  test("gecko exposing chromium-only apis", () => {
    const S = firefoxHuman();
    S.deviceMemory = 8;
    expect(detectAutomation(S).blockedBy).toContain("gecko_contradiction");
  });

  test("patchright: window taller than screen and viewport override", () => {
    const S = chromeHuman();
    S.screen = { width: 1280, height: 720 };
    S.innerWH = [1280, 720];
    S.outerWH = [1288, 805];
    const r = detectAutomation(S);
    expect(r.blockedBy).toEqual(["window_exceeds_screen", "viewport_override"]);
  });

  test("headless token in brands", () => {
    const S = chromeHuman();
    S.uaData.brands = ["HeadlessChrome/151", "Chromium/151"];
    expect(detectAutomation(S).blockedBy).toContain("headless_token");
  });

  test("stripped probe is rejected, not passed", () => {
    const r = detectAutomation({}, { fontStackCount: 17 });
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toContain("probe_incomplete");
  });

  test("partially stripped probe is rejected", () => {
    const S = chromeHuman();
    S.fontWidths = [1, 2, 3, 4, 5];
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toContain("probe_incomplete");
  });

  test("dropping a single field is rejected", () => {
    for (const field of [
      "ua",
      "screen",
      "outerWH",
      "fontWidths",
      "isExtended",
      "uaDataPresent",
    ]) {
      const S = chromeHuman();
      delete S[field];
      const r = detectAutomation(S, { fontStackCount: 17 });
      expect(r.blockedBy).toContain("probe_incomplete");
    }
  });

  test("wrong field types are rejected", () => {
    const S = chromeHuman();
    S.screen = [];
    S.fontWidths = "abc";
    S.isExtended = "no";
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toContain("probe_incomplete");
  });

  test("array vector is rejected", () => {
    const r = detectAutomation([], { fontStackCount: 17 });
    expect(r.pass).toBe(false);
    expect(r.blockedBy).toContain("probe_incomplete");
  });

  test("headless chromium hiding webdriver is still caught", () => {
    const S = chromeHuman();
    S.webdriver = undefined;
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(r.blockedBy).toContain("webdriver_stripped");
  });

  test("window taller than a known single screen is still caught", () => {
    const S = chromeHuman();
    S.isExtended = false;
    S.screen = { width: 1280, height: 720 };
    S.outerWH = [1288, 805];
    expect(detectAutomation(S, { fontStackCount: 17 }).blockedBy).toContain(
      "window_exceeds_screen",
    );
  });

  test("hostile key names and lengths are bounded in detail output", () => {
    const S = chromeHuman();
    S.tamper = {};
    for (let i = 0; i < 2000; i++) S.tamper[`k${i}`.repeat(50)] = false;
    const r = detectAutomation(S, { fontStackCount: 17 });
    const native = r.checks.find((c) => c.id === "native_tamper");
    expect(native.detail.length).toBeLessThan(400);
  });

  test("oversized fontWidths is bounded", () => {
    const S = chromeHuman();
    S.fontWidths = Array.from({ length: 200000 }, () => 1200);
    const t0 = performance.now();
    const r = detectAutomation(S, { fontStackCount: 17 });
    expect(performance.now() - t0).toBeLessThan(200);
    expect(r.blockedBy).toContain("probe_incomplete");
  });

  test("missing vector fails closed", () => {
    expect(detectAutomation(null).pass).toBe(false);
    expect(detectAutomation(null).blockedBy).toEqual(["probe_missing"]);
  });

  test("playwright firefox: juggler package registered", () => {
    const S = firefoxHuman();
    S.juggler = true;
    expect(detectAutomation(S).blockedBy).toEqual(["juggler_package"]);
  });

  test("headless shell with a spoofed ua: no window.chrome", () => {
    const S = chromeHuman();
    S.engine.hasChrome = false;
    expect(detectAutomation(S).blockedBy).toEqual(["chrome_object_missing"]);
  });

  test("playwright locale option leaks through the worker", () => {
    const S = chromeHuman();
    S.mainNav = nav({ languages: "de-DE" });
    S.workerNav = nav({ languages: "en-US", brands: null });
    const r = detectAutomation(S);
    expect(r.blockedBy).toEqual(["worker_mismatch"]);
    expect(r.checks.find((c) => c.id === "worker_mismatch").detail).toBe(
      "differs in worker: languages",
    );
  });

  test("init script spoofing ua and cores leaks through the worker", () => {
    const S = chromeHuman();
    S.mainNav = nav({
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0.0.0",
      hc: 16,
    });
    S.workerNav = nav({ brands: null });
    expect(
      detectAutomation(S).checks.find((c) => c.id === "worker_mismatch").detail,
    ).toBe("differs in worker: ua, hc");
  });
});

describe("verifyInstrumentationResult with probe", () => {
  test("generated script collects the probe", async () => {
    const r = await generateInstrumentation({ obfuscationLevel: 1 });
    const js = inflateRawSync(
      Buffer.from(r.instrumentation, "base64"),
    ).toString("utf8");
    expect(js).toContain("fontWidths");
    expect(js).toContain("outerWidth");
    expect(js).toContain("native code");
  });

  test("blocking mode rejects a detected vector with blockedBy", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const S = chromeHuman();
    S.webdriver = true;
    const v = verifyInstrumentationResult(r, boundPayload(r, { p: S }));
    expect(v.valid).toBe(false);
    expect(v.reason).toBe("instr_automated_browser");
    expect(v.blockedBy).toEqual(["webdriver_true"]);
  });

  test("blocking mode requires the probe", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const v = verifyInstrumentationResult(r, boundPayload(r));
    expect(v.valid).toBe(false);
    expect(v.reason).toBe("instr_probe_missing");
  });

  test("widget-supplied viewport feeds the override check", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const S = chromeHuman();
    delete S.innerWH;
    S.screen = { width: 1280, height: 720 };
    S.outerWH = [1288, 805];
    const v = verifyInstrumentationResult(
      r,
      boundPayload(r, { p: S, vp: [1280, 720] }),
    );
    expect(v.valid).toBe(false);
    expect(v.blockedBy).toContain("viewport_override");
  });

  test("non-blocking mode passes a detected vector but reports flags", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: false });
    const S = chromeHuman();
    S.webdriver = true;
    S.tamper.toDataURL = false;
    const v = verifyInstrumentationResult(r, boundPayload(r, { p: S }));
    expect(v.valid).toBe(true);
    expect(v.riskFlags).toEqual(["native_tamper"]);
    expect(v.blockedBy).toEqual(["webdriver_true"]);
  });

  test("human vector passes in blocking mode", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const v = verifyInstrumentationResult(
      r,
      boundPayload(r, { p: chromeHuman() }),
    );
    expect(v.valid).toBe(true);
  });
});

describe("detectAutomation headless research checks", () => {
  const human = () => ({
    ...chromeHuman(),
    hev: {
      pv: "15.1.0",
      ar: "arm",
      fv: "151.0.7000.1",
      bi: "64",
      fl: "Google Chrome,Chromium,Not.A/Brand",
    },
    lies: [],
    stealth: { iframe: false, runtime: false },
    activeText: ["rgb(255, 0, 0)", false],
    evalLen: 33,
    langs: [2, true],
    host: {
      nav: { ...nav(), webdriver: false },
      doc: false,
      cdp: false,
    },
  });

  test("a desktop chrome with every new field passes with no flags", () => {
    const r = detectAutomation(human());
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toEqual([]);
  });

  test("a user agent override without hints blocks on desktop", () => {
    const S = human();
    S.uaData.brands = [];
    S.hev = { pv: "", ar: "", fv: "", bi: "", fl: "" };
    expect(detectAutomation(S).blockedBy).toContain("ua_hints_blank");
  });

  test("empty brands on android is not a block", () => {
    const S = human();
    S.ua =
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36";
    S.uaData = { mobile: true, brands: [] };
    expect(detectAutomation(S).blockedBy).not.toContain("ua_hints_blank");
  });

  test("a fake chrome.runtime or attached iframe proxy blocks", () => {
    const S = human();
    S.stealth = { iframe: true, runtime: true };
    expect(detectAutomation(S).blockedBy).toEqual(["stealth_patches"]);
  });

  test("proxied getters join native_tamper as a risk flag", () => {
    const S = human();
    S.lies = ["languages", "webdriver"];
    const r = detectAutomation(S);
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toEqual(["native_tamper"]);
  });

  test("a V8 engine claiming Firefox is flagged", () => {
    const S = firefoxHuman();
    S.evalLen = 33;
    expect(detectAutomation(S).riskFlags).toContain("engine_mismatch");
  });

  test("windows claim rendering ActiveText red is flagged", () => {
    const S = human();
    S.ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
    expect(detectAutomation(S).riskFlags).toContain("os_mismatch");
    S.activeText = ["rgb(0, 102, 204)", false];
    expect(detectAutomation(S).riskFlags).not.toContain("os_mismatch");
  });

  test("forced colors on windows is not flagged", () => {
    const S = human();
    S.ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
    S.activeText = ["rgb(255, 0, 0)", true];
    expect(detectAutomation(S).riskFlags).not.toContain("os_mismatch");
  });

  test("empty languages are flagged", () => {
    const S = human();
    S.langs = [0, false];
    expect(detectAutomation(S).riskFlags).toContain("languages_inconsistent");
  });

  test("host page values that differ from Cap's frame are flagged", () => {
    const S = human();
    S.host.nav = { ...S.host.nav, languages: "de-DE", webdriver: true };
    expect(detectAutomation(S).riskFlags).toContain("frame_mismatch");
  });

  test("a host user agent rewritten by an embedding app is not flagged", () => {
    const S = human();
    S.host.nav = { ...S.host.nav, ua: "Mozilla/5.0 Something/1.0" };
    expect(detectAutomation(S).riskFlags).not.toContain("frame_mismatch");
  });

  test("an intercepted document and host cdp are risk flags", () => {
    const S = human();
    S.host.doc = true;
    S.cdp = { trap: true, shadow: true };
    const r = detectAutomation(S);
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toEqual(["document_intercepted", "cdp_console_trap"]);
  });

  test("a worker reporting another webgl renderer is a mismatch", () => {
    const S = human();
    S.mainNav = nav({ gl: "Intel Iris OpenGL Engine" });
    S.workerNav = nav({ brands: null, gl: "ANGLE (Apple, M3)" });
    expect(detectAutomation(S).blockedBy).toContain("worker_mismatch");
  });
});

describe("malformed probe values", () => {
  const evil = { toString: 1 };
  const cases = {
    "host brands": (d) => {
      d.hp = { nav: { brands: evil } };
    },
    "main brands": (d) => {
      d.p.mainNav.brands = evil;
    },
    webdriver: (d) => {
      d.p.webdriver = evil;
    },
    ua: (d) => {
      d.p.ua = evil;
    },
    "uaData brand": (d) => {
      d.p.uaData.brands[0] = evil;
    },
    "first language": (d) => {
      d.p.langs = [evil, true];
    },
  };

  for (const [name, mutate] of Object.entries(cases)) {
    for (const block of [false, true]) {
      test(`${name} fails without throwing (block ${block})`, async () => {
        const { challenge, meta } = await issue({
          instrumentation: { blockAutomatedBrowsers: block },
        });
        const S = chromeHuman();
        const d = { p: S };
        mutate(d);
        const r = await validateChallenge(TEST_SECRET, {
          token: challenge.token,
          solutions: await solveChallengeFromPublic(challenge),
          instr: boundPayload(meta, d),
        });
        expect(r.success).toBe(false);
        expect(r.reason).toBe("failed_challenge");
        expect(() => detectAutomation({ ...S, host: d.hp })).not.toThrow();
      });
    }
  }

  test("a throw inside verification is a failure", () => {
    const meta = { id: "x", vars: [] };
    const payload = { i: "x", state: {} };
    Object.defineProperty(meta, "binding", {
      get() {
        throw new Error("boom");
      },
    });
    expect(verifyInstrumentationResult(meta, payload)).toEqual({
      valid: false,
      reason: "failed_challenge",
    });
  });
});

describe("software_renderer", () => {
  test("SwiftShader WebGL is a risk flag, not a block", () => {
    const S = chromeHuman();
    S.mainNav = {
      ...(S.mainNav ?? {}),
      gl: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
    };
    const r = detectAutomation(S);
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toContain("software_renderer");
  });

  test("a hardware renderer is clean", () => {
    const S = chromeHuman();
    S.mainNav = {
      ...(S.mainNav ?? {}),
      gl: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
    };
    expect(detectAutomation(S).riskFlags).not.toContain("software_renderer");
  });
});

describe("fingerprint consistency checks", () => {
  const real = () => ({
    ...chromeHuman(),
    hev: {
      pv: "27.2.0",
      ar: "arm",
      fv: "151.0.0.0",
      bi: "64",
      fl: "Google Chrome,Chromium",
    },
    cv: [1, 2486],
    na: 127,
    ig: [],
    sd: [],
    no: [],
    glsh: {
      r: "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
      t: "metal",
    },
    gpu: { v: "apple", a: "metal-3", f: false, n: false },
    voices: [180, 12],
    fm: 1156.99,
    fontWidths: [
      1200.87, 1156.99, 1083.7, 1200.87, 1156.96, 1080.18, 1156.99, 1244.6,
      1198.23, 1156.99, 1156.99, 1156.99, 1203.86, 1156.99, 1156.99, 1156.99,
      1156.99,
    ],
    host: { nav: {}, ha: ["lang", "class"] },
  });
  const failed = (S) =>
    detectAutomation(S)
      .checks.filter((c) => !c.passed)
      .map((c) => c.id);

  test("a real Chrome on Apple Silicon passes all of them", () => {
    const r = detectAutomation(real());
    expect(r.pass).toBe(true);
    expect(failed(real())).toEqual([]);
  });

  test("canvas noise flags without blocking", () => {
    const S = { ...real(), cv: [0, 2486] };
    const r = detectAutomation(S);
    expect(r.pass).toBe(true);
    expect(r.riskFlags).toContain("canvas_noise");
  });

  test("x86 client hints on an ARM CPU block", () => {
    const S = real();
    S.hev = { ...S.hev, ar: "x86" };
    expect(detectAutomation(S).blockedBy).toContain("arch_mismatch");
  });

  test("Android in desktop mode passes with x86 client hints", () => {
    const S = real();
    S.hev = { ...S.hev, ar: "x86" };
    S.mainNav = { ...S.mainNav, platform: "Linux armv81" };
    expect(failed(S)).not.toContain("arch_mismatch");
  });

  test("x86 client hints on ARM still block on a desktop platform", () => {
    const S = real();
    S.hev = { ...S.hev, ar: "x86" };
    S.mainNav = { ...S.mainNav, platform: "Win32" };
    expect(detectAutomation(S).blockedBy).toContain("arch_mismatch");
  });

  test("x86 client hints on an x86 CPU pass", () => {
    const S = { ...real(), na: 255 };
    S.hev = { ...S.hev, ar: "x86" };
    expect(failed(S)).not.toContain("arch_mismatch");
  });

  test("init script globals flag", () => {
    const S = { ...real(), ig: ["__pwInitScripts"] };
    expect(detectAutomation(S).riskFlags).toContain("injected_globals");
  });

  test("forged isTrusted blocks, redefined descriptors flag", () => {
    const S = { ...real(), sd: ["isTrusted", "screen", "toStringProxy"] };
    const r = detectAutomation(S);
    expect(r.blockedBy).toContain("devtools_globals");
    expect(r.riskFlags).toContain("stealth_descriptors");
  });

  test("navigator properties added back flag", () => {
    const S = { ...real(), no: ["languages"] };
    expect(detectAutomation(S).riskFlags).toContain("navigator_order");
  });

  test("a Direct3D renderer compiling Metal shaders flags", () => {
    const S = real();
    S.glsh = {
      r: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
      t: "metal",
    };
    const r = detectAutomation(S);
    expect(r.riskFlags).toContain("shader_mismatch");
    expect(r.blockedBy ?? []).not.toContain("shader_mismatch");
  });

  test("a Metal renderer compiling GLSL flags", () => {
    const S = real();
    S.glsh = { ...S.glsh, t: "glsl" };
    expect(detectAutomation(S).riskFlags).toContain("shader_mismatch");
  });

  test("Direct3D compiling GLSL passes, as Chrome 157 on Windows does", () => {
    const S = real();
    S.glsh = {
      r: "ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      t: "glsl",
    };
    expect(detectAutomation(S).riskFlags).not.toContain("shader_mismatch");
  });

  test("WebGL and WebGPU vendors disagreeing flags", () => {
    const S = { ...real(), gpu: { v: "nvidia", a: "", f: false, n: false } };
    expect(detectAutomation(S).riskFlags).toContain("webgpu_mismatch");
  });

  test("a WebGPU fallback adapter counts as a software renderer", () => {
    const S = { ...real(), gpu: { v: "apple", a: "", f: true, n: false } };
    expect(detectAutomation(S).riskFlags).toContain("software_renderer");
  });

  test("Google Chrome with no Google voices flags", () => {
    const S = { ...real(), voices: [40, 0] };
    expect(detectAutomation(S).riskFlags).toContain("voices_missing");
  });

  test("Chromium without Google voices is fine", () => {
    const S = { ...real(), voices: [180, 0] };
    S.uaData = { mobile: false, brands: ["Chromium/151", "Not.A/Brand/99"] };
    expect(failed(S)).not.toContain("voices_missing");
  });

  test("claiming Windows without Segoe UI flags", () => {
    const S = real();
    S.ua = S.ua.replace(
      "Macintosh; Intel Mac OS X 10_15_7",
      "Windows NT 10.0; Win64; x64",
    );
    expect(detectAutomation(S).riskFlags).toContain("os_fonts_mismatch");
  });

  test("automation attributes on the root element flag", () => {
    const S = real();
    S.host = { nav: {}, ha: ["lang", "data-playwright-id"] };
    expect(detectAutomation(S).riskFlags).toContain("html_automation_attr");
  });
});
