import { createHash } from "node:crypto";

export const BEHAVIOR_VERSION = 1;
export const WEAK_CAP = 0.6;
export const DEFAULT_BEHAVIOR_THRESHOLD = 0.75;
export const SUSPICIOUS_THRESHOLD = 0.4;

const MAX_MOVES = 320;
const MAX_KEYS = 64;
const MAX_TIME = 6 * 60 * 60 * 1000;
const MAX_COORD = 100_000;

const FINE_CLOCK_MS = 2;

export const BEHAVIOR_WEIGHTS = {
  bh_malformed: 0.9,
  bh_replayed: 0.95,
  bh_untrusted_activation: 0.9,
  bh_linear_path: 0.85,
  bh_polynomial_path: 0.85,
  bh_hidden_activation: 0.85,
  bh_uniform_typing: 0.75,
  bh_superhuman_typing: 0.5,
  bh_activation_unseen: 0.7,
  bh_too_fast: 0.6,
  bh_screen_coords_leak: 0.5,
  bh_warp_click: 0.35,
  bh_instant_press: 0.3,
  bh_center_hit: 0.3,
  bh_instant_key: 0.2,
  bh_idle_then_act: 0.15,
  bh_touch_geometry: 0.15,
  bh_unexplained_scroll: 0.3,
};

const STRONG = new Set([
  "bh_malformed",
  "bh_replayed",
  "bh_untrusted_activation",
  "bh_linear_path",
  "bh_polynomial_path",
  "bh_hidden_activation",
  "bh_uniform_typing",
  "bh_superhuman_typing",
  "bh_activation_unseen",
  "bh_too_fast",
  "bh_screen_coords_leak",
]);

const PT_MOUSE = 0;
const PT_PEN = 1;
const PT_TOUCH = 2;

const ACT_POINTER = 0;
const ACT_KEY = 1;
const ACT_CLICK = 2;

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const inRange = (x, lo, hi) => isNum(x) && x >= lo && x <= hi;
const isTime = (x) => inRange(x, -10_000, MAX_TIME);
const isCoord = (x) => inRange(x, -MAX_COORD, MAX_COORD);

function mean(a) {
  let s = 0;
  for (const x of a) s += x;
  return a.length ? s / a.length : 0;
}

function cv(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  if (m === 0) return 0;
  let v = 0;
  for (const x of a) v += (x - m) ** 2;
  return Math.sqrt(v / a.length) / Math.abs(m);
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function nearMedian(a, tol) {
  const m = median(a);
  if (!m) return null;
  let k = 0;
  for (const x of a) if (Math.abs(x - m) <= tol * m) k++;
  return k / a.length;
}

const round = (x, d = 3) => (x === null ? null : Number(x.toFixed(d)));

export function validateTrace(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "type";
  if (t.v !== BEHAVIOR_VERSION) return "version";
  if (!inRange(t.res, 0, 1000)) return "res";
  if (!isTime(t.now) || !isTime(t.vis) || !isTime(t.last)) return "times";
  if (!isTime(t.us)) return "times";

  if (!Array.isArray(t.env) || t.env.length !== 8) return "env";
  if (!t.env.every((x) => isNum(x) && Math.abs(x) <= MAX_COORD)) return "env";

  if (!Array.isArray(t.n) || (t.n.length !== 10 && t.n.length !== 11))
    return "counters";
  if (!t.n.every((x) => Number.isInteger(x) && x >= 0 && x <= 1e7))
    return "counters";

  if (!Array.isArray(t.m) || t.m.length > MAX_MOVES) return "moves";
  let prevT = -Infinity;
  for (const p of t.m) {
    if (!Array.isArray(p) || p.length !== 5) return "move";
    const [pt, x, y, c, ptype] = p;
    if (!isTime(pt) || !isCoord(x) || !isCoord(y)) return "move";
    if (!Number.isInteger(c) || c < 0 || c > 1000) return "move";
    if (ptype !== PT_MOUSE && ptype !== PT_PEN && ptype !== PT_TOUCH)
      return "move";
    if (pt < prevT - 1000) return "move_order";
    prevT = Math.max(prevT, pt);
  }

  if (!Array.isArray(t.k) || t.k.length > MAX_KEYS) return "keys";
  for (const k of t.k) {
    if (!Array.isArray(k) || k.length !== 2) return "key";
    if (!isTime(k[0]) || !inRange(k[1], -1, 60_000)) return "key";
  }

  if (t.a !== null) {
    const a = t.a;
    if (!a || typeof a !== "object" || Array.isArray(a)) return "activation";
    if (![ACT_POINTER, ACT_KEY, ACT_CLICK].includes(a.k)) return "activation";
    if (a.tr !== 0 && a.tr !== 1) return "activation";
    if (a.hid !== 0 && a.hid !== 1) return "activation";
    if (!isTime(a.t) || !isTime(a.u)) return "activation";
    if (a.k === ACT_POINTER) {
      if (![PT_MOUSE, PT_PEN, PT_TOUCH].includes(a.pt)) return "activation";
      for (const f of ["x", "y", "cx", "cy", "w", "h", "sox", "soy"]) {
        if (!isCoord(a[f])) return "activation";
      }
      if (!inRange(a.cw, 0, 10_000) || !inRange(a.ch, 0, 10_000))
        return "activation";
      if (!inRange(a.pr, 0, 1)) return "activation";
    }
  }
  return null;
}

export function traceDigest(t) {
  const q = (x, s) => Math.round(x / s);
  const parts = [];
  for (const p of t.m) parts.push(q(p[0], 4), q(p[1], 2), q(p[2], 2));
  parts.push("|");
  for (const k of t.k) parts.push(q(k[1], 4));
  if (t.a) parts.push("|", t.a.k, q(t.a.cx ?? 0, 2), q(t.a.cy ?? 0, 2));
  return createHash("sha256").update(parts.join(",")).digest("hex");
}

function runStats(win) {
  const x0 = win[0][1];
  const y0 = win[0][2];
  const x1 = win[win.length - 1][1];
  const y1 = win[win.length - 1][2];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const disp = Math.hypot(dx, dy);
  const steps = [];
  let len = 0;
  let maxDev = 0;
  for (let i = 1; i < win.length; i++) {
    const s = Math.hypot(win[i][1] - win[i - 1][1], win[i][2] - win[i - 1][2]);
    steps.push(s);
    len += s;
    if (disp > 0) {
      const dev =
        Math.abs(dy * win[i][1] - dx * win[i][2] + x1 * y0 - y1 * x0) / disp;
      if (dev > maxDev) maxDev = dev;
    }
  }
  return {
    samples: win.length,
    displacement: disp,
    straightness: disp > 0 ? len / disp : null,
    maxDeviation: maxDev,
    stepCv: cv(steps),
  };
}

function diffs(run, axis, order) {
  let d = run.map((p) => p[axis]);
  for (let k = 0; k < order; k++) {
    const next = [];
    for (let i = 1; i < d.length; i++) next.push(d[i] - d[i - 1]);
    d = next;
  }
  return d;
}

const spread = (a) => Math.max(...a) - Math.min(...a);

const RUN = 8;
const LINEAR_TOL = 0.05;
const POLY_TOL = 0.1;

function polynomialRuns(win) {
  let linear = false;
  let polynomial = false;
  for (let i = 0; i + RUN <= win.length; i++) {
    const run = win.slice(i, i + RUN);
    let moving = true;
    for (let j = 1; j < run.length; j++) {
      if (
        Math.hypot(run[j][1] - run[j - 1][1], run[j][2] - run[j - 1][2]) < 0.5
      ) {
        moving = false;
        break;
      }
    }
    if (!moving) continue;
    const first = run[0];
    const last = run[run.length - 1];
    if (Math.hypot(last[1] - first[1], last[2] - first[2]) < 60) continue;

    const d2x = diffs(run, 1, 2);
    const d2y = diffs(run, 2, 2);
    const flat = (a) => a.every((v) => Math.abs(v) <= LINEAR_TOL);
    if (flat(d2x) && flat(d2y)) {
      linear = true;
      continue;
    }
    const onGrid = run.every(
      (p) => Number.isInteger(p[1] * 2) && Number.isInteger(p[2] * 2),
    );
    if (
      !onGrid &&
      spread(diffs(run, 1, 3)) <= POLY_TOL &&
      spread(diffs(run, 2, 3)) <= POLY_TOL
    ) {
      polynomial = true;
    }
  }
  return { linear, polynomial };
}

function approachPath(moves, a) {
  const win = moves.filter(
    (p) => p[4] === PT_MOUSE && p[0] <= a.t && p[0] >= a.t - 1500,
  );
  if (win.length < 6) return null;
  return { ...runStats(win), ...polynomialRuns(win) };
}

function typing(keys) {
  if (keys.length < 7) return null;
  const downs = keys.map((k) => k[0]);
  const dd = [];
  for (let i = 1; i < downs.length; i++) {
    const d = downs[i] - downs[i - 1];
    if (d > 0 && d < 2000) dd.push(d);
  }
  const dwell = keys.map((k) => k[1]).filter((x) => x >= 0);
  return {
    keys: keys.length,
    intervalMedian: dd.length >= 6 ? median(dd) : null,
    intervalCv: dd.length >= 7 ? cv(dd) : null,
    intervalRegular: dd.length >= 7 ? nearMedian(dd, 0.08) : null,
    dwellCv: dwell.length >= 7 ? cv(dwell) : null,
    dwellRegular: dwell.length >= 7 ? nearMedian(dwell, 0.12) : null,
    dwellMedian: median(dwell),
  };
}

export function analyzeBehavior(trace, ctx = {}) {
  if (trace === undefined || trace === null) {
    return {
      score: null,
      verdict: "missing",
      flags: [],
      signals: {},
      digest: null,
    };
  }
  const invalid = validateTrace(trace);
  if (invalid) {
    return finish(["bh_malformed"], { malformed: invalid }, null, ctx);
  }

  const flags = [];
  const signals = {};
  const t = trace;
  const a = t.a;
  const fineClock = t.res <= FINE_CLOCK_MS;
  const [, , , , fullscreen, chromeH] = t.env;
  signals.clockRes = t.res;
  signals.moves = t.m.length;
  signals.untrustedPageEvents = t.n[0] + t.n[1];
  signals.unexplainedScrolls = t.n[7];

  if (ctx.replayed) flags.push("bh_replayed");

  const kb = typing(t.k);
  if (kb) {
    signals.typing = {
      keys: kb.keys,
      intervalMedian: round(kb.intervalMedian, 1),
      intervalCv: round(kb.intervalCv),
      intervalRegular: round(kb.intervalRegular),
      dwellCv: round(kb.dwellCv),
      dwellRegular: round(kb.dwellRegular),
      dwellMedian: round(kb.dwellMedian, 1),
    };
    if (
      fineClock &&
      kb.intervalRegular !== null &&
      kb.intervalRegular >= 0.75 &&
      (kb.dwellRegular === null || kb.dwellRegular >= 0.6)
    ) {
      flags.push("bh_uniform_typing");
    }
    if (fineClock && kb.intervalMedian !== null && kb.intervalMedian < 25) {
      flags.push("bh_superhuman_typing");
    }
  }

  if (!a) {
    signals.activation = "none";
    return finish(flags, signals, t, ctx, true);
  }

  signals.activation = ["pointer", "key", "click"][a.k];

  if (a.tr === 0) flags.push("bh_untrusted_activation");
  if (a.hid === 1) flags.push("bh_hidden_activation");

  const dwell = a.u >= 0 ? a.u - a.t : null;
  signals.pressMs = dwell === null ? null : round(dwell, 1);
  signals.sinceVisibleMs = t.vis >= 0 ? round(a.t - t.vis, 0) : null;
  signals.idleMs = t.last >= 0 ? round(a.t - t.last, 0) : null;

  if (a.k === ACT_POINTER) {
    signals.pointerType = ["mouse", "pen", "touch"][a.pt];

    if (t.vis < 0) flags.push("bh_activation_unseen");
    else if (fineClock && a.t - t.vis < 120) flags.push("bh_too_fast");

    if (
      a.pt !== 2 &&
      a.sox === 0 &&
      a.soy === 0 &&
      !fullscreen &&
      chromeH >= 40
    ) {
      flags.push("bh_screen_coords_leak");
    }

    const centered =
      a.w >= 16 && a.h >= 16 && Math.abs(a.cx) < 0.75 && Math.abs(a.cy) < 0.75;
    if (centered) flags.push("bh_center_hit");

    if (t.us >= 0 && a.t >= t.us && a.t - t.us < 2000) {
      flags.push("bh_unexplained_scroll");
    }

    if (fineClock && dwell !== null && dwell < 8) {
      flags.push("bh_instant_press");
    }

    if (a.pt === PT_MOUSE) {
      const before = t.m.filter((p) => p[4] === PT_MOUSE && p[0] <= a.t);
      const isNear = (p) => Math.hypot(p[1] - a.x, p[2] - a.y) <= 30;
      let i = before.length;
      while (i > 0 && isNear(before[i - 1])) i--;
      let warped;
      if (i === 0) {
        warped = before.length <= 2;
      } else {
        const prev = before[i - 1];
        const first = before[i] ?? null;
        const jump = first
          ? Math.hypot(first[1] - prev[1], first[2] - prev[2])
          : Math.hypot(a.x - prev[1], a.y - prev[2]);
        warped = jump > 150 && (first ? first[3] <= 1 : true);
      }
      signals.approachSamples = before.length;
      if (warped) {
        flags.push("bh_warp_click");
        if (signals.idleMs !== null && signals.idleMs >= 3000) {
          flags.push("bh_idle_then_act");
        }
      }

      const path = approachPath(t.m, a);
      if (path) {
        signals.path = {
          samples: path.samples,
          displacement: round(path.displacement, 1),
          straightness: round(path.straightness, 4),
          maxDeviation: round(path.maxDeviation, 2),
          stepCv: round(path.stepCv),
        };
        if (path.linear) flags.push("bh_linear_path");
        else if (path.polynomial) flags.push("bh_polynomial_path");
      }
    }

    if (a.pt === PT_TOUCH) {
      if (a.cw <= 2 && a.ch <= 2 && (a.pr === 1 || a.pr === 0.5)) {
        flags.push("bh_touch_geometry");
      }
    }
  } else if (a.k === ACT_KEY) {
    if (fineClock && dwell !== null && dwell < 8) flags.push("bh_instant_key");
  }

  return finish(flags, signals, t, ctx);
}

function finish(flags, signals, trace, ctx, noActivation = false) {
  let keep = 1;
  let strong = false;
  for (const f of flags) {
    keep *= 1 - (BEHAVIOR_WEIGHTS[f] ?? 0);
    if (STRONG.has(f)) strong = true;
  }
  let score = 1 - keep;
  if (!strong && !ctx.strict) score = Math.min(score, WEAK_CAP);
  score = round(score, 3);

  const threshold = ctx.threshold ?? DEFAULT_BEHAVIOR_THRESHOLD;
  let verdict;
  if (score >= threshold) verdict = "automated";
  else if (score >= SUSPICIOUS_THRESHOLD) verdict = "suspicious";
  else verdict = noActivation ? "no_interaction" : "ok";

  return {
    score,
    verdict,
    flags,
    signals,
    digest:
      trace && trace.m.length + trace.k.length >= 8 ? traceDigest(trace) : null,
  };
}
