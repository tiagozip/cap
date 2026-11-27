<script>
import { DOTS, dotCanvas, fitCell } from "./dotgl.js";

let { land = 760, origin, target = ".mark", radius = 46 } = $props();

let canvas = $state();

const FRAG = `${DOTS}
uniform vec2 hit;
uniform vec2 cell;
uniform vec2 disc;
uniform float drad;
uniform vec2 stretch;
uniform float dalpha;
uniform float trail;
uniform vec3 rip;
uniform vec3 ripa;
uniform float front;
uniform float glow;
uniform float T;
uniform float radius;

void main(){
  vec2 p=pixel();
  vec2 g;
  float bd;
  if(!cellOf(p,hit,cell,g,bd)){gl_FragColor=vec4(0.);return;}
  vec2 c=size*.5;
  float I=0.;
  float hot=0.;

  if(dalpha>0.){
    vec2 q=(g-disc)/stretch;
    float r=length(q);
    float inside=step(r,drad);
    float rim=step(drad-GAP*.9,r)*inside;
    I+=inside*(.5+rim*.28)*dalpha;
    float dy=g.y-disc.y;
    float side=clamp(1.-abs(g.x-disc.x)/(drad*.85),0.,1.);
    float tail=(1.-inside)*step(0.,dy)*side*exp(-max(dy-drad*stretch.y,0.)/max(trail,.001));
    I+=tail*(.3+.25*hash(g+floor(T*30.)))*dalpha*step(1.,trail);
  }

  float d=length(g-hit);
  if(d>radius+4.){
    for(int i=0;i<3;i++){
      float w=exp(-pow((d-rip[i])/11.,2.));
      I+=w*ripa[i];
      hot+=w*ripa[i]*.6;
    }
  }

  if(glow>0.){
    float lag=front-d;
    float act=smoothstep(0.,150.,lag);
    if(act>0.){
      float ang=atan((g.y-c.y)/size.y,(g.x-c.x)/size.x);
      float n1=.5+.5*sin(ang*2.+T*1.9+sin(ang*3.-T*1.1)*1.2);
      float n2=.5+.5*sin(ang*3.-T*2.6+1.7);
      float burst=exp(-max(lag,0.)/260.);
      float w1=6.+n1*13.+burst*26.;
      float w2=14.+n2*22.;
      float e=max(bd-INSET,0.);
      float body=exp(-e/w1)+exp(-e/w2)*.45;
      float shimmer=.18+.82*pow(.5+.5*sin(ang*4.-T*3.4+n2*2.),1.6);
      float k=body*shimmer*act*glow;
      I+=k*.95;
      hot+=k*smoothstep(6.,0.,e)*.8+burst*act*exp(-e/8.)*.6;
    }
  }

  gl_FragColor=paint(p,g,I,min(hot,.75),1.);
}`;

const clamp = (x) => Math.min(1, Math.max(0, x));
const rise = (x) => 0.65 * (1 - (1 - x) ** 2) + 0.35 * x;

$effect(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dc = dotCanvas(canvas, FRAG, [
    "hit",
    "cell",
    "disc",
    "drad",
    "stretch",
    "dalpha",
    "trail",
    "rip",
    "ripa",
    "front",
    "glow",
    "T",
    "radius",
  ]);
  if (!dc) return;
  const { gl, u } = dc;
  gl.uniform1f(u.radius, radius);

  let W = 0;
  let H = 0;
  let to = [0, 0];
  const measure = () => {
    [W, H] = dc.fit();
    to = dc.at(target) ?? [W / 2, H * 0.3];
    gl.uniform2f(u.hit, to[0], to[1]);
    gl.uniform2f(u.cell, fitCell(to[0]), 6);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(dc.host);

  const RIPPLE = land + 330;
  const STEP = 170;
  const SPEED = 640;
  const HOLD = 1500;
  const FADE = 900;
  const reach = () =>
    Math.max(
      ...[
        [0, 0],
        [W, 0],
        [0, H],
        [W, H],
      ].map(([x, y]) => Math.hypot(x - to[0], y - to[1])),
    );

  const path = (ms) => {
    const k = rise(clamp(ms / land));
    const from = [W / 2, H + radius * 0.9];
    return [
      from[0] + (to[0] - from[0]) * k,
      from[1] + (to[1] - from[1]) * k,
      radius * (0.62 + 0.38 * k),
    ];
  };

  let frame = 0;
  let done = Infinity;
  const start = origin ?? performance.now();
  const draw = (now) => {
    const ms = now - start;
    if (ms < RIPPLE) measure();
    const [x, y, r] = path(ms);
    const [, py] = path(ms - 16);
    const s = ms < land ? Math.min(0.6, Math.abs(y - py) / 34) : 0;
    const fronts = [0, 1, 2].map((i) =>
      ms < RIPPLE + i * STEP
        ? 0
        : radius + ((ms - RIPPLE - i * STEP) / 1000) * SPEED,
    );
    const far = reach() + 40;
    const amps = fronts.map((f, i) =>
      f > 0 && f < far ? (0.62 - i * 0.16) * (1 - (f / far) * 0.55) : 0,
    );
    if (done === Infinity && fronts[0] > far) done = ms;
    const glow = ms < RIPPLE ? 0 : 1 - clamp((ms - done - HOLD) / FADE);

    gl.uniform2f(u.disc, x, y);
    gl.uniform1f(u.drad, r);
    gl.uniform2f(u.stretch, 1 - s * 0.2, 1 + s * 0.5);
    gl.uniform1f(u.dalpha, ms < land ? 1 : 0);
    gl.uniform1f(u.trail, s * 90);
    gl.uniform3fv(u.rip, fronts);
    gl.uniform3fv(u.ripa, amps);
    gl.uniform1f(u.front, fronts[0]);
    gl.uniform1f(u.glow, glow);
    gl.uniform1f(u.T, Math.max(0, ms - RIPPLE) / 1000);
    dc.render();
    frame = ms < done + HOLD + FADE ? requestAnimationFrame(draw) : 0;
  };
  frame = requestAnimationFrame(draw);
  return () => {
    ro.disconnect();
    cancelAnimationFrame(frame);
    dc.dispose();
  };
});
</script>

<canvas bind:this={canvas} class="splash pointer-events-none absolute inset-0 size-full rounded-[inherit] text-success" aria-hidden="true"></canvas>

<style>
  .splash {
    --splash-ink: var(--foreground);
  }
</style>
