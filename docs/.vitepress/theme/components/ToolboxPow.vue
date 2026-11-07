<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const hex = "0123456789abcdef";
const size = 7;
const at = (n) => 14 + n * 12;

const make = (start) => {
  let x = start >>> 0 || 1;
  const rnd = (n) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
  const seed = Array.from({ length: 8 }, () => rnd(16));
  const reg = () => `r${rnd(8)}`;
  const lines = Array.from({ length: 8 }, (_, i) => {
    if (i === 7) return ["br", "start, 1/2"];
    const k = rnd(10);
    if (k < 3) return [["mulor", "mulxor", "muladd"][k], `${reg()}, [${reg()}], ${[1, 9, 33][rnd(3)]}`];
    if (k < 7) return [["add", "sub", "xor", "or"][k - 3], `${reg()}, ${reg()}`];
    return [k === 9 ? "shl" : "ror", `${reg()}, ${1 + rnd(63)}`];
  });

  const walk = () => {
    const pts = [[0, 1 + rnd(size - 2)]];
    const used = new Set([pts[0].join()]);
    for (let s = 0; s < 8; s++) {
      const [cx, cy] = pts.at(-1);
      const horiz = s % 2 === 0;
      const options = [];
      for (let d = -size + 1; d < size; d++) {
        if (Math.abs(d) < 2) continue;
        const nx = horiz ? cx + d : cx;
        const ny = horiz ? cy : cy + d;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const cells = Array.from({ length: Math.abs(d) }, (_, k) => {
          const step = Math.sign(d) * (k + 1);
          return horiz ? `${cx + step},${cy}` : `${cx},${cy + step}`;
        });
        if (cells.some((c) => used.has(c))) continue;
        options.push([nx, ny, cells]);
      }
      if (!options.length) return null;
      const [nx, ny, cells] = options[rnd(options.length)];
      for (const c of cells) used.add(c);
      pts.push([nx, ny]);
    }
    return pts;
  };

  const fits = (pts) => {
    if (!pts) return false;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const [ex, ey] = pts.at(-1);
    if (Math.max(...xs) - Math.min(...xs) < 5 || Math.max(...ys) - Math.min(...ys) < 4 || ex < 4) return false;
    return pts.slice(0, -1).every(([px, py], i) => {
      const [qx, qy] = pts[i + 1];
      return !((py === ey && Math.max(px, qx) > ex) || (qy === ey && qx > ex) || (px === qx && px > ex && Math.min(py, qy) <= ey && Math.max(py, qy) >= ey));
    });
  };
  let pts = walk();
  while (!fits(pts)) pts = walk();
  const segs = pts.slice(1).map(([bx, by], i) => `M${at(pts[i][0])} ${at(pts[i][1])}H${at(bx)}V${at(by)}`);
  const [sx, sy] = pts[0];
  const [ex, ey] = pts.at(-1);
  return {
    seed,
    lines,
    segs,
    nodes: pts.slice(1, -1).map(([a, b]) => [at(a), at(b)]),
    lead: `M0 ${at(sy)}H${at(sx)}`,
    tail: `M${at(ex)} ${at(ey)}H${at(size - 1) + 14}`,
    start: [at(sx), at(sy)],
    end: [at(ex), at(ey)],
  };
};

const dots = Array.from({ length: size * size }, (_, n) => [at(n % size), at(Math.floor(n / size))]);

const gen = ref(0);
const prog = ref(make(0x2545f491));
const spin = ref(0);
const art = ref(null);
let lastRoll = 0;
let timer = 0;
let io;

const roll = () => {
  const now = performance.now();
  if (now - lastRoll < 650) return;
  lastRoll = now;
  prog.value = make(crypto.getRandomValues(new Uint32Array(1))[0]);
  gen.value += 1;
  spin.value += 1;
};

const stopHover = () => {
  clearInterval(timer);
  timer = 0;
};

const enter = (e) => {
  if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  roll();
  stopHover();
  timer = setInterval(roll, 2400);
};

onMounted(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (art.value.getBoundingClientRect().top < innerHeight * 0.6) return;
  io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      gen.value += 1;
    },
    { threshold: 0.55 },
  );
  io.observe(art.value);
});

onBeforeUnmount(() => {
  stopHover();
  io?.disconnect();
});
</script>

<template>
  <article class="cell tb-c-pow">
    <div ref="art" class="tb-art pw-art" @pointerenter="enter" @pointerleave="stopHover">
      <div class="tb-shelf pw-shelf" aria-hidden="true"></div>
      <div class="tb-plate pw-plate" aria-hidden="true"></div>
      <div class="pw-chip" aria-hidden="true">
        <div class="pw-die">
          <svg viewBox="0 0 100 100" class="pw-svg">
            <circle v-for="([cx, cy], n) in dots" :key="n" class="pw-dot" :cx="cx" :cy="cy" r="1.1" />
            <Transition name="pw-run" :duration="{ enter: 1500, leave: 220 }">
              <g :key="gen" class="pw-prog">
                <path class="pw-lead" :d="prog.lead" pathLength="1" />
                <path v-for="(d, j) in prog.segs" :key="j" class="pw-seg" :d="d" pathLength="1" :style="{ '--j': j }" />
                <path class="pw-tail" :d="prog.tail" pathLength="1" />
                <circle class="pw-pad" :cx="prog.start[0]" :cy="prog.start[1]" r="2.6" />
                <circle v-for="([cx, cy], j) in prog.nodes" :key="`n${j}`" class="pw-node" :cx="cx" :cy="cy" r="1.9" :style="{ '--j': j }" />
                <circle class="pw-pad pw-out" :cx="prog.end[0]" :cy="prog.end[1]" r="2.6" />
              </g>
            </Transition>
          </svg>
        </div>
      </div>
      <div class="pw-slip">
        <button type="button" class="pw-head" :aria-label="`hashwx_make(0x${prog.seed.map((d) => hex[d]).join('')})`" @click="roll">
          <code aria-hidden="true"
            >hashwx_make(0x<span class="pw-seed"
              ><span v-for="(d, i) in prog.seed" :key="i" class="pw-digit" :style="{ '--v': d, '--i': i }"
                ><span class="pw-strip"><span v-for="g in hex" :key="g">{{ g }}</span></span></span
              ></span
            >)</code
          >
          <svg class="pw-reroll" :style="{ '--turn': spin }" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89" />
            <path d="M12.5 1.75v2.75h-2.75" />
          </svg>
        </button>
        <div class="pw-lines" aria-hidden="true">
          <div v-for="(l, j) in prog.lines" :key="j" class="pw-line" :style="{ '--j': j }">
            <Transition name="pw-ln">
              <code :key="gen" :class="{ br: l[0] === 'br' }"
                ><i>{{ j + 1 }}</i><b>{{ l[0].padEnd(7, " ") }}</b>{{ l[1] }}</code
              >
            </Transition>
          </div>
        </div>
      </div>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellPowTitle }}</h3>
      <p>{{ t.cellPowBody }}</p>
      <a class="text-link small" :href="`${lp}/guide/hashwx.html`">HashWX</a>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-pow .pw-art {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  min-height: 0;
  padding: 30px 28px 8px;
}
#homev2 .cell.tb-c-pow .pw-art::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 420px;
  background: radial-gradient(50% 55% at 50% 0%, #cdd6f414, transparent 75%);
  pointer-events: none;
}
#homev2 .cell.tb-c-pow .pw-shelf {
  top: 142px;
}
#homev2 .cell.tb-c-pow .pw-plate {
  --c: 22px;
  top: 8px;
  left: calc(50% - 158px);
  width: 316px;
  height: 135px;
}
#homev2 .cell.tb-c-pow .pw-chip {
  position: relative;
  width: min(100%, 224px);
  aspect-ratio: 1;
  flex: none;
  padding: 14px;
  border-radius: 18px;
  background:
    linear-gradient(to bottom right, #ffffff12, transparent 60%),
    #2a2a3e;
  box-shadow:
    0 0 0 4px #11111b80,
    inset 0 1px 0 #ffffff14,
    inset 0 0 0 1px #ffffff0a,
    0 1px 2px #00000033,
    0 8px 20px -8px #00000066;
}
#homev2 .cell.tb-c-pow .pw-chip::before,
#homev2 .cell.tb-c-pow .pw-chip::after {
  content: "";
  position: absolute;
  inset: -12px 30px;
  background:
    repeating-linear-gradient(to right, #45475a 0 4px, transparent 4px 13px) top / 100% 6px no-repeat,
    repeating-linear-gradient(to right, #45475a 0 4px, transparent 4px 13px) bottom / 100% 6px no-repeat;
  pointer-events: none;
}
#homev2 .cell.tb-c-pow .pw-chip::after {
  inset: 30px -12px;
  background:
    repeating-linear-gradient(to bottom, #45475a 0 4px, transparent 4px 13px) left / 6px 100% no-repeat,
    repeating-linear-gradient(to bottom, #45475a 0 4px, transparent 4px 13px) right / 6px 100% no-repeat;
}
#homev2 .cell.tb-c-pow .pw-die {
  height: 100%;
  border-radius: 6px;
  background: #151521;
  box-shadow:
    inset 0 1px 2px #00000080,
    0 1px 0 #ffffff0d;
}
#homev2 .cell.tb-c-pow .pw-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
#homev2 .cell.tb-c-pow .pw-dot {
  fill: #ffffff26;
}
#homev2 .cell.tb-c-pow .pw-seg,
#homev2 .cell.tb-c-pow .pw-lead,
#homev2 .cell.tb-c-pow .pw-tail {
  stroke: var(--accent);
  stroke-width: 2.2;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
}
#homev2 .cell.tb-c-pow .pw-lead,
#homev2 .cell.tb-c-pow .pw-tail {
  stroke: #89b4fa80;
}
#homev2 .cell.tb-c-pow .pw-node {
  fill: #151521;
  stroke: var(--accent);
  stroke-width: 1.4;
}
#homev2 .cell.tb-c-pow .pw-pad {
  fill: var(--text);
}
#homev2 .cell.tb-c-pow .pw-slip {
  position: relative;
  width: 100%;
  max-width: 340px;
  border-radius: 12px;
  background:
    linear-gradient(to bottom right, #ffffff08, transparent 55%),
    #ffffff04;
  box-shadow: inset 0 0 0 1px var(--tb-line);
}
#homev2 .cell.tb-c-pow .pw-head {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 40px;
  padding: 0 14px 0 16px;
  border-radius: 12px 12px 0 0;
  box-shadow: inset 0 -1px 0 var(--tb-line);
  cursor: pointer;
}
#homev2 .cell.tb-c-pow .pw-head:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
#homev2 .cell.tb-c-pow .pw-head code {
  color: var(--text);
  line-height: 18px;
}
#homev2 .cell.tb-c-pow .pw-seed {
  display: inline-flex;
  vertical-align: top;
  color: var(--accent);
}
#homev2 .cell.tb-c-pow .pw-digit {
  display: inline-block;
  height: 18px;
  overflow: hidden;
}
#homev2 .cell.tb-c-pow .pw-strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--v) * -18px));
}
#homev2 .cell.tb-c-pow .pw-reroll {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform: rotate(calc(var(--turn) * 360deg));
}
#homev2 .cell.tb-c-pow .pw-lines {
  display: grid;
  padding: 10px 0 12px;
}
#homev2 .cell.tb-c-pow .pw-line {
  display: grid;
}
#homev2 .cell.tb-c-pow .pw-line code {
  grid-area: 1 / 1;
  display: block;
  padding-inline: 16px;
  line-height: 1.7;
  color: var(--text-secondary);
}
#homev2 .cell.tb-c-pow .pw-line i {
  display: inline-block;
  width: 2.5ch;
  font-style: normal;
  color: var(--text-faint);
}
#homev2 .cell.tb-c-pow .pw-line b {
  font-weight: 400;
  color: var(--text);
}
#homev2 .cell.tb-c-pow .pw-line code.br b {
  color: var(--accent);
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .cell.tb-c-pow .pw-run-enter-active .pw-seg {
    transition: stroke-dashoffset 150ms linear calc(var(--j) * 150ms + 150ms);
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-active .pw-lead {
    transition: stroke-dashoffset 150ms linear;
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-active .pw-tail {
    transition: stroke-dashoffset 150ms linear 1350ms;
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-active .pw-node {
    transition: opacity 120ms ease-out calc(var(--j) * 150ms + 300ms);
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-active .pw-out {
    transition: opacity 160ms ease-out 1300ms;
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-from :is(.pw-seg, .pw-lead, .pw-tail) {
    stroke-dashoffset: 1;
  }
  #homev2 .cell.tb-c-pow .pw-run-enter-from :is(.pw-node, .pw-out) {
    opacity: 0;
  }
  #homev2 .cell.tb-c-pow .pw-run-leave-active {
    transition:
      opacity 200ms ease-in,
      filter 200ms ease-in;
  }
  #homev2 .cell.tb-c-pow .pw-run-leave-to {
    opacity: 0;
    filter: blur(2px);
  }
  #homev2 .cell.tb-c-pow .pw-strip {
    transition: transform 900ms var(--tb-move) calc(var(--i) * 40ms);
  }
  #homev2 .cell.tb-c-pow .pw-reroll {
    transition: transform 700ms var(--tb-ease);
  }
  #homev2 .cell.tb-c-pow .pw-ln-enter-active {
    transition:
      opacity 240ms ease-out calc(var(--j) * 150ms + 150ms),
      filter 240ms ease-out calc(var(--j) * 150ms + 150ms),
      transform 320ms var(--tb-ease) calc(var(--j) * 150ms + 150ms);
  }
  #homev2 .cell.tb-c-pow .pw-ln-leave-active {
    transition:
      opacity 160ms ease-in,
      filter 160ms ease-in,
      transform 160ms ease-in;
  }
  #homev2 .cell.tb-c-pow .pw-ln-enter-from {
    opacity: 0;
    filter: blur(4px);
    transform: translateX(-6px);
  }
  #homev2 .cell.tb-c-pow .pw-ln-leave-to {
    opacity: 0;
    filter: blur(4px);
  }
}
@media (hover: hover) {
  #homev2 .cell.tb-c-pow .pw-head:hover .pw-reroll {
    stroke: var(--text);
  }
}
</style>
