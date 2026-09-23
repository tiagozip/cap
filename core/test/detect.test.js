import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { detectAutomation, geometryStats } from "../src/detect.js";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";

const frac = (n) => Array.from({ length: n }, (_, i) => 1200.88 + i * 3.17);
const ints = (n) => Array.from({ length: n }, (_, i) => 1200 + i * 3);

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

  test("missing viewport (old widget) does not block", () => {
    const S = chromeHuman();
    delete S.innerWH;
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
});

describe("verifyInstrumentationResult with probe", () => {
  const stateFor = (r) => {
    const state = {};
    for (let i = 0; i < r.vars.length; i++)
      state[r.vars[i]] = r.expectedVals[i];
    return state;
  };

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
    const v = verifyInstrumentationResult(r, {
      i: r.id,
      state: stateFor(r),
      p: S,
    });
    expect(v.valid).toBe(false);
    expect(v.reason).toBe("instr_automated_browser");
    expect(v.blockedBy).toEqual(["webdriver_true"]);
  });

  test("blocking mode requires the probe", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const v = verifyInstrumentationResult(r, { i: r.id, state: stateFor(r) });
    expect(v.valid).toBe(false);
    expect(v.reason).toBe("instr_probe_missing");
  });

  test("widget-supplied viewport feeds the override check", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const S = chromeHuman();
    delete S.innerWH;
    S.screen = { width: 1280, height: 720 };
    S.outerWH = [1288, 805];
    const v = verifyInstrumentationResult(r, {
      i: r.id,
      state: stateFor(r),
      p: S,
      vp: [1280, 720],
    });
    expect(v.valid).toBe(false);
    expect(v.blockedBy).toContain("viewport_override");
  });

  test("non-blocking mode passes a detected vector but reports flags", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: false });
    const S = chromeHuman();
    S.webdriver = true;
    S.tamper.toDataURL = false;
    const v = verifyInstrumentationResult(r, {
      i: r.id,
      state: stateFor(r),
      p: S,
    });
    expect(v.valid).toBe(true);
    expect(v.riskFlags).toEqual(["native_tamper"]);
    expect(v.blockedBy).toEqual(["webdriver_true"]);
  });

  test("human vector passes in blocking mode", async () => {
    const r = await generateInstrumentation({ blockAutomatedBrowsers: true });
    const v = verifyInstrumentationResult(r, {
      i: r.id,
      state: stateFor(r),
      p: chromeHuman(),
    });
    expect(v.valid).toBe(true);
  });
});
