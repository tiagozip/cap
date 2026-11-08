import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { generateChallenge, validateChallenge } from "../src/index.js";
import {
  generateInstrumentation,
  MAX_BOUND_DATA,
  serializeBound,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";
import {
  boundData,
  boundPayload,
  emptyTrace,
  issue,
  rawPayload,
  solveChallengeFromPublic,
  TEST_SECRET,
} from "./helpers.js";

const human = () => ({
  ...emptyTrace(),
  m: Array.from({ length: 12 }, (_, i) => [
    3000 + i * 16.7 + (i % 3) * 1.3,
    100 + i * 30 + (i % 2) * 4.1 + i * i * 0.7,
    600 - i * 22 + (i % 3) * 2.7,
    1 + (i % 2),
    0,
  ]),
  a: {
    k: 0,
    tr: 1,
    hid: 0,
    pt: 0,
    t: 3400,
    u: 3488,
    x: 527.3,
    y: 365.2,
    cx: -40.1,
    cy: 3.3,
    w: 258,
    h: 56,
    sox: 120,
    soy: 147,
    cw: 1,
    ch: 1,
    pr: 0.5,
  },
});

const sha = (s) => createHash("sha256").update(s).digest("hex");
const solveV2 = (ch, instr) =>
  ch.challenges.map(({ protocol, payload }) => {
    if (protocol === "instrumentation") return { instr };
    for (let n = 0; ; n++) {
      if (sha(payload.salt + n).startsWith(payload.target)) return { nonce: n };
    }
  });

afterEach(() => setSystemTime());

describe("server to client tampering", () => {
  test("stripping the instrumentation blob fails redeem", async () => {
    const one = await issue();
    expect(
      (
        await validateChallenge(TEST_SECRET, {
          token: one.challenge.token,
          solutions: await solveChallengeFromPublic(one.challenge),
        })
      ).reason,
    ).toBe("instr_missing");

    const two = await issue({
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
    });
    const solutions = solveV2(two.challenge, null).map((s) =>
      "instr" in s ? {} : s,
    );
    expect(
      (
        await validateChallenge(TEST_SECRET, {
          token: two.challenge.token,
          solutions,
        })
      ).reason,
    ).toBe("instr_missing");
  });

  test("behavior required by the token cannot be switched off by the client", async () => {
    const { challenge, meta } = await issue({ behavior: { block: true } });
    expect(meta.behavior).toBe(true);
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta, { bh: null }),
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("behavior_missing");
  });

  test("behavior on a key without instrumentation still ships a script", async () => {
    const v1 = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeDifficulty: 1,
      behavior: true,
    });
    expect(typeof v1.instrumentation).toBe("string");
    const v2 = await generateChallenge(TEST_SECRET, {
      format: 2,
      protocols: ["sha256-pow"],
      challengeCount: 1,
      challengeDifficulty: 1,
      behavior: true,
    });
    expect(v2.challenges.map((c) => c.protocol)).toContain("instrumentation");
  });

  test("a downgraded format fails", async () => {
    const two = await issue({
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
    });
    const asV1 = await validateChallenge(TEST_SECRET, {
      token: two.challenge.token,
      solutions: [1, 2],
      instr: boundPayload(two.meta),
    });
    expect(asV1.success).toBe(false);
    expect(asV1.reason).toBe("invalid_solution");

    const one = await issue();
    const asV2 = await validateChallenge(TEST_SECRET, {
      token: one.challenge.token,
      solutions: [{ nonce: 1 }],
      instr: boundPayload(one.meta),
    });
    expect(asV2.success).toBe(false);
    expect(asV2.reason).toBe("invalid_solutions");
  });

  test("removing a protocol from the challenge list fails", async () => {
    const { challenge, meta } = await issue({
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
    });
    const solutions = solveV2(challenge, boundPayload(meta));
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: solutions.filter((s) => !("instr" in s)),
    });
    expect(r.reason).toBe("invalid_solutions");
  });

  test("a lowered hashwx difficulty fails", async () => {
    const ch = await generateChallenge(TEST_SECRET, {
      format: 2,
      protocols: ["hashwx"],
      hashwxDifficulty: 5_000_000,
      hashwxChallengeCount: 1,
    });
    const r = await validateChallenge(TEST_SECRET, {
      token: ch.token,
      solutions: [{ nonce: "0" }],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_solution");
  });

  test("editing the signed token fails", async () => {
    const { challenge } = await issue();
    const [h, p, s] = challenge.token.split(".");
    const body = JSON.parse(Buffer.from(p, "base64url").toString());
    body.d = 0;
    delete body.ei;
    delete body.bh;
    const forged = `${h}.${Buffer.from(JSON.stringify(body)).toString("base64url")}.${s}`;
    const r = await validateChallenge(TEST_SECRET, {
      token: forged,
      solutions: [0],
    });
    expect(r.reason).toBe("invalid_token");
  });

  test("an old challenge cannot be swapped in", async () => {
    const { challenge, meta } = await issue({ expiresMs: 1000 });
    const solutions = await solveChallengeFromPublic(challenge);
    const instr = boundPayload(meta);
    setSystemTime(new Date(Date.now() + 5000));
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions,
      instr,
    });
    expect(r.reason).toBe("expired");
  });
});

describe("script hardening", () => {
  test("binding seeds are not literals in the script", async () => {
    for (const level of [1, 3, 5]) {
      for (let n = 0; n < 20; n++) {
        const meta = await generateInstrumentation({
          obfuscationLevel: level,
          behavior: true,
        });
        const src = inflateRawSync(
          Buffer.from(meta.instrumentation, "base64"),
        ).toString();
        for (const seed of meta.binding.hs) {
          expect(src).not.toContain(String(seed));
        }
        expect(src).not.toContain("JSON.stringify(");
      }
    }
  });

  test("the script captures and freezes its natives before announcing itself", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const src = inflateRawSync(
      Buffer.from(meta.instrumentation, "base64"),
    ).toString();
    expect(src.indexOf("[native code]")).toBeLessThan(src.indexOf("cap:ready"));
    expect(src.indexOf("Object.freeze")).toBeLessThan(src.indexOf("cap:ready"));
  });
});

describe("client to server tampering", () => {
  test("replaying a valid result with the same token fails", async () => {
    const used = new Set();
    const consumeNonce = (sig) => {
      if (used.has(sig)) return false;
      used.add(sig);
      return true;
    };
    const { challenge, meta } = await issue();
    const body = {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta),
    };
    expect(
      (await validateChallenge(TEST_SECRET, body, { consumeNonce })).success,
    ).toBe(true);
    expect(
      (await validateChallenge(TEST_SECRET, body, { consumeNonce })).reason,
    ).toBe("already_redeemed");
  });

  test("a format 2 proof of work is spent by a failed instrumentation result", async () => {
    const used = new Set();
    const consumeNonce = (sig) => {
      if (used.has(sig)) return false;
      used.add(sig);
      return true;
    };
    const { challenge, meta } = await issue({
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
    });
    const bad = boundPayload(meta, { ag: ["automation"] });
    bad.state[meta.vars[0]] ^= 1;
    const first = await validateChallenge(
      TEST_SECRET,
      { token: challenge.token, solutions: solveV2(challenge, bad) },
      { consumeNonce },
    );
    expect(first.reason).toBe("failed_challenge");
    const retry = await validateChallenge(
      TEST_SECRET,
      {
        token: challenge.token,
        solutions: solveV2(challenge, boundPayload(meta)),
      },
      { consumeNonce },
    );
    expect(retry.success).toBe(false);
    expect(retry.reason).toBe("already_redeemed");
  });

  test("a result cannot be reused on another challenge", async () => {
    const a = await issue();
    const b = await issue();
    const r = await validateChallenge(TEST_SECRET, {
      token: b.challenge.token,
      solutions: await solveChallengeFromPublic(b.challenge),
      instr: boundPayload(a.meta),
    });
    expect(r.reason).toBe("id_mismatch");
  });

  test("a result for another site key fails", async () => {
    const a = await issue({ scope: "site-a" });
    const b = await issue({ scope: "site-b" });
    const crossToken = await validateChallenge(
      TEST_SECRET,
      {
        token: a.challenge.token,
        solutions: await solveChallengeFromPublic(a.challenge),
        instr: boundPayload(a.meta),
      },
      { scope: "site-b" },
    );
    expect(crossToken.reason).toBe("scope_mismatch");
    const crossResult = await validateChallenge(
      TEST_SECRET,
      {
        token: b.challenge.token,
        solutions: await solveChallengeFromPublic(b.challenge),
        instr: boundPayload(a.meta),
      },
      { scope: "site-b" },
    );
    expect(crossResult.reason).toBe("id_mismatch");
  });

  test("a result claiming an impossible clock fails", async () => {
    const meta = await generateInstrumentation({ ttlMs: 60_000 });
    const future = verifyInstrumentationResult(
      meta,
      boundPayload(meta, { el: 30_000 }),
    );
    expect(future.reason).toBe("instr_stale");
    const beyondTtl = verifyInstrumentationResult(
      meta,
      boundPayload(meta, { el: 120_000 }),
      meta.iat + 120_000,
    );
    expect(beyondTtl.reason).toBe("instr_stale");
    expect(
      verifyInstrumentationResult(
        meta,
        boundPayload(meta, { el: 30_000 }),
        meta.iat + 31_000,
      ).valid,
    ).toBe(true);
  });

  test("a result redeemed after its challenge expired fails", async () => {
    const { challenge, meta } = await issue({ expiresMs: 60_000 });
    const solutions = await solveChallengeFromPublic(challenge);
    setSystemTime(new Date(Date.now() + 61_000));
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions,
      instr: boundPayload(meta, { el: 1000 }),
    });
    expect(r.success).toBe(false);
  });

  test("oversized payloads are rejected before parsing", async () => {
    const meta = await generateInstrumentation();
    const big = boundPayload(meta, { p: { pad: "x".repeat(MAX_BOUND_DATA) } });
    const r = verifyInstrumentationResult(meta, big);
    expect(r.reason).toBe("instr_oversized");
  });

  test("prototype pollution keys are rejected", async () => {
    const meta = await generateInstrumentation();
    for (const key of ["__proto__", "constructor", "prototype"]) {
      const d = serializeBound(boundData(meta)).replace(
        '"hp":{}',
        `"hp":{"${key}":{"polluted":1}}`,
      );
      const r = verifyInstrumentationResult(meta, rawPayload(meta, d));
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("failed_challenge");
    }
    const outer = JSON.parse(
      `{"__proto__":{"polluted":1},${JSON.stringify(boundPayload(meta)).slice(1)}`,
    );
    expect(verifyInstrumentationResult(meta, outer).reason).toBe(
      "failed_challenge",
    );
    expect({}.polluted).toBeUndefined();
  });

  test("missing and extra fields fail", async () => {
    const meta = await generateInstrumentation({ behavior: true });
    const honest = boundPayload(meta);
    expect(verifyInstrumentationResult(meta, honest).valid).toBe(true);
    const { d, ...noData } = honest;
    expect(d.length).toBeGreaterThan(0);
    expect(verifyInstrumentationResult(meta, noData).reason).toBe(
      "failed_challenge",
    );
    for (const extra of ["behavior", "hp", "interactions", "ag", "bh"]) {
      expect(
        verifyInstrumentationResult(meta, { ...honest, [extra]: {} }).reason,
      ).toBe("failed_challenge");
    }
    expect(
      verifyInstrumentationResult(meta, {
        ...honest,
        state: { ...honest.state, extra: 1 },
      }).reason,
    ).toBe("failed_challenge");
    const data = boundData(meta);
    for (const bad of [
      { ...data, extra: 1 },
      Object.fromEntries(Object.entries(data).filter(([k]) => k !== "ag")),
      { ...data, v: 2 },
      { ...data, el: -1 },
      { ...data, vp: [1, "2"] },
      { ...data, p: [] },
    ]) {
      expect(
        verifyInstrumentationResult(meta, rawPayload(meta, serializeBound(bad)))
          .valid,
      ).toBe(false);
    }
  });

  test("legacy widget keys are accepted and never read", async () => {
    const meta = await generateInstrumentation({
      blockAutomatedBrowsers: true,
      detectAutomatedInteractions: true,
    });
    const honest = boundPayload(meta, {
      p: { webdriver: false },
      vp: [1280, 720],
      ia: [0, 0],
    });
    const legacy = {
      ...honest,
      vp: [1, 1],
      p: { webdriver: true },
      ts: 1,
    };
    const a = verifyInstrumentationResult(meta, honest);
    const b = verifyInstrumentationResult(meta, legacy);
    expect(b.valid).toBe(a.valid);
    expect(b.riskFlags).toEqual(a.riskFlags);
    expect(b.checks).toEqual(a.checks);
  });

  test("an unreachable host fails when a policy depends on it", async () => {
    const ia = await generateInstrumentation({
      detectAutomatedInteractions: true,
    });
    expect(
      verifyInstrumentationResult(ia, boundPayload(ia, { ia: null })).reason,
    ).toBe("instr_host_unreachable");
    const block = await generateInstrumentation({
      blockAutomatedBrowsers: true,
    });
    expect(
      verifyInstrumentationResult(
        block,
        boundPayload(block, { hp: null, p: { webdriver: false } }),
      ).reason,
    ).toBe("instr_host_unreachable");
    const plain = await generateInstrumentation({});
    const r = verifyInstrumentationResult(
      plain,
      boundPayload(plain, { hp: null }),
    );
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toContain("host_unreachable");
    const { challenge, meta } = await issue({
      behavior: { blockAgents: "identified" },
    });
    const agents = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta, { hp: null, bh: human() }),
    });
    expect(agents.reason).toBe("instr_host_unreachable");
  });

  test("a non-canonical serialization fails even with matching values", async () => {
    const meta = await generateInstrumentation();
    const data = boundData(meta);
    const reordered = JSON.stringify({ ...data, v: undefined, ...{ v: 1 } });
    const spaced = JSON.stringify(JSON.parse(serializeBound(data)), null, 1);
    for (const d of [reordered, spaced]) {
      expect(d).not.toBe(serializeBound(data));
      expect(
        verifyInstrumentationResult(meta, rawPayload(meta, d)).reason,
      ).toBe("failed_challenge");
    }
  });

  test("editing any bound field fails", async () => {
    const meta = await generateInstrumentation({
      behavior: true,
      detectAutomatedInteractions: true,
    });
    const honest = boundPayload(meta, {
      p: { webdriver: false },
      vp: [1280, 720],
      hp: { cdp: false, doc: false, nav: { platform: "MacIntel" } },
      ag: ["cic_active"],
      ia: [0, 0],
      bh: human(),
      el: 10,
    });
    expect(verifyInstrumentationResult(meta, honest).valid).toBe(true);
    const data = JSON.parse(honest.d);
    const edits = {
      p: { webdriver: true },
      vp: [1281, 720],
      hp: { cdp: true, doc: false, nav: { platform: "MacIntel" } },
      ag: [],
      ia: [0, 1],
      bh: { ...human(), a: { ...human().a, tr: 0 } },
      el: 11,
    };
    for (const [k, v] of Object.entries(edits)) {
      const forged = { ...honest, d: serializeBound({ ...data, [k]: v }) };
      const r = verifyInstrumentationResult(meta, forged);
      expect(r.valid).toBe(false);
      expect(r.reason).toBe("failed_challenge");
    }
  });

  test("a behavior trace sent outside the result is ignored", async () => {
    const { challenge, meta } = await issue({ behavior: { block: true } });
    const bot = { ...emptyTrace(), a: { k: 2, tr: 0, hid: 0, t: 4000, u: -1 } };
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta, { bh: human() }),
      behavior: bot,
      hp: { cdp: true },
      vp: [1, 1],
      interactions: { version: 1, syntheticClicks: 9 },
    });
    expect(r.success).toBe(true);
    expect(r.behavior.verdict).toBe("ok");
  });

  test("client skip markers only ever fail", async () => {
    const { challenge, meta } = await issue();
    const solutions = await solveChallengeFromPublic(challenge);
    for (const marker of [
      { instr_blocked: true },
      { instr_timeout: true },
      { instr_error: "csp_blocked" },
      { instr_error: "csp_script_blocked" },
      { instr_error: "made_up" },
    ]) {
      const r = await validateChallenge(TEST_SECRET, {
        token: challenge.token,
        solutions,
        instr: boundPayload(meta),
        ...marker,
      });
      expect(r.success).toBe(false);
    }
  });

  test("frame error codes map to known reasons and always fail", async () => {
    const cases = [
      ["csp_blocked", "instr_csp_blocked"],
      ["csp_script_blocked", "instr_csp_blocked"],
      ["natives_tampered", "instr_natives_tampered"],
      ["env_failed", "instr_env_failed"],
      ["script_failed", "instr_script_failed"],
      ["toString", "instr_failed"],
      ["<b>x</b>", "instr_failed"],
    ];
    for (const [code, reason] of cases) {
      const { challenge } = await issue();
      const r = await validateChallenge(TEST_SECRET, {
        token: challenge.token,
        solutions: await solveChallengeFromPublic(challenge),
        instr_error: code,
      });
      expect(r.success).toBe(false);
      expect(r.reason).toBe(reason);
      expect(r.instr_error).toBe(true);
    }
    const { challenge } = await issue({
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
    });
    const solutions = solveV2(challenge, null).map((s) =>
      "instr" in s ? { error: "csp_blocked" } : s,
    );
    const r = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions,
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("instr_csp_blocked");
  });

  test("a CSP-blocked eval is recorded and skips nothing else", async () => {
    const plain = await generateInstrumentation({});
    const r = verifyInstrumentationResult(
      plain,
      boundPayload(plain, { ce: 1 }),
    );
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toContain("csp_eval_blocked");
    const confirmed = verifyInstrumentationResult(
      plain,
      boundPayload(plain, { ce: 2 }),
    );
    expect(confirmed.riskFlags).toContain("csp_eval_blocked");
    expect(
      verifyInstrumentationResult(plain, boundPayload(plain, { ce: 0 }))
        .riskFlags,
    ).not.toContain("csp_eval_blocked");
    for (const ce of [3, -1, "1", true]) {
      expect(
        verifyInstrumentationResult(plain, boundPayload(plain, { ce })).reason,
      ).toBe("failed_challenge");
    }
    const block = await generateInstrumentation({
      blockAutomatedBrowsers: true,
      blockAutomatedInteractions: true,
    });
    expect(
      verifyInstrumentationResult(
        block,
        boundPayload(block, { ce: 1, ia: [4, 0], p: { webdriver: false } }),
      ).reason,
    ).toBe("instr_automated_interaction");
    expect(
      verifyInstrumentationResult(
        block,
        boundPayload(block, { ce: 1, hp: null, p: { webdriver: false } }),
      ).reason,
    ).toBe("instr_host_unreachable");
    expect(
      verifyInstrumentationResult(
        block,
        boundPayload(block, { ce: 1, p: { webdriver: true } }),
      ).reason,
    ).toBe("instr_automated_browser");
  });

  test("an early result from an old widget only passes keys that never need interaction data", async () => {
    const early = { lw: 1, ia: null, bh: null, hp: null };
    const plain = await generateInstrumentation({});
    const r = verifyInstrumentationResult(plain, boundPayload(plain, early));
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toContain("legacy_widget");
    expect(r.agent.legacy).toBe(true);

    const detect = await generateInstrumentation({
      detectAutomatedInteractions: true,
    });
    const d = verifyInstrumentationResult(detect, boundPayload(detect, early));
    expect(d.valid).toBe(true);
    expect(d.riskFlags).toContain("legacy_widget");

    const report = await generateInstrumentation({ behavior: true });
    const rp = verifyInstrumentationResult(report, boundPayload(report, early));
    expect(rp.valid).toBe(true);
    expect(rp.riskFlags).toContain("legacy_widget");

    for (const opts of [
      { blockAutomatedInteractions: true },
      { behavior: true, behaviorEnforced: true },
      { blockAutomatedBrowsers: true },
    ]) {
      const meta = await generateInstrumentation(opts);
      expect(
        verifyInstrumentationResult(
          meta,
          boundPayload(meta, { ...early, p: { webdriver: false } }),
        ).reason,
      ).toBe("instr_widget_outdated");
    }

    for (const bad of [
      { ...early, ia: [0, 0] },
      { ...early, bh: emptyTrace() },
      { ...early, lw: 2 },
      { ...early, lw: true },
    ]) {
      expect(
        verifyInstrumentationResult(detect, boundPayload(detect, bad)).reason,
      ).toBe("failed_challenge");
    }

    const { challenge, meta } = await issue({
      behavior: { blockAgents: "identified" },
    });
    const agents = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta, early),
    });
    expect(agents.success).toBe(false);
    expect(agents.reason).toBe("instr_widget_outdated");
  });

  test("an isolated frame passes report keys and fails keys that need the page", async () => {
    const iso = { is: 1, ia: null, bh: null };
    const plain = await generateInstrumentation({});
    const r = verifyInstrumentationResult(plain, boundPayload(plain, iso));
    expect(r.valid).toBe(true);
    expect(r.riskFlags).toContain("isolated_frame");
    expect(r.agent.isolated).toBe(true);
    expect(r.agent.legacy).toBe(false);

    const report = await generateInstrumentation({
      behavior: true,
      detectAutomatedInteractions: true,
    });
    expect(
      verifyInstrumentationResult(report, boundPayload(report, iso)).valid,
    ).toBe(true);

    const browsers = await generateInstrumentation({
      blockAutomatedBrowsers: true,
    });
    expect(
      verifyInstrumentationResult(
        browsers,
        boundPayload(browsers, { ...iso, p: { webdriver: true } }),
      ).reason,
    ).toBe("instr_automated_browser");

    for (const opts of [
      { blockAutomatedInteractions: true },
      { behavior: true, behaviorEnforced: true },
    ]) {
      const meta = await generateInstrumentation(opts);
      expect(
        verifyInstrumentationResult(meta, boundPayload(meta, iso)).reason,
      ).toBe("instr_isolated");
    }

    for (const bad of [
      { ...iso, ia: [0, 0] },
      { ...iso, bh: emptyTrace() },
      { ...iso, is: 2 },
      { ...iso, is: true },
    ]) {
      expect(
        verifyInstrumentationResult(plain, boundPayload(plain, bad)).reason,
      ).toBe("failed_challenge");
    }

    const { challenge, meta } = await issue({
      behavior: { blockAgents: "identified" },
    });
    const agents = await validateChallenge(TEST_SECRET, {
      token: challenge.token,
      solutions: await solveChallengeFromPublic(challenge),
      instr: boundPayload(meta, iso),
    });
    expect(agents.success).toBe(false);
    expect(agents.reason).toBe("instr_isolated");

    const reportKey = await issue({ behavior: {} });
    const passed = await validateChallenge(TEST_SECRET, {
      token: reportKey.challenge.token,
      solutions: await solveChallengeFromPublic(reportKey.challenge),
      instr: boundPayload(reportKey.meta, iso),
    });
    expect(passed.success).toBe(true);
  });
});
