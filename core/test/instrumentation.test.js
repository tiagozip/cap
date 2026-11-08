import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";
import { boundPayload } from "./helpers.js";

describe("generateInstrumentation", () => {
  test("returns expected shape", async () => {
    const r = await generateInstrumentation();
    expect(typeof r.id).toBe("string");
    expect(r.id).toHaveLength(32);
    expect(typeof r.expires).toBe("number");
    expect(r.expires).toBeGreaterThan(Date.now());
    expect(r.binding.pv).toHaveLength(4);
    expect(r.binding.pv.every((v) => Number.isInteger(v))).toBe(true);
    expect(r.binding.j[0]).not.toBe(r.binding.j[1]);
    expect(Array.isArray(r.vars)).toBe(true);
    expect(r.vars).toHaveLength(4);
    expect(typeof r.blockAutomatedBrowsers).toBe("boolean");
    expect(typeof r.instrumentation).toBe("string");
  });

  test("variable names are valid JS identifiers", async () => {
    const r = await generateInstrumentation();
    for (const v of r.vars) {
      expect(v).toMatch(/^[a-z][a-z0-9]*$/);
    }
  });

  test("bound values are within the expected range", async () => {
    const r = await generateInstrumentation();
    for (const v of Object.values(boundPayload(r).state)) {
      expect(v).toBeGreaterThanOrEqual(100_000);
      expect(v).toBeLessThan(1_000_000);
    }
  });

  test("each call produces unique ids", async () => {
    const a = await generateInstrumentation();
    const b = await generateInstrumentation();
    expect(a.id).not.toBe(b.id);
    expect(a.instrumentation).not.toBe(b.instrumentation);
  });

  test("blockAutomatedBrowsers flag flows through", async () => {
    const a = await generateInstrumentation({ blockAutomatedBrowsers: false });
    const b = await generateInstrumentation({ blockAutomatedBrowsers: true });
    expect(a.blockAutomatedBrowsers).toBe(false);
    expect(b.blockAutomatedBrowsers).toBe(true);

    const aDecompressed = inflateRawSync(
      Buffer.from(a.instrumentation, "base64"),
    ).toString("utf8");
    const bDecompressed = inflateRawSync(
      Buffer.from(b.instrumentation, "base64"),
    ).toString("utf8");
    expect(bDecompressed.length).toBeGreaterThan(aDecompressed.length);
  });

  test("custom ttlMs respected", async () => {
    const before = Date.now();
    const r = await generateInstrumentation({ ttlMs: 60_000 });
    const after = Date.now();
    expect(r.expires).toBeGreaterThanOrEqual(before + 60_000);
    expect(r.expires).toBeLessThanOrEqual(after + 60_000);
  });

  test("obfuscation level 1 produces decompressible JS", async () => {
    const r = await generateInstrumentation({ obfuscationLevel: 1 });
    const decompressed = inflateRawSync(
      Buffer.from(r.instrumentation, "base64"),
    ).toString("utf8");
    expect(decompressed).toContain("postMessage");
    expect(decompressed).toContain("cap:instr");
  });

  test("obfuscation levels 1-10 all generate working bundles", async () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const r = await generateInstrumentation({ obfuscationLevel: level });
      expect(r.instrumentation.length).toBeGreaterThan(0);
      const decompressed = inflateRawSync(
        Buffer.from(r.instrumentation, "base64"),
      ).toString("utf8");
      expect(decompressed.length).toBeGreaterThan(0);
    }
  }, 30_000);

  test("levels above 10 are clamped", async () => {
    const r = await generateInstrumentation({ obfuscationLevel: 50 });
    expect(r.instrumentation.length).toBeGreaterThan(0);
  }, 15_000);

  test("levels below 1 are clamped", async () => {
    const r = await generateInstrumentation({ obfuscationLevel: -5 });
    expect(r.instrumentation.length).toBeGreaterThan(0);
  });
});

describe("verifyInstrumentationResult", () => {
  test("returns valid for matching state", async () => {
    const r = await generateInstrumentation();
    const result = verifyInstrumentationResult(r, boundPayload(r));
    expect(result.valid).toBe(true);
  });

  test("rejects wrong id", async () => {
    const r = await generateInstrumentation();
    const result = verifyInstrumentationResult(r, {
      ...boundPayload(r),
      i: "wrong-id",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("id_mismatch");
  });

  test("rejects missing state", async () => {
    const r = await generateInstrumentation();
    const result = verifyInstrumentationResult(r, { i: r.id });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_state");
  });

  test("rejects state with mismatched values", async () => {
    const r = await generateInstrumentation();
    const payload = boundPayload(r);
    payload.state[r.vars[0]] = 0;
    const result = verifyInstrumentationResult(r, payload);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("failed_challenge");
  });

  test("rejects state missing a variable", async () => {
    const r = await generateInstrumentation();
    const payload = boundPayload(r);
    delete payload.state[r.vars[3]];
    const result = verifyInstrumentationResult(r, payload);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("failed_challenge");
  });

  test("rejects null payload", async () => {
    const r = await generateInstrumentation();
    expect(verifyInstrumentationResult(r, null).valid).toBe(false);
    expect(verifyInstrumentationResult(r, undefined).valid).toBe(false);
    expect(verifyInstrumentationResult(r, "string").valid).toBe(false);
  });

  test("rejects null challenge meta", () => {
    expect(verifyInstrumentationResult(null, { i: "x", state: {} }).valid).toBe(
      false,
    );
  });

  test("regression: navigator.plugins check should be removed (#235)", async () => {
    const r = await generateInstrumentation({
      blockAutomatedBrowsers: true,
      obfuscationLevel: 1,
    });
    const decompressed = inflateRawSync(
      Buffer.from(r.instrumentation, "base64"),
    ).toString("utf8");
    expect(decompressed).not.toContain("navigator.plugins.length === 0");
    expect(decompressed).not.toContain("navigator.languages.length === 0");
  });

  test("regression: any navigator own property must not block (#294)", async () => {
    for (let i = 0; i < 25; i++) {
      const r = await generateInstrumentation({
        blockAutomatedBrowsers: true,
        obfuscationLevel: 1,
      });
      const decompressed = inflateRawSync(
        Buffer.from(r.instrumentation, "base64"),
      ).toString("utf8");
      expect(decompressed).not.toContain(
        "Object.getOwnPropertyNames(navigator).length !== 0",
      );
    }
  });

  test("window marker check covers the automation globals from Castle", async () => {
    const globals = [
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
    for (let i = 0; i < 200; i++) {
      const r = await generateInstrumentation({
        blockAutomatedBrowsers: true,
        obfuscationLevel: 1,
      });
      const src = inflateRawSync(
        Buffer.from(r.instrumentation, "base64"),
      ).toString("utf8");
      const list =
        /var \w+ = (\[[\d,]+\]); for \(const k of Object\.getOwnPropertyNames\(window\)\) \{ if/.exec(
          src,
        );
      if (!list) continue;
      const seed = Number(/\(s\)\{return \w+\(s,(\d+)\)\}/.exec(src)[1]);
      const hash = (s) => {
        let h = seed >>> 0;
        for (let j = 0; j < s.length; j++) {
          h ^= s.charCodeAt(j);
          h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
        }
        return h >>> 0;
      };
      const hashes = JSON.parse(list[1]);
      for (const g of globals) expect(hashes).toContain(hash(g));
      return;
    }
    throw new Error("window marker check was never sampled");
  });
});
