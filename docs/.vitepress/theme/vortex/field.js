const TWIST_RATE = 0.1;
const CORE_FLOOR = 0.1;
const FIELD_EXTENT = 1.0;
const SPEED_DIM = 0.45;
const SPACE = " ";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a * (1 - t) + b * t;
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

const cellHash = (col, row) => {
  const n = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export function makeBuffers(maxCells) {
  return {
    bounds: new Float32Array(maxCells * 4),
    glyphUvs: new Float32Array(maxCells * 4),
    colors: new Float32Array(maxCells * 4),
  };
}

export function composeField({
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
  twistMode = "vortex",
  twistRate = TWIST_RATE,
}) {
  const { sin, cos, sqrt, floor } = Math;
  const spin = elapsed * 0.001;
  const lines = source;
  let count = 0;

  for (let row = 0; row < grid.rows; row++) {
    const baseline = grid.vOffset + row * grid.inkSize;
    if (baseline - atlas.baseline > clip) break;

    const density =
      smoothstep(fadeTop, fadeEnd, baseline) *
      (1 - smoothstep(tailStart, tailEnd, baseline));
    if (density <= 0.001) continue;

    const y = (1 - (row * 2) / grid.rows) * FIELD_EXTENT;

    for (let col = 0; col < grid.cols; col++) {
      const x = ((col * 2) / grid.cols - 1) * FIELD_EXTENT;
      const dist = sqrt(x * x + y * y);
      const twist =
        twistMode === "linear"
          ? spin * twistRate
          : (spin * twistRate) / Math.max(CORE_FLOOR, dist);
      const s = sin(twist);
      const cse = cos(twist);
      const rx = x * cse + y * s;
      const ry = x * s - y * cse;

      const sampleCol = floor(((rx + 1) / 2) * grid.cols);
      const sampleRow = floor(((ry + 1) / 2) * grid.rows);
      const srcLine =
        lines[((sampleRow % lines.length) + lines.length) % lines.length] ?? "";
      const ch =
        sampleCol >= 0 && sampleCol < srcLine.length
          ? (srcLine[sampleCol] ?? SPACE)
          : SPACE;
      if (ch === SPACE) continue;
      if (cellHash(sampleCol, sampleRow) > density) continue;

      const bright = mix(SPEED_DIM, 1, clamp01(1 - dist));
      const o = count * 4;
      const uv = atlas.uvs[slotOf(ch)];
      const px = col * atlas.advance;
      buffers.bounds[o] = px - atlas.pad;
      buffers.bounds[o + 1] = baseline - atlas.baseline;
      buffers.bounds[o + 2] = px - atlas.pad + atlas.cellW;
      buffers.bounds[o + 3] = baseline - atlas.baseline + atlas.cellH;
      buffers.glyphUvs[o] = uv[0];
      buffers.glyphUvs[o + 1] = uv[1];
      buffers.glyphUvs[o + 2] = uv[2];
      buffers.glyphUvs[o + 3] = uv[3];
      buffers.colors[o] = ink[0] * bright;
      buffers.colors[o + 1] = ink[1] * bright;
      buffers.colors[o + 2] = ink[2] * bright;
      buffers.colors[o + 3] = 1;
      count++;
    }
  }
  return count;
}
