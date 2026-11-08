import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
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

const source = (meta) =>
  inflateRawSync(Buffer.from(meta.instrumentation, "base64")).toString();

describe("interaction reporting", () => {
  test("observation is strictly opt-in", async () => {
    for (const option of [undefined, false, "true", true]) {
      const meta = await generateInstrumentation({
        detectAutomatedInteractions: option,
        obfuscationLevel: 1,
      });
      expect(source(meta).includes("observe:true")).toBe(option === true);
      expect(meta.detectAutomatedInteractions).toBe(option === true);
    }
  });

  test("behavior scoring also keeps the script observing", async () => {
    const meta = await generateInstrumentation({
      behavior: true,
      obfuscationLevel: 1,
    });
    expect(source(meta)).toContain("observe:true");
    expect(source(meta)).toContain("cap:finalize");
  });

  test("bound counts of three or more become flags", async () => {
    const meta = await generateInstrumentation({
      detectAutomatedInteractions: true,
    });
    expect(
      verifyInstrumentationResult(meta, boundPayload(meta, { ia: [3, 4] })),
    ).toMatchObject({
      valid: true,
      riskFlags: [
        "interaction_synthetic_clicks",
        "interaction_synthetic_keydowns",
      ],
    });
    for (const ia of [
      [0, 0],
      [2, 2],
    ]) {
      const r = verifyInstrumentationResult(meta, boundPayload(meta, { ia }));
      expect(r.valid).toBe(true);
      expect(r.riskFlags).toEqual([]);
    }
  });

  test("malformed bound counts are rejected", async () => {
    const meta = await generateInstrumentation({
      detectAutomatedInteractions: true,
    });
    for (const ia of [[-1, 0], [256, 0], [3.5, 0], ["3", 0], [1], {}]) {
      const r = verifyInstrumentationResult(meta, boundPayload(meta, { ia }));
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("failed_challenge");
    }
  });

  test("counts are ignored when the challenge did not ask for them", async () => {
    const meta = await generateInstrumentation({});
    const r = verifyInstrumentationResult(
      meta,
      boundPayload(meta, { ia: [9, 9] }),
    );
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toEqual([]);
  });

  test("counts sent next to the result instead of inside it are ignored", async () => {
    const meta = await generateInstrumentation({
      blockAutomatedInteractions: true,
    });
    const r = verifyInstrumentationResult(meta, {
      ...boundPayload(meta),
      interactions: { version: 1, syntheticClicks: 0, syntheticKeydowns: 0 },
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("failed_challenge");
  });

  test("a result that could not count interactions fails", async () => {
    const meta = await generateInstrumentation({
      detectAutomatedInteractions: true,
    });
    const r = verifyInstrumentationResult(
      meta,
      boundPayload(meta, { ia: null, hp: null }),
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("instr_host_unreachable");
  });
});

for (const format of [1, 2]) {
  test(`format ${format} carries the authenticated interaction-blocking policy`, async () => {
    const { challenge, meta } = await issue({
      format,
      protocols: ["instrumentation"],
      instrumentation: {
        blockAutomatedInteractions: true,
        obfuscationLevel: 1,
      },
    });
    expect(meta.detectAutomatedInteractions).toBe(true);
    const run = async (ia) => {
      const instr = boundPayload(meta, { ia });
      const solutions =
        format === 2 ? [{ instr }] : await solveChallengeFromPublic(challenge);
      return validateChallenge(TEST_SECRET, {
        token: challenge.token,
        solutions,
        instr,
      });
    };
    const blocked = await run([0, 3]);
    expect(blocked.success).toBe(false);
    expect(blocked.reason).toBe("instr_automated_interaction");
    const ok = await run([2, 2]);
    expect(ok.success).toBe(true);
  });
}
