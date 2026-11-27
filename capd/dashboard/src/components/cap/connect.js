import { DOTS, dotCanvas, fitCell } from "./dotgl.js";

const FRAG = `${DOTS}
uniform vec2 a;
uniform vec2 b;
uniform vec2 m;
uniform vec2 src;
uniform vec2 tile;
uniform vec2 cell;
uniform float gap;
uniform float ms;
uniform float flash;
uniform float braid;
uniform vec3 wf;
uniform vec3 wa;
uniform float head;
uniform float meet;
uniform float glow;
uniform float charge;

const float PI=3.14159265;

float stream(vec2 g, float x0, float x1, float dir){
  float span=abs(x1-x0);
  float u=(g.x-x0)*dir;
  if(u<0.||u>span) return 0.;
  float k=floor((g.y-m.y)/GAP+.5);
  if(abs(k)>1.) return 0.;
  float reach=span*head;
  if(u>reach) return 0.;
  float lane=k==0.?1.:smoothstep(.2,.85,sin(u*.16-ms*.02+k*2.1))*braid;
  float packet=.45+.55*pow(.5+.5*sin(u*.45-ms*.03),3.);
  float front=exp(-(reach-u)/9.)*step(head,.999);
  float land=exp(-(span-u)/7.)*flash*1.4;
  return lane*mix(.45,packet*1.15,braid)+front*.8+land;
}

void main(){
  vec2 p=pixel();
  vec2 g;
  float bd;
  if(!cellOf(p,m,cell,g,bd)){gl_FragColor=vec4(0.);return;}
  float ta=box(g-a,tile,16.);
  float tb=box(g-b,tile,16.);
  if(ta<3.||tb<3.){gl_FragColor=vec4(0.);return;}
  if(min(ta,tb)<8.5){
    vec2 o=ta<tb?a:b;
    float phi=acos(clamp(dot(normalize(g-o),normalize(m-o)),-1.,1.))/PI;
    float sweep=1.-charge;
    float on=step(sweep,phi)*step(.001,charge);
    float tip=exp(-pow((phi-sweep)/.08,2.))*step(.001,charge)*step(charge,.999);
    float k=on*(.55+tip*.45)*braid+tip*.3;
    gl_FragColor=paint(p,g,k,tip+on*.25*braid,1.+tip*.3);
    return;
  }
  vec2 c=size*.5;
  float I=0.;
  float hot=0.;

  if(abs(g.x-m.x)>gap){
    float s=stream(g,a.x+tile.x+4.,m.x-gap,1.)+stream(g,b.x-tile.x-4.,m.x+gap,-1.);
    I+=s;
    hot+=s*.35*braid+s*flash*.5;
  }

  float d=length(g-src);
  for(int i=0;i<3;i++){
    float r=exp(-pow((d-wf[i])/11.,2.));
    I+=r*wa[i];
    hot+=r*wa[i]*.5;
  }

  if(glow>0.){
    float ang=min(abs(atan((g.x-c.x)/size.x,-(g.y-c.y)/size.y)),PI);
    float behind=meet*PI-ang;
    float e=max(bd-INSET,0.);
    float trail=behind>=-.001?exp(-max(behind,0.)*1.4):0.;
    float tip=exp(-pow(behind/.07,2.))*step(meet,.999)*step(.03,meet);
    float bloom=flash*exp(-pow((PI-ang)/.45,2.))*step(.999,meet);
    float breathe=.32*smoothstep(-.001,.5,behind)*(.7+.3*sin(ms*.004+ang*3.));
    float lit=trail+breathe+bloom;
    float w=3.5+tip*4.+bloom*5.+trail*4.;
    float body=(exp(-e/w)+exp(-e/(w*1.8))*.3)*step(e,13.);
    I+=body*lit*glow;
    hot+=body*(tip+bloom)*glow*1.2;
  }

  gl_FragColor=paint(p,g,I,min(hot,.85),1.);
}`;

const clamp = (x) => Math.min(1, Math.max(0, x));
const inOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

const SPEED = 900;
const STEP = 130;
const LAP = 900;
const GAP_X = 17;

export const playConnect = (
  canvas,
  {
    origin,
    press,
    from = ".from-start",
    to = ".from-end",
    mid = ".consent-link",
    fadeAt = 3300,
    end = 4000,
    onready,
    onmark,
  } = {},
) => {
  const FADE_AT = fadeAt;
  const END = end;
  const dc = dotCanvas(canvas, FRAG, [
    "a",
    "b",
    "m",
    "src",
    "tile",
    "cell",
    "gap",
    "ms",
    "flash",
    "braid",
    "wf",
    "wa",
    "head",
    "meet",
    "glow",
    "charge",
  ]);
  if (!dc) return null;
  const { gl, u } = dc;
  gl.uniform1f(u.gap, GAP_X);

  let W = 0;
  let H = 0;
  let A = [0, 0];
  let B = [0, 0];
  let M = [0, 0];
  const measure = () => {
    [W, H] = dc.fit();
    A = dc.at(from) ?? [W / 2 - 60, 60];
    B = dc.at(to) ?? [W / 2 + 60, 60];
    M = dc.at(mid) ?? [W / 2, A[1]];
    const t = dc.host.querySelector(from)?.getBoundingClientRect();
    gl.uniform2f(u.a, A[0], A[1]);
    gl.uniform2f(u.b, B[0], B[1]);
    gl.uniform2f(u.m, M[0], M[1]);
    gl.uniform2f(u.tile, (t?.width ?? 56) / 2, (t?.height ?? 56) / 2);
    gl.uniform2f(u.cell, fitCell(M[0]), 6);
  };
  measure();
  const S = press ?? [W / 2, H - 40];
  gl.uniform2f(u.src, S[0], S[1]);

  const CHARGE = Math.max(
    0,
    ((Math.hypot(S[0] - A[0], S[1] - A[1]) - 40) / SPEED) * 1000,
  );
  const LAUNCH = CHARGE + 200;
  const STREAM = 380;
  const LAND = LAUNCH + STREAM;
  const COMET = LAND + 220;
  onmark?.({ x: M[0], y: M[1], delay: LAND - 40 });
  onready?.(CHARGE);

  const ro = new ResizeObserver(measure);
  ro.observe(dc.host);

  let frame = 0;
  const start = origin ?? performance.now();
  const draw = (now) => {
    const ms = now - start;
    if (ms < LAND + 200) measure();
    const far = Math.hypot(W, H) + Math.abs(S[1] - H);
    const fronts = [0, 1, 2].map((i) =>
      ms < i * STEP ? 0 : 18 + ((ms - i * STEP) / 1000) * SPEED,
    );
    const lap = clamp((ms - COMET) / LAP);
    gl.uniform1f(u.ms, ms);
    gl.uniform1f(u.charge, inOut(clamp((ms - CHARGE) / 280)));
    gl.uniform1f(u.head, inOut(clamp((ms - LAUNCH) / STREAM)));
    gl.uniform1f(u.braid, 1 - clamp((ms - LAND) / 500));
    gl.uniform1f(
      u.flash,
      (ms > LAND ? Math.exp(-(ms - LAND) / 200) : 0) +
        (lap >= 1 ? Math.exp(-(ms - COMET - LAP) / 320) : 0),
    );
    gl.uniform3fv(u.wf, fronts);
    gl.uniform3fv(
      u.wa,
      fronts.map((f, i) =>
        f > 0 && f < far ? (0.62 - i * 0.16) * (1 - (f / far) * 0.7) : 0,
      ),
    );
    gl.uniform1f(u.meet, inOut(lap));
    gl.uniform1f(
      u.glow,
      ms < COMET ? 0 : 1 - clamp((ms - FADE_AT) / (END - FADE_AT)),
    );
    dc.render();
    frame = ms < END ? requestAnimationFrame(draw) : 0;
  };
  frame = requestAnimationFrame(draw);
  return () => {
    ro.disconnect();
    cancelAnimationFrame(frame);
    dc.dispose();
  };
};
