import { CRT_VERT, CRT_FRAG, TEXT_VERT, TEXT_FRAG } from "./shaders.js";

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
  });
  if (!gl) return null;
  gl.disable(gl.DEPTH_TEST);

  const scratch = document.createElement("canvas");
  if (!scratch.getContext("2d")) return null;

  let ok = true;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("vortex shader compile failed:", gl.getShaderInfoLog(s));
      ok = false;
    }
    return s;
  };
  const link = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("vortex program link failed:", gl.getProgramInfoLog(p));
      ok = false;
    }
    return p;
  };

  const crtProg = link(
    compile(gl.VERTEX_SHADER, CRT_VERT),
    compile(gl.FRAGMENT_SHADER, CRT_FRAG),
  );
  const textProg = link(
    compile(gl.VERTEX_SHADER, TEXT_VERT),
    compile(gl.FRAGMENT_SHADER, TEXT_FRAG),
  );
  if (!ok) return null;

  const C = {
    aPos: gl.getAttribLocation(crtProg, "aPos"),
    aUv: gl.getAttribLocation(crtProg, "aUv"),
    uTex: gl.getUniformLocation(crtProg, "uTex"),
    uTime: gl.getUniformLocation(crtProg, "uTime"),
    uRes: gl.getUniformLocation(crtProg, "uRes"),
    uScanline: gl.getUniformLocation(crtProg, "uScanline"),
    uAberration: gl.getUniformLocation(crtProg, "uAberration"),
    uCurvature: gl.getUniformLocation(crtProg, "uCurvature"),
    uFadeTop: gl.getUniformLocation(crtProg, "uFadeTop"),
    uFadeEnd: gl.getUniformLocation(crtProg, "uFadeEnd"),
    uTailStart: gl.getUniformLocation(crtProg, "uTailStart"),
    uTailEnd: gl.getUniformLocation(crtProg, "uTailEnd"),
    uClip: gl.getUniformLocation(crtProg, "uClip"),
    uOpacity: gl.getUniformLocation(crtProg, "uOpacity"),
  };
  const T = {
    aCorner: gl.getAttribLocation(textProg, "aCorner"),
    aBounds: gl.getAttribLocation(textProg, "aBounds"),
    aGlyphUv: gl.getAttribLocation(textProg, "aGlyphUv"),
    aColor: gl.getAttribLocation(textProg, "aColor"),
    uTarget: gl.getUniformLocation(textProg, "uTarget"),
    uAtlas: gl.getUniformLocation(textProg, "uAtlas"),
  };

  const posBuf = gl.createBuffer();
  const uvBuf = gl.createBuffer();
  const cornerBuf = gl.createBuffer();
  const boundsBuf = gl.createBuffer();
  const glyphUvBuf = gl.createBuffer();
  const colorBuf = gl.createBuffer();
  const glyphTex = gl.createTexture();
  const textTex = gl.createTexture();
  const fbo = gl.createFramebuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const configureTex = (tex) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  configureTex(glyphTex);
  configureTex(textTex);

  const allocStream = (buffer, data) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  };
  const streamAttr = (buffer, data, loc) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  };

  return {
    gl,
    glyphTex,
    scratch,
    resizeTargets(cw, ch) {
      canvas.width = cw;
      canvas.height = ch;
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        cw,
        ch,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        textTex,
        0,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    allocCells(buffers) {
      allocStream(boundsBuf, buffers.bounds);
      allocStream(glyphUvBuf, buffers.glyphUvs);
      allocStream(colorBuf, buffers.colors);
    },
    drawField(count, buffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count === 0) return;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(textProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.uniform1i(T.uAtlas, 0);
      gl.uniform2f(T.uTarget, canvas.width, canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuf);
      gl.vertexAttribPointer(T.aCorner, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(T.aCorner);
      gl.vertexAttribDivisor(T.aCorner, 0);
      streamAttr(boundsBuf, buffers.bounds.subarray(0, count * 4), T.aBounds);
      streamAttr(
        glyphUvBuf,
        buffers.glyphUvs.subarray(0, count * 4),
        T.aGlyphUv,
      );
      streamAttr(colorBuf, buffers.colors.subarray(0, count * 4), T.aColor);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.vertexAttribDivisor(T.aBounds, 0);
      gl.vertexAttribDivisor(T.aGlyphUv, 0);
      gl.vertexAttribDivisor(T.aColor, 0);
    },
    drawCrt(elapsedSec, cw, ch, u) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(crtProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(C.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.vertexAttribPointer(C.aUv, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(C.aUv);
      gl.uniform1i(C.uTex, 0);
      gl.uniform1f(C.uTime, elapsedSec);
      gl.uniform2f(C.uRes, cw, ch);
      gl.uniform1f(C.uScanline, u.scanline);
      gl.uniform1f(C.uAberration, u.aberration);
      gl.uniform1f(C.uCurvature, u.curvature);
      gl.uniform1f(C.uFadeTop, u.fadeTop);
      gl.uniform1f(C.uFadeEnd, u.fadeEnd);
      gl.uniform1f(C.uTailStart, u.tailStart);
      gl.uniform1f(C.uTailEnd, u.tailEnd);
      gl.uniform1f(C.uClip, u.clip);
      gl.uniform1f(C.uOpacity, u.opacity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(cornerBuf);
      gl.deleteBuffer(boundsBuf);
      gl.deleteBuffer(glyphUvBuf);
      gl.deleteBuffer(colorBuf);
      gl.deleteTexture(glyphTex);
      gl.deleteTexture(textTex);
      gl.deleteFramebuffer(fbo);
      gl.deleteProgram(crtProg);
      gl.deleteProgram(textProg);
    },
  };
}
