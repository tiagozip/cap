<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const LIMIT = 5;
const STEP = 6;
const MAX = LIMIT * STEP;
const dots = Array.from({ length: 8 }, (_, i) => ({
  i,
  x: i < LIMIT ? 64 + (LIMIT - 1 - i) * 22 : -64 - (i - LIMIT) * 22,
  no: i >= LIMIT,
}));

const art = ref(null);
const n = ref(dots.length);
const arrived = ref(dots.length);
const reset = ref(false);
const count = computed(() => Math.min(arrived.value, LIMIT) * STEP);
const digits = computed(() => String(count.value).padStart(2, "0").split("").map(Number));
const blocked = computed(() => arrived.value > LIMIT);

const timers = [];
let running = false;
let io = null;

const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));

const run = async () => {
  if (running) return;
  running = true;
  reset.value = true;
  n.value = 0;
  arrived.value = 0;
  await wait(60);
  reset.value = false;
  await wait(200);
  for (let i = 0; i < dots.length; i++) {
    n.value = i + 1;
    timers.push(setTimeout(() => (arrived.value = i + 1), i < LIMIT ? 560 : 520));
    await wait(i < LIMIT ? 240 : 380);
  }
  await wait(600);
  running = false;
};

const replay = () => {
  if (!matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
  run();
};

onMounted(() => {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  io = new IntersectionObserver(
    ([entry]) => {
      if (!entry || entry.intersectionRatio < 0.55) return;
      io.disconnect();
      run();
    },
    { threshold: [0, 0.55] },
  );
  io.observe(art.value);
});

onBeforeUnmount(() => {
  io?.disconnect();
  for (const id of timers) clearTimeout(id);
});
</script>

<template>
  <article class="cell tb-c-rate" @mouseenter="replay">
    <div ref="art" class="tb-art rt-art" :class="{ 'rt-reset': reset, 'is-blocked': blocked }" aria-hidden="true">
      <div class="tb-shelf rt-shelf"></div>
      <div class="tb-plate rt-plate"></div>
      <span
        v-for="d in dots"
        :key="d.i"
        class="rt-dot"
        :class="{ 'is-go': d.i < n, 'is-no': d.no }"
        :style="{ '--x': `${d.x}px` }"
      ></span>
      <div class="rt-gate">
        <span class="rt-count">
          <span class="rt-odo">
            <span v-for="(d, k) in digits" :key="k" class="rt-digit"
              ><span class="rt-strip" :style="{ '--v': d }"><span v-for="g in 10" :key="g">{{ g - 1 }}</span></span></span
            >
          </span>
          <span class="rt-max">/{{ MAX }}</span>
        </span>
      </div>
      <span class="rt-code">429 Too Many Requests</span>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellRateTitle }}</h3>
      <p>{{ t.cellRateBody }}</p>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-rate .rt-art {
  --rt-y: 108px;
  container-type: inline-size;
}
#homev2 .cell.tb-c-rate .rt-art::before {
  content: "";
  position: absolute;
  inset: -60px 10% auto;
  height: 240px;
  background: radial-gradient(ellipse 50% 60% at 50% 0%, #ffffff0b, transparent 70%);
  pointer-events: none;
}
#homev2 .cell.tb-c-rate .rt-shelf {
  top: var(--rt-y);
}
#homev2 .cell.tb-c-rate .rt-plate {
  --c: 16px;
  top: 52px;
  left: calc(50% - 80px);
  width: 160px;
  height: calc(var(--rt-y) - 51px);
}
#homev2 .cell.tb-c-rate .rt-dot {
  position: absolute;
  top: calc(var(--rt-y) - 4px);
  left: calc(50% - 4px);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9399b2;
  box-shadow: 0 0 0 3px #1a1a29;
  transform: translateX(calc(-50cqw - 16px));
  opacity: 0;
  transition:
    transform 900ms var(--tb-move),
    opacity 200ms linear,
    background-color 300ms var(--tb-ease) 0ms;
}
#homev2 .cell.tb-c-rate .rt-dot.is-go {
  transform: translateX(var(--x));
  opacity: 1;
}
#homev2 .cell.tb-c-rate .rt-dot.is-no.is-go {
  transition:
    transform 700ms var(--tb-ease),
    opacity 200ms linear,
    background-color 300ms var(--tb-ease) 500ms;
  background: var(--blocked, #f38ba8);
}
#homev2 .cell.tb-c-rate .rt-reset .rt-dot {
  transition: none;
}
#homev2 .cell.tb-c-rate .rt-gate {
  position: absolute;
  z-index: 1;
  top: calc(var(--rt-y) - 29px);
  left: calc(50% - 48px);
  display: grid;
  place-items: center;
  width: 96px;
  height: 58px;
  border-radius: 14px;
  background:
    linear-gradient(to bottom right, #ffffff10, transparent 60%),
    #26263a;
  box-shadow:
    inset 0 1px 0 #ffffff14,
    inset 0 0 0 1px #ffffff0d,
    0 0 0 4px #11111b8c,
    0 2px 4px #00000040,
    0 8px 14px -6px #0000004d;
  transition: box-shadow 400ms var(--tb-ease);
}
#homev2 .cell.tb-c-rate .is-blocked .rt-gate {
  box-shadow:
    inset 0 1px 0 #ffffff14,
    inset 0 0 0 1px #f38ba859,
    0 0 0 4px #11111b8c,
    0 2px 4px #00000040,
    0 8px 14px -6px #0000004d;
}
#homev2 .cell.tb-c-rate .rt-count {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: "Departure Mono", var(--font-code);
  color: #6c7086;
}
#homev2 .cell.tb-c-rate .rt-odo {
  display: flex;
  font-size: 24px;
  line-height: 1;
  color: var(--text);
  transition: color 300ms var(--tb-ease);
  mask: linear-gradient(transparent, #000 22%, #000 78%, transparent);
}
#homev2 .cell.tb-c-rate .rt-digit {
  display: block;
  height: 1em;
  overflow: hidden;
  padding: 0.1em 0;
  box-sizing: content-box;
}
#homev2 .cell.tb-c-rate .rt-strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--v) * -1em));
  transition: transform 520ms cubic-bezier(0.34, 1.3, 0.64, 1);
}
#homev2 .cell.tb-c-rate .rt-strip span {
  height: 1em;
}
#homev2 .cell.tb-c-rate .rt-max {
  font-size: 13px;
}
#homev2 .cell.tb-c-rate .is-blocked .rt-odo {
  color: #f38ba8;
}
#homev2 .cell.tb-c-rate .rt-reset .rt-strip {
  transition: none;
}
#homev2 .cell.tb-c-rate .rt-code {
  position: absolute;
  top: calc(var(--rt-y) + 46px);
  left: 0;
  right: 0;
  text-align: center;
  font: 11.5px/1 var(--font-code);
  color: #585b70;
  transition: color 300ms var(--tb-ease);
}
#homev2 .cell.tb-c-rate .is-blocked .rt-code {
  color: #f38ba8b3;
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .cell.tb-c-rate :is(.rt-dot, .rt-gate, .rt-odo, .rt-strip, .rt-code) {
    transition: none;
  }
}
</style>
