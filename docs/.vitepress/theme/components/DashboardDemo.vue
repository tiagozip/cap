<script setup>
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  title: { type: String, default: "Cap dashboard demo" },
  theme: { type: String, default: "auto" },
  compact: { type: Boolean, default: false },
  activating: { type: String, default: "Enabling scroll..." },
});

const { isDark } = useData();
const scheme = computed(() => (props.theme === "auto" ? (isDark.value ? "dark" : "light") : props.theme));
const src = ref("");
const unlocked = ref(false);
const frame = ref(null);
const demo = ref(null);
const stage = ref(null);
const canvas = ref(null);
let stopShader;

const cue = ref(null);
const run = ref(0);
const leaving = ref(null);
const cursor = ref(null);

const hitAt = (e) => {
  const el = frame.value;
  let win;
  try {
    win = el?.contentWindow;
    if (!win?.document) return null;
  } catch {
    return null;
  }
  const rect = el.getBoundingClientRect();
  const zoom = rect.width / win.innerWidth || 1;
  const x = (e.clientX - rect.left) / zoom;
  const y = (e.clientY - rect.top) / zoom;
  const hit = win.document.elementFromPoint(x, y);
  return hit && { win, hit, x, y };
};

const lock = () => {
  unlocked.value = false;
  cue.value = null;
};

const arm = (e) => {
  if (unlocked.value) return;
  const target = hitAt(e);
  cursor.value = target ? target.win.getComputedStyle(target.hit).cursor : null;
  const box = demo.value.getBoundingClientRect();
  const at = { x: e.clientX - box.left, y: e.clientY - box.top };
  if (cue.value) {
    cue.value = at;
    return;
  }
  if (!(e.movementX || e.movementY)) return;
  run.value++;
  cue.value = at;
};

const hold = () => {
  if (unlocked.value || !cue.value) return;
  run.value++;
};

const ready = () => {
  if (!cue.value) return;
  leaving.value = { ...cue.value, run: run.value };
  cue.value = null;
  unlocked.value = true;
};

const pass = (e) => {
  if (unlocked.value) return;
  const target = hitAt(e);
  if (!target) return;
  const { win, hit, x, y } = target;
  e.preventDefault();
  const init = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: win };
  const pointer = { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true };
  hit.dispatchEvent(new win.PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
  hit.dispatchEvent(new win.MouseEvent("mousedown", { ...init, buttons: 1 }));
  hit.focus?.({ preventScroll: true });
  hit.dispatchEvent(new win.PointerEvent("pointerup", pointer));
  hit.dispatchEvent(new win.MouseEvent("mouseup", init));
  hit.dispatchEvent(new win.MouseEvent("click", init));
  cue.value = null;
  unlocked.value = true;
};

let touched = false;
let cycle = 0;
let visible = false;
let frameWin = null;
let risen = false;

const kick = () => {
  if (risen || !visible || !frameWin) return;
  risen = true;
  clearInterval(cycle);
  if (!touched && !unlocked.value) cycle = setInterval(step, 3000);
  try {
    frameWin.capRise = true;
    frameWin.dispatchEvent(new frameWin.Event("cap:rise"));
  } catch {}
};

const scrollable = (el, dx, dy, win) => {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const cs = win.getComputedStyle(node);
    const root = node === win.document.scrollingElement;
    if (Math.abs(dy) >= Math.abs(dx)) {
      if ((root || /(auto|scroll|overlay)/.test(cs.overflowY)) && node.scrollHeight > node.clientHeight + 1) {
        if (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1) return true;
      }
    } else if ((root || /(auto|scroll|overlay)/.test(cs.overflowX)) && node.scrollWidth > node.clientWidth + 1) {
      if (dx < 0 ? node.scrollLeft > 0 : node.scrollLeft + node.clientWidth < node.scrollWidth - 1) return true;
    }
  }
  return false;
};

const step = () => {
  if (touched || unlocked.value || !visible || document.hidden) return;
  const items = [...(frameWin?.document.querySelectorAll('[aria-label="Chart metric"] [data-state]') ?? [])];
  if (items.length < 2) return;
  const at = items.findIndex((el) => el.dataset.state === "on");
  items[(at + 1) % items.length].click();
};

const attach = () => {
  let win;
  try {
    win = frame.value?.contentWindow;
    if (!win?.document?.head) return;
  } catch {
    return;
  }
  frameWin = win;
  const style = win.document.createElement("style");
  style.textContent = "html{overscroll-behavior:contain}";
  win.document.head.append(style);
  win.addEventListener(
    "wheel",
    (e) => {
      if (!scrollable(e.target, e.deltaX, e.deltaY, win)) e.preventDefault();
    },
    { passive: false },
  );
  kick();
};

watch(unlocked, (on) => {
  if (!on) return;
  touched = true;
  clearInterval(cycle);
});

const FRAG = `precision mediump float;
uniform vec2 r;
uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r.y*1.4;
  float s=t*.035;
  vec2 q=vec2(fbm(uv+vec2(0.,s)),fbm(uv+vec2(5.2,1.3)-s));
  vec2 w=vec2(fbm(uv+3.2*q+vec2(1.7,9.2)+s),fbm(uv+3.2*q+vec2(8.3,2.8)-s*.7));
  float f=fbm(uv+3.5*w);
  float ridge=smoothstep(.5,.66,f)*(1.-smoothstep(.66,.86,f));
  float a=clamp(ridge*1.1+smoothstep(.45,.9,f)*.35,0.,1.);
  vec3 c=mix(vec3(.16,.32,.92),vec3(.42,.6,1.),ridge);
  gl_FragColor=vec4(c*a,a);
}`;

const startShader = (el) => {
  const gl = el.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  if (!gl) return () => {};
  const shader = (type, code) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, code);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const res = gl.getUniformLocation(prog, "r");
  const time = gl.getUniformLocation(prog, "t");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scale = Math.min(devicePixelRatio, 1) * 0.5;
  let raf = 0;
  let visible = false;
  const start = performance.now() - 40_000;
  const draw = (now) => {
    raf = 0;
    const w = Math.max(1, Math.round(el.clientWidth * scale));
    const hgt = Math.max(1, Math.round(el.clientHeight * scale));
    if (el.width !== w || el.height !== hgt) {
      el.width = w;
      el.height = hgt;
      gl.viewport(0, 0, w, hgt);
    }
    gl.uniform2f(res, w, hgt);
    gl.uniform1f(time, still ? 40 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible && !still) raf = requestAnimationFrame(draw);
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(draw);
  });
  io.observe(el);
  const ro = new ResizeObserver(() => {
    if (!raf) raf = requestAnimationFrame(draw);
  });
  ro.observe(el);
  return () => {
    io.disconnect();
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
};

watch(scheme, (next) => {
  if (src.value) src.value = `/demo/index.html?theme=${next}${risen ? "" : "&hold"}#/keys/c4f1a9e27b/activity`;
});

const away = (e) => {
  if (unlocked.value && !demo.value?.contains(e.target)) lock();
};

let io;
let seen;
onMounted(() => {
  seen = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      kick();
    },
    { threshold: 0.35 },
  );
  seen.observe(stage.value);
  document.addEventListener("pointermove", away, { passive: true });
  stopShader = startShader(canvas.value);
  io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      src.value = `/demo/index.html?theme=${scheme.value}&hold#/keys/c4f1a9e27b/activity`;
      io.disconnect();
    },
    { rootMargin: "600px" },
  );
  io.observe(stage.value);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointermove", away);
  io?.disconnect();
  seen?.disconnect();
  clearInterval(cycle);
  stopShader?.();
});
</script>

<template>
  <div ref="stage" class="dash-stage" :class="{ compact }">
    <canvas ref="canvas" class="dash-shader" aria-hidden="true"></canvas>
    <div
      ref="demo"
      class="dash-demo"
      :class="{ unlocked }"
      :style="{ cursor: unlocked ? null : cursor }"
      @pointermove="arm"
      @pointerleave="!unlocked && lock()"
      @wheel.passive="hold"
      @click="pass"
    >
      <iframe
        ref="frame"
        :src="src || undefined"
        :title="title"
        :style="{ colorScheme: scheme, background: scheme === 'dark' ? '#09090b' : '#ffffff' }"
        loading="lazy"
        @load="attach"
      ></iframe>
      <div
        v-if="cue"
        :key="run"
        class="dash-cue"
        aria-hidden="true"
        :style="{ translate: `${cue.x + 14}px ${cue.y + 14}px` }"
      >
        <svg viewBox="0 0 20 20" width="18" height="18">
          <circle class="dash-cue-track" cx="10" cy="10" r="8" />
          <circle class="dash-cue-fill" cx="10" cy="10" r="8" @animationend="ready" />
        </svg>
        {{ activating }}
      </div>
      <div
        v-if="leaving"
        :key="`out-${leaving.run}`"
        class="dash-cue dash-cue-out"
        aria-hidden="true"
        :style="{ translate: `${leaving.x + 14}px ${leaving.y + 14}px` }"
        @animationend="leaving = null"
      >
        <svg viewBox="0 0 20 20" width="18" height="18">
          <circle class="dash-cue-track" cx="10" cy="10" r="8" />
          <circle class="dash-cue-fill dash-cue-full" cx="10" cy="10" r="8" />
        </svg>
        {{ activating }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash-stage {
  --pad: 10px;
  --inner: 11px;
  --z: 0.85;
  position: relative;
  isolation: isolate;
  padding: var(--pad);
  border-radius: calc(var(--inner) + var(--pad));
  overflow: hidden;
  background: var(--panel, var(--vp-c-bg-soft));
  box-shadow:
    0 2px 4px #00000033,
    0 24px 48px #00000040;
}

.dash-shader {
  position: absolute;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  opacity: 0.55;
  pointer-events: none;
}

.dash-demo {
  position: relative;
  border-radius: var(--inner);
  overscroll-behavior: contain;
}

.dash-demo::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: var(--inner);
  box-shadow: 0 0 0 1px #ffffff14;
  pointer-events: none;
}

.dash-demo.unlocked iframe {
  pointer-events: auto;
}

.dash-cue {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px 7px 9px;
  border-radius: 10px;
  background: rgb(39 39 42 / 0.92);
  color: #a1a1aa;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  backdrop-filter: blur(8px);
  animation: cue-in 160ms ease-out;
}

.dash-cue svg {
  rotate: -90deg;
}

.dash-cue circle {
  fill: none;
  stroke-width: 2.5;
}

.dash-cue-track {
  stroke: #ffffff1f;
}

.dash-cue-fill {
  stroke: #d4d4d8;
  stroke-linecap: round;
  stroke-dasharray: 50.27;
  stroke-dashoffset: 50.27;
  animation: cue-fill 900ms linear forwards;
}

.dash-cue-full {
  stroke-dashoffset: 0;
  animation: none;
}

.dash-cue-out {
  animation: cue-out 260ms ease-in forwards;
}

@keyframes cue-in {
  from {
    opacity: 0;
    scale: 0.96;
  }
}

@keyframes cue-fill {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes cue-out {
  to {
    opacity: 0;
    transform: translateY(-10px);
    filter: blur(4px);
  }
}

.dash-demo iframe {
  pointer-events: none;
  display: block;
  width: 100%;
  height: 700px;
  border: 0;
  border-radius: calc(var(--inner) / var(--z));
  zoom: var(--z);
}

.compact {
  --pad: 8px;
  --z: 0.6;
}

.compact .dash-demo iframe {
  height: 820px;
}

@media (max-width: 640px) {
  .dash-stage {
    --pad: 6px;
  }

  .dash-demo iframe {
    height: 560px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dash-cue,
  .dash-cue-out {
    animation-name: none;
  }

  .dash-cue-out {
    display: none;
  }
}
</style>
