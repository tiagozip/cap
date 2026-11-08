import { describe, expect, test } from "bun:test";
import { validateChallenge } from "../src/index.js";
import {
  generateInstrumentation,
  serializeBound,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";
import {
  boundData,
  boundPayload,
  emptyTrace,
  issue,
  solveChallengeFromPublic,
  TEST_SECRET,
} from "./helpers.js";

describe("instrumentation-bound agent codes", () => {
  test("an honest report verifies and is returned", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const ag = ["cdp_trap", "cic_active", "genspark"];
    const r = verifyInstrumentationResult(meta, boundPayload(meta, { ag }));
    expect(r.valid).toBe(true);
    expect(r.agent).toEqual({
      all: ag,
      host: true,
      legacy: false,
      isolated: false,
      browser: null,
    });
  });

  test("the bound browser tells Brave and Chrome apart", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const browserOf = (hp) =>
      verifyInstrumentationResult(meta, boundPayload(meta, { hp })).agent
        .browser;
    expect(
      browserOf({ nav: { brands: "Brave/131,Chromium/131,Not_A Brand/24" } }),
    ).toBe("brave");
    expect(
      browserOf({
        nav: { brands: "Google Chrome/131,Chromium/131,Not_A Brand/24" },
      }),
    ).toBe("chrome");
    expect(browserOf({ nav: { brands: "Chromium/131" } })).toBe(null);
    expect(browserOf({ nav: { brands: null } })).toBe(null);
  });

  test("dropping or editing the codes fails verification", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const honest = boundPayload(meta, { ag: ["cic_active", "stagehand"] });
    for (const ag of [
      [],
      ["stagehand"],
      ["cic_active"],
      ["stagehand", "cic_active"],
      ["cic_active", "stagehand", "zz"],
      "cic_active,stagehand",
    ]) {
      const forged = {
        ...honest,
        d: serializeBound({ ...JSON.parse(honest.d), ag }),
      };
      const r = verifyInstrumentationResult(meta, forged);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("failed_challenge");
    }
  });

  test("unsorted, duplicated or malformed codes are rejected even when bound", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    for (const ag of [
      ["stagehand", "cic_active"],
      ["cic_active", "cic_active"],
      ["Cic"],
      Array.from({ length: 33 }, (_, i) => `a${"b".repeat(i % 20)}`).sort(),
    ]) {
      const r = verifyInstrumentationResult(meta, boundPayload(meta, { ag }));
      expect(r.valid).toBe(false);
    }
  });

  test("bound automation codes become risk flags", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const r = verifyInstrumentationResult(
      meta,
      boundPayload(meta, {
        ag: ["automation", "cdp_trap", "shadow_patched"],
        p: {},
      }),
    );
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toContain("automation_globals");
    expect(r.riskFlags).toContain("cdp_console_trap");
    expect(r.riskFlags).toContain("attach_shadow_patched");
  });

  test("the host console trap from inside the result is used", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const r = verifyInstrumentationResult(
      meta,
      boundPayload(meta, { p: {}, hp: { cdp: true } }),
    );
    expect(r.riskFlags).toContain("cdp_console_trap");
  });
});

describe("bound agent codes through validateChallenge", () => {
  async function run({ behavior, ag, bh }) {
    const { challenge, meta } = await issue({ behavior });
    const solutions = await solveChallengeFromPublic(challenge);
    return validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions,
      instr: boundPayload(meta, { ag, ...(bh && { bh }) }),
    });
  }

  test("with behavior off the bound agent is returned top-level", async () => {
    const r = await run({ ag: ["genspark"] });
    expect(r.success).toBe(true);
    expect(r.agent).toMatchObject({
      detected: true,
      name: "genspark",
      confidence: "medium",
    });
    expect(r.riskFlags).toContain("agent:genspark");
  });

  test("with behavior on the bound agent labels the verdict", async () => {
    const r = await run({ behavior: true, ag: ["cic_active"] });
    expect(r.success).toBe(true);
    expect(r.behavior.verdict).toBe("agent");
    expect(r.behavior.agent).toMatchObject({
      name: "claude-in-chrome",
      confidence: "high",
    });
  });

  test("identified agents are blocked from the bound codes alone", async () => {
    const r = await run({
      behavior: { blockAgents: "identified" },
      ag: ["stagehand"],
      bh: emptyTrace(),
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("behavior_agent");
    expect(r.behavior.agent.name).toBe("stagehand");
  });

  test("boundData fills every field the server reads", async () => {
    const meta = await generateInstrumentation({
      behavior: true,
      detectAutomatedInteractions: true,
    });
    expect(Object.keys(boundData(meta)).sort()).toEqual([
      "ag",
      "bh",
      "el",
      "hp",
      "ia",
      "p",
      "v",
      "vp",
    ]);
  });
});
