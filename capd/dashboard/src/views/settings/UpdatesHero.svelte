<script>
import { onMount } from "svelte";

let { class: className = "", mood = "ok", children } = $props();
let canvas = $state(null);

const TONES = {
  ok: [0.36, 0.56, 1, 0.55],
  update: [0.55, 0.45, 1, 1],
  alert: [1, 0.34, 0.32, 1],
  off: [0.46, 0.48, 0.54, 0],
};

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision highp float;
uniform vec2 r;
uniform float t;
uniform vec3 tone;
uniform float e;
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  float cs=max(floor(r.y/46.),6.);
  vec2 g=gl_FragCoord.xy/cs;
  vec2 id=floor(g);
  vec2 f=fract(g)-.5;
  vec2 c=((id+.5)*cs-.5*r)/r.y;
  vec2 src=vec2(0.,.12);
  float d=length(c-src);
  float base=smoothstep(.42,.85,fbm(c*2.2+vec2(t*.035,-t*.025)))*.42+.015;
  float ring=0.;
  for(int j=0;j<2;j++){
    float R=fract(t*.1+float(j)*.5)*1.4;
    float x=(d-R)*15.;
    ring+=exp(-x*x)*(1.-R/1.4)*smoothstep(0.,.1,R);
  }
  float core=smoothstep(.075,.03,d)*mix(.35,1.,e);
  float hot=clamp(ring*e+core,0.,1.);
  float v=clamp(base*(1.-.5*hot)+hot,0.,1.);
  v*=mix(.12,1.,smoothstep(-.5,-.05,c.y));
  float rad=.44*sqrt(v);
  float m=smoothstep(rad+.6/cs*1.5,rad-.6/cs*1.5,length(f));
  m*=mix(.3,1.,smoothstep(0.,.3,(id.y+.5)*cs/r.y));
  vec3 ink=mix(vec3(.52,.55,.62)*.55,tone,hot);
  vec3 col=vec3(.02,.025,.045)+ink*m;
  gl_FragColor=vec4(col,1.);
}`;

let target = TONES.ok;
let kick = () => {};

$effect(() => {
  target = TONES[mood] ?? TONES.ok;
  kick();
});

onMount(() => {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, "r");
  const uT = gl.getUniformLocation(prog, "t");
  const uTone = gl.getUniformLocation(prog, "tone");
  const uE = gl.getUniformLocation(prog, "e");

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let start = performance.now() - 8000;
  const tone = [...target];
  let frame = 0;
  let hiddenAt = 0;

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const hgt = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== hgt) {
      canvas.width = w;
      canvas.height = hgt;
      gl.viewport(0, 0, w, hgt);
    }
  };

  let idleAt = 0;
  const settled = () =>
    target[3] === 0 && tone.every((v, i) => Math.abs(v - target[i]) < 0.001);

  const draw = (now) => {
    size();
    for (let i = 0; i < 4; i++)
      tone[i] = still ? target[i] : tone[i] + (target[i] - tone[i]) * 0.05;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, ((idleAt || now) - start) / 1000);
    gl.uniform3f(uTone, tone[0], tone[1], tone[2]);
    gl.uniform1f(uE, tone[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (still) return;
    if (settled()) {
      idleAt ||= now;
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  kick = () => {
    if (still) {
      requestAnimationFrame(draw);
      return;
    }
    if (frame) return;
    if (idleAt) start += performance.now() - idleAt;
    idleAt = 0;
    frame = requestAnimationFrame(draw);
  };

  const ro = new ResizeObserver(
    () => (still || (idleAt && !frame)) && requestAnimationFrame(draw),
  );
  ro.observe(canvas);

  const visibility = () => {
    if (still || (idleAt && !frame)) return;
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(frame);
      return;
    }
    if (hiddenAt) start += performance.now() - hiddenAt;
    hiddenAt = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  };
  document.addEventListener("visibilitychange", visibility);

  return () => {
    document.removeEventListener("visibilitychange", visibility);
    kick = () => {};
    cancelAnimationFrame(frame);
    ro.disconnect();
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };
});
</script>

<div class="relative overflow-hidden rounded-2xl bg-[#05070d] {className}">
  <canvas bind:this={canvas} class="absolute inset-0 size-full" aria-hidden="true"></canvas>
  {#if children}
    <div class="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5">
      {@render children()}
    </div>
  {/if}
</div>
