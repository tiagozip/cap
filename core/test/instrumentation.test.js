import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";

describe("generateInstrumentation", () => {
  test("returns expected shape", async () => {
    const r = await generateInstrumentation();
    expect(typeof r.id).toBe("string");
    expect(r.id).toHaveLength(32);
    expect(typeof r.expires).toBe("number");
    expect(r.expires).toBeGreaterThan(Date.now());
    expect(Array.isArray(r.expectedVals)).toBe(true);
    expect(r.expectedVals).toHaveLength(4);
    expect(r.expectedVals.every((v) => Number.isInteger(v))).toBe(true);
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

  test("expectedVals are within the expected range", async () => {
    const r = await generateInstrumentation();
    for (const v of r.expectedVals) {
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
    const state = {};
    for (let i = 0; i < r.vars.length; i++)
      state[r.vars[i]] = r.expectedVals[i];
    const result = verifyInstrumentationResult(r, { i: r.id, state });
    expect(result.valid).toBe(true);
  });

  test("rejects wrong id", async () => {
    const r = await generateInstrumentation();
    const state = {};
    for (let i = 0; i < r.vars.length; i++)
      state[r.vars[i]] = r.expectedVals[i];
    const result = verifyInstrumentationResult(r, { i: "wrong-id", state });
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
    const state = {};
    for (let i = 0; i < r.vars.length; i++)
      state[r.vars[i]] = r.expectedVals[i];
    state[r.vars[0]] = 0;
    const result = verifyInstrumentationResult(r, { i: r.id, state });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("failed_challenge");
  });

  test("rejects state missing a variable", async () => {
    const r = await generateInstrumentation();
    const state = {};
    for (let i = 0; i < r.vars.length - 1; i++)
      state[r.vars[i]] = r.expectedVals[i];
    const result = verifyInstrumentationResult(r, { i: r.id, state });
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
});
