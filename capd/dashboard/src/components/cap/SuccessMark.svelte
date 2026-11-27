<script>
let { height = 176, delay = 0, origin, class: className = "" } = $props();

let canvas = $state();

const GAP = 6;
const DOT = 1.35;
const CHECK = [
  [-0.5, 0.02],
  [-0.14, 0.36],
  [0.52, -0.3],
];

const ease = (x) => 1 - (1 - x) ** 4;
const spring = (x) =>
  x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x) * (1 - x * 0.2);
const clamp = (x) => Math.min(1, Math.max(0, x));

$effect(() => {
  const ctx = canvas.getContext("2d");
  const W = canvas.clientWidth;
  const H = height;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.scale(dpr, dpr);

  const style = getComputedStyle(canvas);
  const tone = style.color;
  const ink = style.getPropertyValue("--mark-ink").trim();
  const dim = style.getPropertyValue("--mark-dim").trim();

  const cx = W / 2;
  const cy = H / 2;
  const R = 46;
  const reach = Math.hypot(W / 2, H / 2);
  const half = 4.6;
  const pts = CHECK.map(([x, y]) => [cx + x * R, cy + y * R]);
  const segs = [
    [pts[0], pts[1]],
    [pts[1], pts[2]],
  ];
  const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lens[0] + lens[1];

  const along = (x, y) => {
    let best = Infinity;
    let at = 0;
    let base = 0;
    segs.forEach(([a, b], i) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = clamp(
        ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy),
      );
      const d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
      if (d < best) {
        best = d;
        at = (base + t * lens[i]) / total;
      }
      base += lens[i];
    });
    return [best, at];
  };

  const field = [];
  const disc = [];
  const check = [];
  const cols = Math.max(1, Math.round((cx - 4) / GAP));
  const gx = (cx - 4) / cols;
  const x0 = cx - cols * gx;
  const y0 = cy - Math.ceil(cy / GAP) * GAP;
  for (let y = y0; y <= H; y += GAP) {
    for (let i = 0; i <= cols * 2; i++) {
      const x = x0 + i * gx;
      const r = Math.hypot(x - cx, y - cy);
      if (r <= R) {
        const [d, at] = along(x, y);
        if (d <= half) check.push({ x, y, at });
        else disc.push({ x, y, r: r / R, edge: R - r < GAP });
        continue;
      }
      const ex = Math.abs(x - cx) / (W / 2);
      const ey = Math.abs(y - cy) / (H / 2);
      const fade = clamp(1 - Math.hypot(ex * 1.04, ey * 1.1) ** 1.4);
      if (fade > 0.02) field.push({ x, y, r, fade });
    }
  }

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fadeIn = Math.max(320, delay * 0.9);
  const END = 1400 + delay;
  let frame = 0;
  const start = origin ?? performance.now();

  const dot = (x, y, s, alpha, color) => {
    if (s <= 0 || alpha <= 0.005) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, DOT * s, 0, Math.PI * 2);
    ctx.fill();
  };

  const draw = (ms) => {
    ctx.clearRect(0, 0, W, H);
    const m = ms - delay;
    for (const p of field) {
      const shown = ease(
        clamp((ms - (p.r / reach) * fadeIn * 0.4) / (fadeIn * 0.6)),
      );
      dot(p.x, p.y, 0.7 + shown * 0.3, p.fade * 0.22 * shown, dim);
    }
    if (m < 0) {
      for (const p of [...disc, ...check]) {
        const shown = ease(
          clamp(
            (ms - (Math.hypot(p.x - cx, p.y - cy) / reach) * fadeIn * 0.4) /
              (fadeIn * 0.6),
          ),
        );
        dot(p.x, p.y, 0.7 + shown * 0.3, 0.22 * shown, dim);
      }
      return;
    }
    const hit = Math.exp(-m / 150);
    const push = 1 + 0.09 * hit * Math.sin(m / 42);
    for (const p of disc) {
      dot(
        cx + (p.x - cx) * push,
        cy + (p.y - cy) * push,
        1 + 0.5 * hit * Math.cos(m / 55),
        (p.edge ? 0.62 : 0.4) + hit * 0.35,
        tone,
      );
    }
    for (const p of check) {
      const t = clamp((m - 90 - p.at * 300) / 170);
      const head = Math.exp(-(((m - 90) / 300 - p.at) ** 2) / 0.006);
      const x = cx + (p.x - cx) * push;
      const y = cy + (p.y - cy) * push;
      if (t < 1) dot(x, y, 1 + 0.5 * hit, (0.4 + hit * 0.35) * (1 - t), tone);
      dot(x, y, spring(t) * (1.05 + head * 0.45), Math.min(1, t * 2.5), ink);
    }
    ctx.globalAlpha = 1;
  };

  if (still) {
    draw(END);
    return;
  }
  const tick = (now) => {
    const ms = now - start;
    draw(ms);
    frame = ms < END ? requestAnimationFrame(tick) : 0;
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
});
</script>

<canvas bind:this={canvas} class="mark block w-full text-success {className}" style:height="{height}px" aria-hidden="true"></canvas>

<style>
  .mark {
    --mark-ink: var(--foreground);
    --mark-dim: var(--muted-foreground);
  }
</style>
