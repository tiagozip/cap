export function buildAtlas(gl, tex, scratch, glyphs, inkSize, fontFamily) {
  const { max, ceil, sqrt, floor } = Math;
  const ctx = scratch.getContext("2d");
  const font = `${inkSize}px ${fontFamily}`;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const advance = ctx.measureText("0").width;

  let asc = 0;
  let desc = 0;
  for (const g of glyphs) {
    const m = ctx.measureText(g);
    asc = max(asc, m.actualBoundingBoxAscent || inkSize * 0.8);
    desc = max(desc, m.actualBoundingBoxDescent || inkSize * 0.25);
  }

  const pad = max(2, ceil(inkSize * 0.18));
  const cellW = max(1, ceil(advance + pad * 2));
  const cellH = max(1, ceil(asc + desc + pad * 2));
  const baseline = pad + ceil(asc);

  const cols = max(1, ceil(sqrt(glyphs.length)));
  const rows = max(1, ceil(glyphs.length / cols));
  scratch.width = cols * cellW;
  scratch.height = rows * cellH;
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";

  const uvs = new Array(glyphs.length);
  for (let i = 0; i < glyphs.length; i++) {
    const cx = (i % cols) * cellW;
    const cy = floor(i / cols) * cellH;
    ctx.fillText(glyphs[i], cx + pad, cy + baseline);
    uvs[i] = [
      cx / scratch.width,
      cy / scratch.height,
      (cx + cellW) / scratch.width,
      (cy + cellH) / scratch.height,
    ];
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);

  return { inkSize, advance, cellW, cellH, baseline, pad, uvs };
}
