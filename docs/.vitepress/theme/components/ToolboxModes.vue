<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const modes = [
  { id: "checkbox", key: "cellModesCheckbox", code: "<cap-widget>" },
  { id: "floating", key: "cellModesFloating", code: "data-cap-floating" },
  { id: "invisible", key: "cellModesInvisible", code: "new Cap().solve()" },
];

const art = ref(null);
const w1 = ref(null);
const w2 = ref(null);
const mode = ref("checkbox");
const pop = ref(false);
const press = ref(false);
const inv = ref("idle");

const timers = [];
let running = false;
let io = null;

const wait = (ms) => new Promise((r) => timers.push(setTimeout(r, ms)));
const solve = (w) =>
  new Promise((resolve) => {
    if (!w?.solve) return resolve();
    const done = () => {
      w.removeEventListener("solve", done);
      w.removeEventListener("error", done);
      resolve();
    };
    w.addEventListener("solve", done);
    w.addEventListener("error", done);
    w.solve();
  });

const tap = async () => {
  press.value = true;
  await wait(150);
  press.value = false;
};

const run = async () => {
  if (running) return;
  running = true;
  mode.value = "checkbox";
  pop.value = false;
  inv.value = "idle";
  w1.value?.reset?.();
  w2.value?.reset?.();
  await wait(350);
  await solve(w1.value);
  await wait(1100);

  mode.value = "floating";
  await wait(650);
  await tap();
  pop.value = true;
  await wait(300);
  await solve(w2.value);
  await wait(1100);

  pop.value = false;
  mode.value = "invisible";
  await wait(650);
  await tap();
  inv.value = "spin";
  await wait(1000);
  inv.value = "done";
  await wait(1300);

  inv.value = "idle";
  mode.value = "checkbox";
  w2.value?.reset?.();
  running = false;
};

const replay = () => {
  if (!matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
  run();
};

onMounted(() => {
  if (!("IntersectionObserver" in window)) return;
  const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
  io = new IntersectionObserver(
    ([entry]) => {
      if (!entry || entry.intersectionRatio < 0.55) return;
      io.disconnect();
      if (quiet) return solve(w1.value);
      run();
    },
    { threshold: [0, 0.55] },
  );
  timers.push(setTimeout(() => art.value && io?.observe(art.value), 120));
});

onBeforeUnmount(() => {
  io?.disconnect();
  for (const id of timers) clearTimeout(id);
});
</script>

<template>
  <article class="cell tb-c-modes" @mouseenter="replay">
    <div ref="art" class="tb-art mo-art" :data-mode="mode" aria-hidden="true">
      <div class="tb-shelf mo-shelf"></div>
      <div class="tb-plate mo-plate"></div>

      <ul class="mo-list mo-names">
        <li v-for="m in modes" :key="m.id" :class="{ 'is-on': mode === m.id }">
          <span class="mo-dot"></span>{{ t[m.key] }}
        </li>
      </ul>
      <ul class="mo-list mo-codes">
        <li v-for="m in modes" :key="m.id" :class="{ 'is-on': mode === m.id }">{{ m.code }}</li>
      </ul>

      <div class="mo-panel">
        <span class="mo-field">you@site.com</span>
        <div class="mo-slot">
          <div class="mo-slot-in">
            <cap-widget ref="w1" class="mo-cap" data-cap-api-endpoint="/toolbox/" inert></cap-widget>
          </div>
        </div>
        <span class="mo-btn" :class="{ 'is-press': press }" :data-inv="inv">
          <span class="mo-state">
            <span class="mo-spin"></span>
            <svg class="mo-tick" viewBox="0 0 16 16"><path pathLength="1" d="M4 8.4l2.6 2.6L12 5.6" /></svg>
          </span>
          {{ t.cellModesButton }}
        </span>
        <div class="mo-bubble" :class="{ 'is-in': pop }">
          <cap-widget ref="w2" class="mo-cap" data-cap-api-endpoint="/toolbox/" inert></cap-widget>
        </div>
      </div>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellModesTitle }}</h3>
      <p>{{ t.cellModesBody }}</p>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-modes .mo-art {
  --mo-top: 34px;
  --mo-w: 276px;
}
#homev2 .cell.tb-c-modes .mo-art::before {
  content: "";
  position: absolute;
  inset: -80px 20% auto;
  height: 300px;
  background: radial-gradient(ellipse 50% 60% at 50% 0%, #ffffff0b, transparent 70%);
  pointer-events: none;
}
#homev2 .cell.tb-c-modes .mo-shelf {
  top: 116px;
}
#homev2 .cell.tb-c-modes .mo-plate {
  --c: 20px;
  left: calc(50% - var(--mo-w) / 2 - 30px);
  width: calc(var(--mo-w) + 60px);
  top: 14px;
  height: 103px;
}
#homev2 .cell.tb-c-modes .mo-list {
  position: absolute;
  top: 136px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  line-height: 16px;
  color: #6c7086;
}
#homev2 .cell.tb-c-modes .mo-list li {
  transition: color 300ms var(--tb-ease);
}
#homev2 .cell.tb-c-modes .mo-list li.is-on {
  color: var(--text);
}
#homev2 .cell.tb-c-modes .mo-names {
  left: 32px;
  font-family: Inter, var(--font-sans);
}
#homev2 .cell.tb-c-modes .mo-names li {
  display: flex;
  align-items: center;
  gap: 9px;
}
#homev2 .cell.tb-c-modes .mo-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #45475a;
  transition:
    background-color 300ms var(--tb-ease),
    box-shadow 300ms var(--tb-ease);
}
#homev2 .cell.tb-c-modes .is-on .mo-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px #89b4fa26;
}
#homev2 .cell.tb-c-modes .mo-codes {
  right: 32px;
  align-items: flex-end;
  font-family: var(--font-code);
  font-size: 11.5px;
}
#homev2 .cell.tb-c-modes .mo-panel {
  position: absolute;
  top: var(--mo-top);
  left: calc(50% - var(--mo-w) / 2);
  width: var(--mo-w);
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 14px;
  background:
    linear-gradient(to bottom right, #ffffff0a, transparent 60%),
    #252538;
  box-shadow:
    inset 0 1px 0 #ffffff12,
    inset 0 0 0 1px #ffffff0b,
    0 0 0 4px #11111b8c,
    0 2px 4px #00000033,
    0 8px 14px -6px #0000004d;
  font-family: Inter, var(--font-sans);
  font-size: 12px;
  line-height: 1;
}
#homev2 .cell.tb-c-modes .mo-field {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  background: #181825;
  box-shadow: inset 0 0 0 1px #ffffff0a;
  color: #6c7086;
}
#homev2 .cell.tb-c-modes .mo-slot {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 520ms var(--tb-move);
}
#homev2 .cell.tb-c-modes .mo-slot-in {
  min-height: 0;
  overflow: hidden;
  padding-top: 8px;
  transition:
    opacity 300ms var(--tb-ease),
    filter 300ms var(--tb-ease);
}
#homev2 .cell.tb-c-modes .mo-art:not([data-mode="checkbox"]) .mo-slot {
  grid-template-rows: 0fr;
}
#homev2 .cell.tb-c-modes .mo-art:not([data-mode="checkbox"]) .mo-slot-in {
  opacity: 0;
  filter: blur(4px);
}
#homev2 .cell.tb-c-modes .mo-cap {
  display: block;
  width: 100%;
  pointer-events: none;
  --cap-widget-width: 100%;
  --cap-widget-height: 48px;
  --cap-widget-padding: 12px;
  --cap-gap: 10px;
  --cap-checkbox-size: 22px;
  --cap-checkbox-margin: 0px;
  --cap-background: #1e1e2e;
  --cap-border-color: #ffffff1f;
  --cap-border-radius: 9px;
  --cap-color: var(--text);
  --cap-checkbox-background: transparent;
  --cap-checkbox-border: 1px solid #585b70;
  --cap-checkbox-border-radius: 6px;
  --cap-spinner-color: var(--accent);
  --cap-spinner-background-color: #313244;
  --cap-font: Inter, var(--font-sans);
}
#homev2 .cell.tb-c-modes .mo-cap::part(label) {
  font-size: 13px;
}
#homev2 .cell.tb-c-modes .mo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 32px;
  margin-top: 8px;
  border-radius: 8px;
  background: linear-gradient(#e4e8f7, #c9d0ec);
  box-shadow:
    inset 0 1px 0 #ffffff80,
    0 1px 2px #00000040;
  font-size: 12.5px;
  font-weight: 500;
  color: #1e1e2e;
  transition: scale 160ms var(--tb-ease);
}
#homev2 .cell.tb-c-modes .mo-btn.is-press {
  scale: 0.96;
}
#homev2 .cell.tb-c-modes .mo-state {
  position: relative;
  width: 13px;
  height: 13px;
  margin-left: -6px;
}
#homev2 .cell.tb-c-modes [data-inv="idle"] .mo-state {
  display: none;
}
#homev2 .cell.tb-c-modes .mo-tick {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: #40a02b;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 320ms var(--tb-ease);
}
#homev2 .cell.tb-c-modes .mo-spin {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px solid #1e1e2e;
  border-right-color: transparent;
  opacity: 0;
}
#homev2 .cell.tb-c-modes [data-inv="spin"] .mo-spin {
  opacity: 1;
  animation: mo-spin 700ms linear infinite;
}
#homev2 .cell.tb-c-modes [data-inv="done"] .mo-tick {
  stroke-dashoffset: 0;
}
@keyframes mo-spin {
  to {
    rotate: 360deg;
  }
}
#homev2 .cell.tb-c-modes .mo-bubble {
  position: absolute;
  left: 18px;
  right: 18px;
  top: calc(100% - 4px);
  border-radius: 10px;
  box-shadow:
    0 2px 4px #00000040,
    0 14px 28px -6px #00000090;
  transform-origin: 50% -8px;
  opacity: 0;
  transform: translateY(-10px) scale(0.86);
  filter: blur(3px);
  pointer-events: none;
  transition:
    opacity 180ms ease-in,
    transform 180ms ease-in,
    filter 180ms ease-in;
}
#homev2 .cell.tb-c-modes .mo-bubble.is-in {
  opacity: 1;
  transform: none;
  filter: none;
  transition:
    opacity 360ms var(--tb-ease),
    transform 420ms var(--tb-ease),
    filter 360ms var(--tb-ease);
}

@media (max-width: 760px) {
  #homev2 .cell.tb-c-modes .mo-list {
    display: none;
  }
}
@media (max-width: 600px) {
  #homev2 .cell.tb-c-modes .mo-art {
    min-height: 236px;
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .cell.tb-c-modes :is(.mo-slot, .mo-slot-in, .mo-bubble, .mo-btn, .mo-tick, .mo-list li, .mo-dot) {
    transition: none;
  }
}
</style>
