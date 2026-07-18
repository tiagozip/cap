const BARREL_GAIN = 0.1;
const BARREL_PINCH = 0.085;
const BARREL_EDGE = 0.05;
const ABERRATION_UV = 0.0028;
const VIGNETTE = 0.3;
const CURVE_RAMP_SEC = 3.0;

function num(n) {
  const s = String(n);
  return s.includes(".") ? s : `${s}.0`;
}

export const TEXT_VERT = `#version 300 es
in vec2 aCorner;
in vec4 aBounds;
in vec4 aGlyphUv;
in vec4 aColor;
uniform vec2 uTarget;
out vec2 vGlyphUv;
out vec4 vColor;
void main(){
  vec2 px = mix(aBounds.xy, aBounds.zw, aCorner);
  vec2 clip = vec2((px.x / uTarget.x) * 2.0 - 1.0, 1.0 - (px.y / uTarget.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vGlyphUv = mix(aGlyphUv.xy, aGlyphUv.zw, aCorner);
  vColor = aColor;
}`;

export const TEXT_FRAG = `#version 300 es
precision mediump float;
in vec2 vGlyphUv;
in vec4 vColor;
uniform sampler2D uAtlas;
out vec4 fragColor;
void main(){
  float a = texture(uAtlas, vGlyphUv).a;
  if (a <= 0.001) discard;
  fragColor = vec4(vColor.rgb, vColor.a * a);
}`;

export const CRT_VERT = `#version 300 es
in vec4 aPos;
in vec2 aUv;
out vec2 vUv;
void main(){ gl_Position = aPos; vUv = aUv; }`;

export const CRT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform vec2 uRes;
uniform float uScanline;
uniform float uAberration;
uniform float uCurvature;
uniform float uFadeTop;
uniform float uFadeEnd;
uniform float uTailStart;
uniform float uTailEnd;
uniform float uClip;
uniform float uOpacity;
out vec4 fragColor;

float easeOutQuad(float t){ return t * (2.0 - t); }

void main(){
  float y = vUv.y * uRes.y;
  if (y > uClip) { fragColor = vec4(0.0); return; }

  float prog = min(uTime / ${num(CURVE_RAMP_SEC)}, 1.0);
  float curve = easeOutQuad(prog) * uCurvature;
  vec2 c = vUv * 2.0 - 1.0;
  c *= 1.0 + ${num(BARREL_GAIN)} * curve;
  c *= 1.0 - ${num(BARREL_PINCH)} * curve + ${num(BARREL_EDGE)} * curve * pow(abs(c.yx), vec2(2.0));
  c = c * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) { fragColor = vec4(0.0); return; }

  float d = uAberration * ${num(ABERRATION_UV)};
  vec4 sr = texture(uTex, vec2(c.x + d, c.y));
  vec4 sg = texture(uTex, c);
  vec4 sb = texture(uTex, vec2(c.x - d, c.y));
  vec3 col = vec3(sr.r, sg.g, sb.b);
  float a = max(max(sr.a, sg.a), sb.a);

  float scan = max(0.0, sin((c.y + uTime * 0.0005) * uRes.y)) * 0.5;
  float scanMul = 1.0 - scan * uScanline;

  float vig = 1.0 - clamp(length(c - 0.5) * ${num(VIGNETTE)}, 0.0, 1.0);
  float ramp = smoothstep(uFadeTop, uFadeEnd, y);
  float tail = 1.0 - smoothstep(uTailStart, uTailEnd, y);

  float k = scanMul * vig * ramp * tail * uOpacity;
  fragColor = vec4(col * k, a * k);
}`;
