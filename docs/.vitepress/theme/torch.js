const NOISE = "abcdefghijklmnopqrstuvwxyz0123456789.,:;_-=+*/\\|<>()[]{}#%&?!~^";
const FONT_FAMILY = '"Departure Mono", ui-monospace, monospace';

const mulberry = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createTorch({ field, canvas, lamp, avoid, lines, reduced }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const base = document.createElement("canvas");
  const bctx = base.getContext("2d");
  const wash = document.createElement("canvas");
  const wctx = wash.getContext("2d");
  const zone = document.createElement("canvas");
  const zctx = zone.getContext("2d");
  const lit = document.createElement("canvas");
  const lctx = lit.getContext("2d");
  const glow = document.createElement("canvas");
  const gctx = glow.getContext("2d");
  const canFilter = "filter" in gctx;
  const styles = getComputedStyle(field);
  const color = (name) => styles.getPropertyValue(name).trim();
  const palette = {
    bg: color("--torch-bg"),
    dim: color("--torch-dim"),
    lit: color("--torch-lit"),
    wash: color("--torch-wash"),
    kinds: [null, color("--torch-blocked"), color("--torch-passed"), color("--torch-flagged"), color("--torch-you")],
  };
  const rgbOf = (value) => {
    zctx.fillStyle = "#000";
    zctx.fillStyle = value;
    const hex = zctx.fillStyle;
    if (!hex.startsWith("#")) return "137,180,250";
    return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(",");
  };
  const tint = rgbOf(palette.wash);
  const core = "255,250,240";
  let motes = [];

  const fontPx = 13;
  const cellH = 20;
  let cellW = 8;
  let cols = 0;
  let rows = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let noise = [];
  let hidden = [];
  let kind = new Uint8Array(0);
  let pinned = new Uint8Array(0);
  let threshold = new Float32Array(0);
  let edge = new Float32Array(0);
  let mask = new Float32Array(0);
  let shade = new Float32Array(0);
  let pins = [];

  const state = {
    aim: 0,
    target: 0,
    half: 0.34,
    reach: 760,
    focus: false,
    ox: 0,
    oy: 0,
    frame: 0,
    aimed: false,
    busy: false,
    churn: 0,
    lastInput: Number.NEGATIVE_INFINITY,
    phase: 0,
    wasIdle: false,
    near: false,
    idleSince: 0,
  };
  const NEAR = 96;
  const IDLE_AFTER = 2600;
  let idleTimer = 0;
  const touched = () => {
    state.lastInput = performance.now();
    clearTimeout(idleTimer);
    if (!reduced) idleTimer = setTimeout(() => kick(), IDLE_AFTER + 50);
  };
  const idling = (now) => !reduced && !state.focus && !state.near && now - state.lastInput > IDLE_AFTER;

  const goal = () => ({
    half: state.focus ? 0.14 : width < 640 ? 0.4 : 0.28,
    reach: state.focus ? Math.max(width, height) * 1.1 : Math.min(900, Math.max(width, height) * 0.72),
  });

  const measureOrigin = () => {
    const f = field.getBoundingClientRect();
    const l = lamp().getBoundingClientRect();
    state.ox = l.left - f.left + (f.width < 640 ? l.width / 2 : 28);
    state.oy = l.top - f.top + l.height / 2;
  };

  const rects = () => {
    const f = field.getBoundingClientRect();
    return avoid()
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
      .map((r) => ({ l: r.left - f.left, r: r.right - f.left, t: r.top - f.top, b: r.bottom - f.top }));
  };

  const blocked = () =>
    rects().map((r) => ({
      c0: Math.floor(r.l / cellW) - 3,
      c1: Math.ceil(r.r / cellW) + 2,
      r0: Math.floor(r.t / cellH) - 1,
      r1: Math.ceil(r.b / cellH) + 1,
    }));

  const hits = (boxes, text, row, col) =>
    boxes.some((b) => row >= b.r0 && row <= b.r1 && col + text.length >= b.c0 && col <= b.c1);

  const place = (text, k, row, col, rand) => {
    const lt = 0.1 + rand() * 0.22;
    for (let i = 0; i < text.length; i++) {
      const at = row * cols + col + i;
      hidden[at] = text[i];
      kind[at] = k;
      threshold[at] = lt + rand() * 0.05;
    }
  };

  const fits = (text, row, col, boxes) => {
    if (row < 1 || row >= rows - 1 || col < 1 || col + text.length >= cols) return false;
    if (hits(boxes, text, row, col)) return false;
    if (mask[row * cols + col] < 0.6 || mask[row * cols + col + text.length - 1] < 0.6) return false;
    for (let i = -3; i < text.length + 3; i++) {
      const c = col + i;
      if (c < 0 || c >= cols) continue;
      for (let dr = -1; dr <= 1; dr++) {
        const r = row + dr;
        if (r < 0 || r >= rows) continue;
        if (kind[r * cols + c] || pinned[r * cols + c]) return false;
      }
    }
    return true;
  };

  const drawBase = () => {
    const zones = rects();
    const narrow = width < 640;
    for (let r = 0; r < rows; r++) {
      const y = r * cellH + cellH / 2;
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW / 2;
        let m = 1;
        let s = 1;
        for (const z of zones) {
          const d = Math.hypot(Math.max(z.l - x, 0, x - z.r), Math.max(z.t - y, 0, y - z.b));
          m = Math.min(m, smooth(8, 64, d));
          s *= smooth(4, narrow ? 90 : 190, d);
        }
        mask[r * cols + c] = m;
        shade[r * cols + c] = Math.min(m, s);
      }
    }
    zone.width = cols;
    zone.height = rows;
    const img = zctx.createImageData(cols, rows);
    for (let i = 0; i < mask.length; i++) img.data[i * 4 + 3] = Math.round(shade[i] * 255);
    zctx.putImageData(img, 0, 0);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, width, height);
    bctx.font = `${fontPx}px ${FONT_FAMILY}`;
    bctx.textBaseline = "middle";
    bctx.fillStyle = palette.dim;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = edge[r * cols + c] * mask[r * cols + c];
        if (a <= 0.04) continue;
        bctx.globalAlpha = a;
        bctx.fillText(noise[r * cols + c], c * cellW, r * cellH + cellH / 2);
      }
    }
    bctx.globalAlpha = 1;
  };

  const mark = (pin) => {
    for (let i = -1; i <= pin.text.length; i++) {
      const c = pin.col + i;
      if (c >= 0 && c < cols) pinned[pin.row * cols + c] = 1;
    }
  };

  const placePins = (all) => {
    pinned.fill(0);
    if (all) for (const pin of pins) pin.row = undefined;
    for (const pin of pins) if (pin.row !== undefined) mark(pin);
    const boxes = blocked();
    const box = boxes[boxes.length - 1] ?? { c0: 0, c1: 0, r0: 0, r1: 0 };
    const lampRow = Math.round((state.oy - cellH / 2) / cellH);
    for (const pin of pins) {
      if (pin.row !== undefined) continue;
      const fitsRight = cols - box.c1 - 5 >= pin.text.length + 2;
      const fitsLeft = box.c0 - 5 >= pin.text.length + 2;
      const right = fitsRight || fitsLeft;
      const col = fitsRight
        ? Math.min(cols - pin.text.length - 2, box.c1 + 5)
        : fitsLeft
          ? Math.max(2, box.c0 - 5 - pin.text.length)
          : Math.max(1, Math.round((cols - pin.text.length) / 2));
      const start = right ? lampRow : Math.max(box.r1 + 2, rows - 9);
      let row = -1;
      for (let step = 0; step < rows * 2 && row < 0; step++) {
        const r = start + (step % 2 ? -Math.ceil(step / 2) : step / 2);
        if (r < 1 || r >= rows - 1) continue;
        if (!right && r < box.r1 + 1) continue;
        if (hits(boxes, pin.text, r, col)) continue;
        let free = true;
        for (let i = -3; i < pin.text.length + 3 && free; i++) {
          const c = col + i;
          if (c < 0 || c >= cols) continue;
          for (let dr = -1; dr <= 1 && free; dr++) {
            const rr = r + dr;
            if (rr < 0 || rr >= rows) continue;
            if (pinned[rr * cols + c]) free = false;
          }
          if (kind[r * cols + c]) free = false;
        }
        if (free) row = r;
      }
      for (let r = 1; r < rows - 1 && row < 0; r++) {
        if (hits(boxes, pin.text, r, col)) continue;
        let free = true;
        for (let i = -1; i <= pin.text.length && free; i++) {
          const c = col + i;
          if (c < 0 || c >= cols) continue;
          if (pinned[r * cols + c] || (r > 0 && pinned[(r - 1) * cols + c]) || pinned[(r + 1) * cols + c]) free = false;
        }
        if (free) row = r;
      }
      if (row < 0) row = Math.min(rows - 2, start);
      pin.row = row;
      pin.col = col;
      mark(pin);
    }
  };

  const build = () => {
    const rect = field.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    glow.width = Math.ceil(width / 4);
    glow.height = Math.ceil(height / 4);
    const mrand = mulberry(911 + cols);
    motes = Array.from({ length: Math.round((width * height) / 9000) }, () => ({
      x: mrand() * width,
      y: mrand() * height,
      vx: (mrand() - 0.5) * 7,
      vy: -(2 + mrand() * 6),
      s: 0.5 + mrand() * 1.1,
      p: mrand() * Math.PI * 2,
    }));
    for (const c of [canvas, base, wash, lit]) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    bctx.font = `${fontPx}px ${FONT_FAMILY}`;
    cellW = bctx.measureText("m").width || 8;
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    const n = cols * rows;
    const rand = mulberry(7331 + cols * 31 + rows);
    noise = new Array(n);
    hidden = new Array(n);
    kind = new Uint8Array(n);
    pinned = new Uint8Array(n);
    threshold = new Float32Array(n);
    edge = new Float32Array(n);
    mask = new Float32Array(n);
    shade = new Float32Array(n);

    const gx = Math.ceil(cols / 16) + 2;
    const gy = Math.ceil(rows / 5) + 2;
    const grid = Float32Array.from({ length: gx * gy }, () => rand());
    measureOrigin();

    for (let i = 0; i < n; i++) {
      noise[i] = NOISE[Math.floor(rand() * NOISE.length)];
      threshold[i] = 0.08 + rand() * 0.3;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const u = c / 16;
      const v = r / 5;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = smooth(0, 1, u - x0);
      const fy = smooth(0, 1, v - y0);
      const g = (a, b) => grid[b * gx + a];
      const density =
        g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy;
      const y = r * cellH + cellH / 2;
      const x = c * cellW;
      const frame = smooth(0, 70, y) * smooth(0, 70, height - y) * smooth(0, 40, x) * smooth(0, 40, width - x);
      const far = 1 - 0.55 * smooth(0, Math.max(width, height), Math.hypot(x - state.ox, y - state.oy));
      edge[i] = rand() < 0.06 + density * density * 0.85 ? frame * far * (0.18 + density * 0.55) : 0;
    }

    drawBase();
    const boxes = blocked();
    const box = boxes[boxes.length - 1] ?? { c0: 0, c1: 0, r0: 0, r1: 0 };
    placePins(true);
    const pool = lines.filter((l) => l.text.length < cols - 4);
    const wanted = Math.max(8, Math.round(n / 170));
    let placed = 0;
    const firstAim = (cols - box.c1) * cellW < 300 ? Math.PI * 0.42 : -0.1;
    const firstReach = goal().reach;
    for (const at of [0.4, 0.58, 0.76]) {
      const line = pool[placed % pool.length];
      if (!line) break;
      const x = state.ox + Math.cos(firstAim) * firstReach * at;
      const y = state.oy + Math.sin(firstAim) * firstReach * at + (placed % 2 ? cellH * 2 : -cellH);
      const row = Math.round((y - cellH / 2) / cellH);
      const col = Math.round(x / cellW - line.text.length / 2);
      if (!fits(line.text, row, col, boxes)) continue;
      place(line.text, line.kind, row, col, rand);
      placed++;
    }
    const used = new Set();
    for (let attempt = 0; attempt < wanted * 60 && placed < wanted && used.size < pool.length; attempt++) {
      const line = pool[Math.floor(rand() * pool.length)];
      if (used.has(line)) continue;
      const row = 1 + Math.floor(rand() * (rows - 2));
      const col = 1 + Math.floor(rand() * Math.max(1, cols - line.text.length - 2));
      if (!fits(line.text, row, col, boxes)) continue;
      place(line.text, line.kind, row, col, rand);
      used.add(line);
      placed++;
    }

    drawBase();
    if (!state.aimed) {
      state.target = firstAim;
      state.aim = state.target;
    }
    Object.assign(state, goal());
    render(performance.now());
  };

  const glyphAt = (i) => {
    if (!state.busy) return noise[i];
    const h = Math.imul(i ^ (state.churn * 40503), 2654435761) >>> 0;
    return h % 5 < 2 ? NOISE[(h >>> 8) % NOISE.length] : noise[i];
  };

  const lightAt = (x, y, i) => {
    const { ox, oy, aim, half, reach } = state;
    const dx = x - ox;
    const dy = y - oy;
    const d = Math.hypot(dx, dy);
    if (d > reach || d < 4) return 0;
    const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - aim));
    if (off > half * 1.35) return 0;
    const angular = Math.exp(-((off / (half * 0.6)) ** 2));
    const radial = (1 - smooth(reach * 0.38, reach, d)) * smooth(0, 70, d);
    const pd = Math.hypot(x - (ox + Math.cos(aim) * reach * 0.5), y - (oy + Math.sin(aim) * reach * 0.5));
    const pool = Math.exp(-((pd / (reach * 0.2)) ** 2)) * 0.5;
    return shade[i] * Math.min(1, angular * radial * (0.8 + pool));
  };

  const cone = (spread, peak, rgb) => {
    const { ox, oy, aim, half } = state;
    const wide = half * 1.4;
    const g = wctx.createConicGradient(aim - wide, ox, oy);
    const span = (wide * 2) / (Math.PI * 2);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const a = (u - 0.5) * 2 * wide;
      g.addColorStop(span * u, `rgba(${rgb},${(Math.exp(-((a / (half * spread)) ** 2)) * peak).toFixed(3)})`);
    }
    g.addColorStop(Math.min(1, span + 0.001), "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    return g;
  };

  let lastFrame = 0;
  const render = (now) => {
    const dt = Math.min(0.05, lastFrame ? (now - lastFrame) / 1000 : 0);
    lastFrame = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0, width, height);
    ctx.font = `${fontPx}px ${FONT_FAMILY}`;
    ctx.textBaseline = "middle";
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, width, height);
    lctx.font = `${fontPx}px ${FONT_FAMILY}`;
    lctx.textBaseline = "middle";

    const { ox, oy, aim, reach } = state;
    const c0 = Math.max(0, Math.floor((ox - reach) / cellW));
    const c1 = Math.min(cols - 1, Math.ceil((ox + reach) / cellW));
    const r0 = Math.max(0, Math.floor((oy - reach) / cellH));
    const r1 = Math.min(rows - 1, Math.ceil((oy + reach) / cellH));

    for (let r = r0; r <= r1; r++) {
      const y = r * cellH + cellH / 2;
      for (let c = c0; c <= c1; c++) {
        const i = r * cols + c;
        if (pinned[i]) continue;
        const light = lightAt(c * cellW + cellW / 2, y, i);
        if (light < 0.03) continue;
        const k = kind[i];
        const x0 = Math.floor(c * cellW);
        if (k && light > threshold[i] - 0.06) {
          ctx.fillStyle = palette.bg;
          ctx.fillRect(x0, r * cellH, Math.ceil(cellW) + 1, cellH);
          if (hidden[i] === " ") continue;
          lctx.fillStyle = palette.kinds[k];
          lctx.globalAlpha = Math.min(1, 0.25 + smooth(threshold[i] - 0.06, threshold[i] + 0.1, light) * 0.75);
          lctx.fillText(hidden[i], c * cellW, y);
          continue;
        }
        const glyph = glyphAt(i);
        if (glyph !== noise[i]) {
          ctx.fillStyle = palette.bg;
          ctx.fillRect(x0, r * cellH, Math.ceil(cellW) + 1, cellH);
        }
        lctx.fillStyle = light > 0.6 ? `rgb(${core})` : palette.lit;
        lctx.globalAlpha = Math.min(0.9, (0.14 + edge[i] * 1.2) * light * (width < 640 ? 2 : 1.15));
        lctx.fillText(glyph, c * cellW, y);
      }
    }
    lctx.globalAlpha = 1;

    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.globalCompositeOperation = "source-over";
    wctx.globalAlpha = 1;
    wctx.clearRect(0, 0, width, height);
    wctx.fillStyle = cone(0.7, 1, tint);
    wctx.fillRect(0, 0, width, height);
    wctx.globalCompositeOperation = "lighter";
    wctx.fillStyle = cone(0.22, 0.55, core);
    wctx.fillRect(0, 0, width, height);
    const px = ox + Math.cos(aim) * reach * 0.5;
    const py = oy + Math.sin(aim) * reach * 0.5;
    const pool = wctx.createRadialGradient(px, py, 0, px, py, reach * 0.3);
    pool.addColorStop(0, `rgba(${tint},0.7)`);
    pool.addColorStop(0.5, `rgba(${tint},0.22)`);
    pool.addColorStop(1, `rgba(${tint},0)`);
    wctx.fillStyle = pool;
    wctx.fillRect(0, 0, width, height);
    wctx.globalCompositeOperation = "destination-in";
    const fall = wctx.createRadialGradient(ox, oy, 0, ox, oy, reach);
    fall.addColorStop(0, "#0000");
    fall.addColorStop(0.1, "#000f");
    fall.addColorStop(0.5, "#0009");
    fall.addColorStop(1, "#0000");
    wctx.fillStyle = fall;
    wctx.fillRect(0, 0, width, height);
    wctx.imageSmoothingEnabled = true;
    wctx.drawImage(zone, 0, 0, cols * cellW, rows * cellH);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = width < 640 ? 0.3 : 0.18;
    ctx.drawImage(wash, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(lit, 0, 0, width, height);

    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, glow.width, glow.height);
    if (canFilter) gctx.filter = "blur(1.5px)";
    gctx.drawImage(lit, 0, 0, glow.width, glow.height);
    if (canFilter) gctx.filter = "none";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.6;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glow, 0, 0, width, height);

    ctx.fillStyle = `rgb(${core})`;
    for (const m of motes) {
      if (!reduced) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -4) m.y = height + 4;
        if (m.x < -4) m.x = width + 4;
        if (m.x > width + 4) m.x = -4;
      }
      const c = Math.min(cols - 1, Math.max(0, Math.floor(m.x / cellW)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor(m.y / cellH)));
      const light = lightAt(m.x, m.y, r * cols + c);
      if (light < 0.04) continue;
      ctx.globalAlpha = light * 0.5 * (0.55 + 0.45 * Math.sin(now / 650 + m.p));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    let decoding = false;
    for (const pin of pins) {
      const { row, col, text, k, born } = pin;
      const y = row * cellH + cellH / 2;
      const age = now - born;
      const shown = reduced ? 1 : smooth(0, 160, age);
      ctx.fillStyle = palette.bg;
      ctx.globalAlpha = 1;
      ctx.fillRect((col - 1) * cellW, row * cellH, (text.length + 2) * cellW, cellH);
      ctx.fillStyle = palette.kinds[k];
      ctx.globalAlpha = 0.12 * shown;
      ctx.fillRect((col - 1) * cellW, row * cellH, (text.length + 2) * cellW, cellH);
      ctx.globalAlpha = 0.9 * shown;
      ctx.fillRect((col - 1) * cellW, row * cellH, 2, cellH);
      ctx.fillStyle = palette.kinds[k];
      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") continue;
        const at = reduced ? 0 : 60 + i * 14;
        if (age < at) {
          decoding = true;
          if (age < at - 220) continue;
          ctx.globalAlpha = 0.45;
          ctx.fillText(NOISE[(i * 7 + Math.floor(age / 40) * 13) % NOISE.length], (col + i) * cellW, y);
          continue;
        }
        ctx.globalAlpha = 1;
        ctx.fillText(text[i], (col + i) * cellW, y);
      }
    }
    ctx.globalAlpha = 1;
    return decoding;
  };

  let visible = true;
  const tick = (now) => {
    state.frame = 0;
    const g = goal();
    const idle = idling(now);
    const amp = width < 640 ? 0.55 : 1.45;
    const rest = width < 640 ? Math.PI / 2 : -Math.PI / 2;
    if (idle && !state.wasIdle) {
      const k = wrapAngle(state.aim - rest) / amp;
      state.phase = Math.asin(Math.max(-1, Math.min(1, k)));
      state.idleSince = now;
    }
    state.wasIdle = idle;
    if (idle) {
      const t = (now - state.idleSince) / 1000;
      state.target = rest + Math.sin(t * 0.32 + state.phase) * amp + Math.sin(t * 0.11) * 0.18;
    }
    const ease = reduced ? 1 : idle ? 0.045 : 0.16;
    const da = wrapAngle(state.target - state.aim);
    state.aim += da * ease;
    state.half += (g.half - state.half) * ease;
    state.reach += (g.reach - state.reach) * ease;
    if (state.busy) state.churn = Math.floor(now / 55);
    const decoding = render(now);
    const settled = Math.abs(da) < 0.002 && Math.abs(g.half - state.half) < 0.002 && Math.abs(g.reach - state.reach) < 1;
    if (settled && !decoding && !idle && reduced) return;
    if (!visible) return;
    state.frame = requestAnimationFrame(tick);
  };

  const kick = () => {
    if (!state.frame) state.frame = requestAnimationFrame(tick);
  };

  const aimAt = (x, y) => {
    state.aimed = true;
    state.target = Math.atan2(y - state.oy, x - state.ox);
    kick();
  };

  const aimClient = (clientX, clientY) => {
    const f = field.getBoundingClientRect();
    measureOrigin();
    aimAt(clientX - f.left, clientY - f.top);
  };

  const release = () => {
    if (!state.near) return;
    state.near = false;
    state.lastInput = Number.NEGATIVE_INFINITY;
    clearTimeout(idleTimer);
    kick();
  };

  const onMove = (e) => {
    if (e.pointerType === "touch") {
      if (!field.contains(e.target) || e.target.closest?.("[data-torch-ignore]")) return;
      touched();
      aimClient(e.clientX, e.clientY);
      return;
    }
    const f = field.getBoundingClientRect();
    const inside =
      e.clientX > f.left - NEAR && e.clientX < f.right + NEAR && e.clientY > f.top - NEAR && e.clientY < f.bottom + NEAR;
    if (!inside) {
      release();
      return;
    }
    state.near = true;
    state.lastInput = performance.now();
    if (e.target.closest?.("[data-torch-ignore]")) {
      kick();
      return;
    }
    aimClient(e.clientX, e.clientY);
  };
  const onOut = (e) => {
    if (!e.relatedTarget) release();
  };
  const onDown = (e) => {
    if (e.target.closest?.("[data-torch-ignore], a, button, input, select, textarea, label, [role='button']")) return;
    touched();
    aimClient(e.clientX, e.clientY);
    if (e.pointerType === "touch") return;
    state.focus = true;
    kick();
  };
  const onUp = () => {
    if (!state.focus) return;
    state.focus = false;
    kick();
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerout", onOut, { passive: true });
  field.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });

  let lastSize = "";
  const ro = new ResizeObserver(() => {
    const f = field.getBoundingClientRect();
    const size = `${Math.round(f.width)}x${Math.round(f.height)}`;
    if (size === lastSize) {
      measureOrigin();
      drawBase();
      render(performance.now());
      return;
    }
    lastSize = size;
    build();
  });
  ro.observe(field);
  const settle = () => {
    if (!lastSize) return;
    measureOrigin();
    drawBase();
    render(performance.now());
  };
  field.addEventListener("animationend", settle);
  for (const el of avoid()) if (el) ro.observe(el);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) kick();
  });
  io.observe(field);

  return {
    reveal(text, k) {
      touched();
      measureOrigin();
      pins = pins.filter((p) => p.k !== k);
      const pin = { text, k, born: performance.now() };
      pins.push(pin);
      placePins();
      aimAt((pin.col + text.length / 2) * cellW, pin.row * cellH + cellH / 2);
    },
    busy(on) {
      state.busy = on;
      if (on) kick();
    },
    forget() {
      state.busy = false;
      if (!pins.length) return;
      pins = [];
      pinned.fill(0);
      render(performance.now());
    },
    destroy() {
      clearTimeout(idleTimer);
      cancelAnimationFrame(state.frame);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      field.removeEventListener("pointerdown", onDown);
      field.removeEventListener("animationend", settle);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    },
  };
}
