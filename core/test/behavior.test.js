import { describe, expect, test } from "bun:test";
import { analyzeBehavior, validateTrace } from "../src/behavior.js";
import { validateChallenge } from "../src/index.js";
import {
  boundPayload,
  issue,
  solveChallengeFromPublic,
  TEST_SECRET,
} from "./helpers.js";

const ENV = [1440, 820, 2, 1, 0, 87, 120, 60];

function base(over = {}) {
  return {
    v: 1,
    res: 0.1,
    now: 5000,
    vis: 300,
    last: 3400,
    env: ENV,
    n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ag: [],
    us: -1,
    m: [],
    k: [],
    a: null,
    ...over,
  };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function humanMoves(tx, ty, t1, r = rng(7)) {
  const out = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const e = 1 - (1 - p) ** 3;
    const bow = Math.sin(p * Math.PI) * 60;
    out.push([
      Math.round((t1 - 700 + p * 650 + r() * 3) * 10) / 10,
      Math.round((80 + (tx - 80) * e + bow * 0.3 + (r() - 0.5) * 2) * 10) / 10,
      Math.round((600 + (ty - 600) * e - bow + (r() - 0.5) * 2) * 10) / 10,
      1 + Math.floor(r() * 3),
      0,
    ]);
  }
  out.push([t1 - 20, tx, ty, 1, 0]);
  return out;
}

function pointerAct(over = {}) {
  return {
    k: 0,
    tr: 1,
    hid: 0,
    pt: 0,
    t: 4000,
    u: 4088,
    x: 512.4,
    y: 331.7,
    cx: -61.3,
    cy: 4.2,
    w: 258,
    h: 56,
    sox: 120,
    soy: 147,
    cw: 1,
    ch: 1,
    pr: 0.5,
    ...over,
  };
}

describe("analyzeBehavior", () => {
  test("a human mouse approach scores ok", () => {
    const r = analyzeBehavior(
      base({ m: humanMoves(512.4, 331.7, 4000), a: pointerAct() }),
    );
    expect(r.flags).toEqual([]);
    expect(r.verdict).toBe("ok");
    expect(r.score).toBe(0);
  });

  test("missing trace is reported as missing, not scored", () => {
    expect(analyzeBehavior(undefined).verdict).toBe("missing");
    expect(analyzeBehavior(null).score).toBe(null);
  });

  test("malformed traces are strong evidence", () => {
    for (const bad of [
      {},
      base({ v: 2 }),
      base({ m: [[0, "1", 2, 1, 0]] }),
      base({ m: Array.from({ length: 400 }, (_, i) => [i, 1, 1, 1, 0]) }),
      base({ a: { k: 9 } }),
      base({ a: pointerAct({ pr: 4 }) }),
      base({ env: [1, 2] }),
      base({ n: [0, 0, 0, 0, 0, 0, 0, 0, 0, -1] }),
    ]) {
      const r = analyzeBehavior(bad);
      expect(r.flags).toEqual(["bh_malformed"]);
      expect(r.verdict).toBe("automated");
    }
    expect(validateTrace(base())).toBe(null);
  });

  test("page.click() style warp is suspicious but capped below automated", () => {
    const r = analyzeBehavior(
      base({
        m: [[3998.5, 400, 225, 1, 0]],
        a: pointerAct({ t: 3999.9, u: 3999.9, x: 400, y: 225, cx: 0, cy: 0 }),
      }),
    );
    expect(r.flags).toEqual(
      expect.arrayContaining([
        "bh_warp_click",
        "bh_instant_press",
        "bh_center_hit",
      ]),
    );
    expect(r.score).toBeLessThanOrEqual(0.6);
    expect(r.verdict).toBe("suspicious");

    const strict = analyzeBehavior(
      base({
        m: [[3998.5, 400, 225, 1, 0]],
        a: pointerAct({ t: 3999.9, u: 3999.9, x: 400, y: 225, cx: 0, cy: 0 }),
      }),
      { strict: true },
    );
    expect(strict.score).toBeGreaterThan(0.6);
  });

  test("voice-control style warp with a human press is mild", () => {
    const r = analyzeBehavior(
      base({
        m: [
          [1000, 90, 700, 1, 0],
          [3950, 520, 330, 1, 0],
        ],
        a: pointerAct({ t: 4000, u: 4080, x: 520, y: 330, cx: -2, cy: 1.5 }),
      }),
    );
    expect(r.flags).toEqual(["bh_warp_click"]);
    expect(r.verdict).toBe("ok");
  });

  test("a resting cursor that was already on the widget is not a warp", () => {
    const moves = humanMoves(512.4, 331.7, 1500);
    const r = analyzeBehavior(base({ m: moves, a: pointerAct({ t: 4000 }) }));
    expect(r.flags).not.toContain("bh_warp_click");
  });

  test("interpolated mouse.move steps are caught even with junk around them", () => {
    const m = [[0, 0, 0, 2, 0]];
    for (let i = 0; i <= 15; i++) {
      m.push([2000 + i * 16.7, 40 + i * 33, 600 - i * 17, 1, 0]);
    }
    m.push([2300, 535.2, 344.9, 1, 0]);
    const r = analyzeBehavior(
      base({
        m,
        a: pointerAct({ t: 2400, u: 2490, x: 535.2, y: 344.9, cx: 3, cy: 2 }),
      }),
    );
    expect(r.flags).toContain("bh_linear_path");
    expect(r.verdict).toBe("automated");
  });

  test("untrusted activation is strong", () => {
    const r = analyzeBehavior(
      base({ a: { k: 2, tr: 0, hid: 0, t: 4000, u: -1 } }),
    );
    expect(r.flags).toEqual(["bh_untrusted_activation"]);
    expect(r.verdict).toBe("automated");
  });

  test("assistive-tech and keyboard activation are never scored on timing", () => {
    const at = analyzeBehavior(
      base({ a: { k: 2, tr: 1, hid: 0, t: 4000, u: -1 } }),
    );
    expect(at.flags).toEqual([]);
    expect(at.verdict).toBe("ok");
    const key = analyzeBehavior(
      base({ a: { k: 1, tr: 1, hid: 0, t: 4000, u: 4001 } }),
    );
    expect(key.flags).toEqual(["bh_instant_key"]);
    expect(key.verdict).toBe("ok");
  });

  test("coarse clocks (resistFingerprinting, Tor) skip timing flags", () => {
    const r = analyzeBehavior(
      base({
        res: 100,
        vis: 3950,
        m: humanMoves(512.4, 331.7, 4000),
        a: pointerAct({ t: 4000, u: 4000 }),
      }),
    );
    expect(r.flags).not.toContain("bh_instant_press");
    expect(r.flags).not.toContain("bh_too_fast");
  });

  test("pointer activation before the widget was ever visible", () => {
    const r = analyzeBehavior(
      base({ vis: -1, m: humanMoves(512.4, 331.7, 4000), a: pointerAct() }),
    );
    expect(r.flags).toContain("bh_activation_unseen");
  });

  test("CDP screen-coordinate leak only counts with browser chrome present", () => {
    const leak = analyzeBehavior(
      base({
        m: humanMoves(512.4, 331.7, 4000),
        a: pointerAct({ sox: 0, soy: 0 }),
      }),
    );
    expect(leak.flags).toContain("bh_screen_coords_leak");
    const kiosk = analyzeBehavior(
      base({
        env: [1440, 900, 2, 1, 1, 0, 0, 0],
        m: humanMoves(512.4, 331.7, 4000),
        a: pointerAct({ sox: 0, soy: 0 }),
      }),
    );
    expect(kiosk.flags).not.toContain("bh_screen_coords_leak");
  });

  test("an iOS tap with zero screen offset is not a CDP leak", () => {
    const tap = analyzeBehavior(
      base({
        m: humanMoves(512.4, 331.7, 4000),
        a: pointerAct({ sox: 0, soy: 0, pt: 2 }),
      }),
    );
    expect(tap.flags).not.toContain("bh_screen_coords_leak");
  });

  test("metronome typing vs human typing", () => {
    const bot = [];
    for (let i = 0; i < 16; i++)
      bot.push([100 + i * 54 + (i === 7 ? 40 : 0), 52]);
    expect(analyzeBehavior(base({ k: bot })).flags).toContain(
      "bh_uniform_typing",
    );

    const r = rng(3);
    const human = [];
    let t = 100;
    for (let i = 0; i < 24; i++) {
      t += 90 + r() * 220;
      human.push([Math.round(t), Math.round(60 + r() * 90)]);
    }
    expect(analyzeBehavior(base({ k: human })).flags).toEqual([]);
  });

  test("superhuman typing", () => {
    const r = rng(5);
    const agent = [];
    let t = 100;
    for (let i = 0; i < 10; i++) {
      t += 6 + r() * 10;
      agent.push([Math.round(t), 2]);
    }
    expect(analyzeBehavior(base({ k: agent })).flags).toContain(
      "bh_superhuman_typing",
    );

    const fast = [];
    t = 100;
    for (let i = 0; i < 12; i++) {
      t += 45 + r() * 120;
      fast.push([Math.round(t), Math.round(40 + r() * 60)]);
    }
    expect(analyzeBehavior(base({ k: fast })).flags).not.toContain(
      "bh_superhuman_typing",
    );
  });

  test("replay flag comes from the caller", () => {
    const tr = base({ m: humanMoves(512.4, 331.7, 4000), a: pointerAct() });
    const r = analyzeBehavior(tr, { replayed: true });
    expect(r.flags).toEqual(["bh_replayed"]);
    expect(r.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(analyzeBehavior(base()).digest).toBe(null);
  });
});

describe("behavior policy through validateChallenge", () => {
  const human = () =>
    base({ m: humanMoves(512.4, 331.7, 4000), a: pointerAct() });
  const bot = () => base({ a: { k: 2, tr: 0, hid: 0, t: 4000, u: -1 } });

  async function solve(opts, behavior, vopts) {
    const { challenge: ch, meta } = await issue(opts);
    const instr = boundPayload(meta, { bh: behavior ?? null });
    let solutions;
    if (ch.format === 2) {
      const { createHash } = await import("node:crypto");
      solutions = ch.challenges.map(({ protocol, payload }) => {
        if (protocol === "instrumentation") return { instr };
        for (let n = 0; ; n++) {
          const h = createHash("sha256")
            .update(payload.salt + n)
            .digest("hex");
          if (h.startsWith(payload.target)) return { nonce: n };
        }
      });
    } else {
      solutions = await solveChallengeFromPublic(ch);
    }
    return {
      ch,
      result: await validateChallenge(
        TEST_SECRET,
        {
          token: ch.token,
          solutions,
          ...(ch.format !== 2 && { instr }),
          behavior,
        },
        vopts,
      ),
    };
  }

  for (const format of [1, 2]) {
    const f = format === 2 ? { format: 2, protocols: ["sha256-pow"] } : {};

    test(`format ${format}: report mode returns score and flags`, async () => {
      const { ch, result } = await solve({ ...f, behavior: true }, bot());
      expect(ch.behavior).toBe(true);
      expect(result.success).toBe(true);
      expect(result.behavior.verdict).toBe("automated");
      expect(result.riskFlags).toContain("bh_untrusted_activation");
    });

    test(`format ${format}: block mode rejects automated and missing`, async () => {
      const blocked = await solve({ ...f, behavior: { block: true } }, bot());
      expect(blocked.result.success).toBe(false);
      expect(blocked.result.reason).toBe("behavior_automated");

      const missing = await solve({ ...f, behavior: { block: true } });
      expect(missing.result.reason).toBe("behavior_missing");

      const ok = await solve({ ...f, behavior: { block: true } }, human());
      expect(ok.result.success).toBe(true);
      expect(ok.result.behavior.verdict).toBe("ok");
    });

    test(`format ${format}: no-interaction policy`, async () => {
      const none = base();
      const strict = await solve({ ...f, behavior: { block: true } }, none);
      expect(strict.result.reason).toBe("behavior_no_interaction");
      const lax = await solve(
        { ...f, behavior: { block: true, requireInteraction: false } },
        none,
      );
      expect(lax.result.success).toBe(true);
    });
  }

  test("no behavior option means the trace is ignored", async () => {
    const { ch, result } = await solve({}, bot());
    expect(ch.behavior).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.behavior).toBeUndefined();
    expect(result.riskFlags).toEqual([]);
  });

  test("replay callback marks a reused trace", async () => {
    const seen = new Set();
    const check = (d) => {
      const dup = seen.has(d);
      seen.add(d);
      return dup;
    };
    const tr = human();
    const a = await solve({ behavior: true }, tr, {
      behaviorReplayCheck: check,
    });
    expect(a.result.behavior.flags).toEqual([]);
    const b = await solve({ behavior: { block: true } }, tr, {
      behaviorReplayCheck: check,
    });
    expect(b.result.reason).toBe("behavior_automated");
    expect(b.result.behavior.flags).toContain("bh_replayed");
  });
});

describe("humanizer paths, hidden pages and scripted scrolls", () => {
  function bezierMoves(p0, p1, p2, p3, steps, t0) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x =
        u ** 3 * p0[0] +
        3 * u * u * t * p1[0] +
        3 * u * t * t * p2[0] +
        t ** 3 * p3[0];
      const y =
        u ** 3 * p0[1] +
        3 * u * u * t * p1[1] +
        3 * u * t * t * p2[1] +
        t ** 3 * p3[1];
      out.push([
        t0 + i * 16.7,
        Math.round(x * 100) / 100,
        Math.round(y * 100) / 100,
        1,
        0,
      ]);
    }
    return out;
  }

  function minJerkMoves(r, { noise, quantum }) {
    const out = [];
    const n = 20 + Math.floor(r() * 30);
    const sx = r() * 400;
    const sy = 400 + r() * 300;
    const tx = 500 + r() * 300;
    const ty = 200 + r() * 200;
    const bow = (r() - 0.5) * 160;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const e = 10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5;
      let x = sx + (tx - sx) * e + Math.sin(s * Math.PI) * bow * 0.5;
      let y = sy + (ty - sy) * e + Math.sin(s * Math.PI) * bow;
      x += (r() - 0.5) * 2 * noise;
      y += (r() - 0.5) * 2 * noise;
      if (quantum) {
        x = Math.round(x / quantum) * quantum;
        y = Math.round(y / quantum) * quantum;
      }
      out.push([
        3000 + i * 8.3,
        Math.round(x * 100) / 100,
        Math.round(y * 100) / 100,
        1,
        0,
      ]);
    }
    return out;
  }

  const press = (m) => {
    const last = m[m.length - 1];
    return pointerAct({
      t: last[0] + 120,
      u: last[0] + 210,
      x: last[1],
      y: last[2],
      cx: -31,
      cy: 5,
    });
  };

  test("cubic Bézier (ghost-cursor) is flagged", () => {
    const m = bezierMoves(
      [60, 640],
      [180, 300],
      [420, 520],
      [530, 340],
      30,
      3000,
    );
    const r = analyzeBehavior(base({ m, a: press(m) }));
    expect(r.flags).toContain("bh_polynomial_path");
    expect(r.verdict).toBe("automated");
  });

  test("quadratic Bézier is flagged too", () => {
    const m = bezierMoves(
      [60, 640],
      [300, 200],
      [300, 200],
      [530, 340],
      25,
      3000,
    );
    expect(analyzeBehavior(base({ m, a: press(m) })).flags).toContain(
      "bh_polynomial_path",
    );
  });

  test("2000 simulated human reaches never trip the Bézier or linear checks", () => {
    const r = rng(11);
    for (let i = 0; i < 2000; i++) {
      const variant = [
        { noise: 0.3, quantum: 0 },
        { noise: 0.15, quantum: 0.5 },
        { noise: 0, quantum: 1 },
        { noise: 0, quantum: 0.5 },
      ][i % 4];
      const m = minJerkMoves(r, variant);
      const res = analyzeBehavior(base({ m, a: press(m) }));
      expect(res.flags).not.toContain("bh_polynomial_path");
      expect(res.flags).not.toContain("bh_linear_path");
    }
  });

  test("jitter on top of a Bézier defeats it (documented limit)", () => {
    const r = rng(5);
    const m = bezierMoves(
      [60, 640],
      [180, 300],
      [420, 520],
      [530, 340],
      30,
      3000,
    ).map((p) => [p[0], p[1] + (r() - 0.5), p[2] + (r() - 0.5), 1, 0]);
    expect(analyzeBehavior(base({ m, a: press(m) })).flags).not.toContain(
      "bh_polynomial_path",
    );
  });

  test("activation on a hidden page is strong", () => {
    const r = analyzeBehavior(
      base({ m: humanMoves(512.4, 331.7, 4000), a: pointerAct({ hid: 1 }) }),
    );
    expect(r.flags).toEqual(["bh_hidden_activation"]);
    expect(r.verdict).toBe("automated");
  });

  test("a scripted scroll right before the press is weak", () => {
    const m = humanMoves(512.4, 331.7, 4000);
    const recent = analyzeBehavior(base({ us: 3900, m, a: pointerAct() }));
    expect(recent.flags).toEqual(["bh_unexplained_scroll"]);
    expect(recent.verdict).toBe("ok");
    const old = analyzeBehavior(base({ us: 500, m, a: pointerAct() }));
    expect(old.flags).toEqual([]);
  });
});
