import { buildAtlas } from "./glyph-atlas.js";
import { buildSource, glyphsFor } from "./charset.js";
import { composeField, makeBuffers } from "./field.js";
import { createRenderer } from "./renderer.js";

const DEFAULTS = {
  mode: "hex",
  ink: "#89b4fa",
  cellPx: 13,
  scanlines: 0.35,
  aberration: 0.8,
  curvature: 0.15,
  opacity: 0.5,
  staticTime: 14000,
  twistMode: "vortex",
  twistRate: 0.1,
  fade: "both",
  fontFamily: '"TX 02 Data", "JetBrains Mono", ui-monospace, monospace',
};

function hexToRgb01(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = Number.parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createVortex(canvas, options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const r = createRenderer(canvas);
  if (!r) return null;

  const glyphs = glyphsFor(cfg.mode);
  const lookup = Object.create(null);
  glyphs.forEach((g, i) => {
    lookup[g] = i;
  });
  const spaceSlot = lookup[" "];
  const slotOf = (ch) => lookup[ch] ?? spaceSlot;

  const source = buildSource(cfg.mode);
  const ink = hexToRgb01(cfg.ink);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let atlas = null;
  let grid = null;
  let buffers = null;
  let lastCw = -1;
  let lastCh = -1;
  let raf = 0;
  let visible = false;
  let startTime = 0;
  let disposed = false;

  function rebuild(cw, ch, dpr) {
    atlas = buildAtlas(
      r.gl,
      r.glyphTex,
      r.scratch,
      glyphs,
      Math.max(6, Math.round(cfg.cellPx * dpr)),
      cfg.fontFamily,
    );
    const rows = Math.ceil(ch / atlas.inkSize) + 1;
    const cols = Math.max(1, Math.floor(cw / atlas.advance));
    grid = { cols, rows, inkSize: atlas.inkSize, vOffset: 0 };
    buffers = makeBuffers(rows * cols);
    r.allocCells(buffers);
    r.resizeTargets(cw, ch);
  }

  function draw(time) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);
    if (cw !== lastCw || ch !== lastCh) {
      rebuild(cw, ch, dpr);
      lastCw = cw;
      lastCh = ch;
    }
    if (!grid) return;

    if (startTime === 0) startTime = time;
    const elapsed = reduced ? cfg.staticTime : time - startTime;

    const m = cfg.measure ? cfg.measure(rect) : null;
    const h = ch;
    const rampOn = cfg.fade === "both" || cfg.fade === "top";
    const tailOn = cfg.fade === "both" || cfg.fade === "bottom";
    const fadeTop = rampOn ? (m?.fadeTop ?? 0) * dpr : -2;
    const fadeEnd = rampOn ? (m?.fadeEnd ?? rect.height * 0.4) * dpr : -1;
    const tailStart = tailOn ? (m?.tailStart ?? rect.height * 0.8) * dpr : h * 8;
    const tailEnd = tailOn ? (m?.tailEnd ?? rect.height) * dpr : h * 8 + 1;
    const clip = (m?.clip ?? rect.height) * dpr;

    const count = composeField({
      grid,
      atlas,
      buffers,
      source,
      elapsed,
      ink,
      slotOf,
      fadeTop,
      fadeEnd,
      tailStart,
      tailEnd,
      clip,
      twistMode: cfg.twistMode,
      twistRate: cfg.twistRate,
    });
    r.drawField(count, buffers);
    r.drawCrt(elapsed * 0.001, cw, ch, {
      scanline: cfg.scanlines,
      aberration: cfg.aberration,
      curvature: cfg.curvature,
      fadeTop,
      fadeEnd,
      tailStart,
      tailEnd,
      clip,
      opacity: cfg.opacity,
    });
  }

  function frame(time) {
    raf = 0;
    draw(time);
    if (visible && !disposed) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf !== 0 || disposed) return;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  let io = null;
  if (reduced) {
    requestAnimationFrame((t) => draw(t));
  } else if (typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(canvas);
  } else {
    visible = true;
    start();
  }

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => {
      lastCw = -1;
      lastCh = -1;
      if (reduced) requestAnimationFrame((t) => draw(t));
    });
    ro.observe(canvas);
  }

  return {
    config: cfg,
    destroy() {
      disposed = true;
      stop();
      io?.disconnect();
      ro?.disconnect();
      r.dispose();
    },
  };
}
