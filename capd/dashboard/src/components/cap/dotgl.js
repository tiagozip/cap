const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const BASE = ["res", "dpr", "size", "corner", "tint", "ink"];

export const DOTS = `precision highp float;
uniform vec2 res;
uniform float dpr;
uniform vec2 size;
uniform float corner;
uniform vec3 tint;
uniform vec3 ink;

const float GAP=6.;
const float DOT=1.35;
const float INSET=4.;
const float ROWS=10.;

float box(vec2 p, vec2 b, float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float seg(vec2 p, vec2 a, vec2 b, out float t){vec2 pa=p-a,ba=b-a;t=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*t);}

vec2 lattice(vec2 p, vec2 c, float bd){
  float rd=INSET+max(floor((bd-INSET)/GAP+.5),0.)*GAP;
  vec2 h=c-vec2(1.)-rd;
  float r=max(corner-rd,0.);
  vec2 d=p-c;
  vec2 q=abs(d);
  float ex=h.x-r;
  float ey=h.y-r;
  float arc=1.5707963*r;
  float L=ex+arc+ey;
  vec2 v=q-vec2(ex,ey);
  float s;
  if(v.x<=0.&&(v.y>0.||h.y-q.y<h.x-q.x)) s=q.x;
  else if(v.y<=0.) s=ex+arc+ey-q.y;
  else s=ex+r*atan(v.x,v.y);
  float st=L/max(floor(L/GAP+.5),1.);
  float sq=floor(s/st+.5)*st;
  vec2 o;
  if(sq<=ex) o=vec2(sq,h.y);
  else if(sq<=ex+arc){float t=(sq-ex)/max(r,.001);o=vec2(ex,ey)+r*vec2(sin(t),cos(t));}
  else o=vec2(h.x,ey-(sq-ex-arc));
  return c+vec2(d.x<0.?-o.x:o.x,d.y<0.?-o.y:o.y);
}

vec2 pixel(){return vec2(gl_FragCoord.x,res.y-gl_FragCoord.y)/dpr;}

bool cellOf(vec2 p, vec2 anchor, vec2 cell, out vec2 g, out float bd){
  vec2 c=size*.5;
  float band=INSET+(ROWS-.5)*GAP;
  float pb=-box(p-c,c-vec2(1.),corner);
  g=pb<band?lattice(p,c,pb):anchor+floor((p-anchor)/cell+.5)*cell;
  bd=-box(g-c,c-vec2(1.),corner);
  return !(pb>=band&&bd<band);
}

vec4 paint(vec2 p, vec2 g, float I, float hot, float grow){
  I=min(I,1.);
  if(I<.004) return vec4(0.);
  float rr=DOT*(.7+.55*I)*grow;
  float m=clamp((rr-length(p-g))*dpr+.5,0.,1.);
  vec3 col=mix(tint,ink,clamp(hot,0.,1.));
  float a=I*m;
  return vec4(col*a,a);
}
`;

export const fitCell = (x) => (x - 4) / Math.max(1, Math.round((x - 4) / 6));

const rgb = (color) => {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

export const dotCanvas = (canvas, frag, names) => {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return null;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
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
  const u = Object.fromEntries(
    [...BASE, ...names].map((n) => [n, gl.getUniformLocation(prog, n)]),
  );
  const style = getComputedStyle(canvas);
  gl.uniform3fv(u.tint, rgb(style.color));
  gl.uniform3fv(
    u.ink,
    rgb(style.getPropertyValue("--splash-ink").trim() || style.color),
  );
  const host = canvas.parentElement;
  return {
    gl,
    u,
    host,
    fit: () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = host.offsetWidth;
      const H = host.offsetHeight;
      const cw = Math.round(W * dpr);
      const ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }
      gl.uniform2f(u.res, cw, ch);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform2f(u.size, W, H);
      gl.uniform1f(
        u.corner,
        parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0,
      );
      return [W, H];
    },
    at: (selector) => {
      const hb = host.getBoundingClientRect();
      const m = host.querySelector(selector)?.getBoundingClientRect();
      return m
        ? [m.left - hb.left + m.width / 2, m.top - hb.top + m.height / 2]
        : null;
    },
    render: () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => gl.getExtension("WEBGL_lose_context")?.loseContext(),
  };
};
