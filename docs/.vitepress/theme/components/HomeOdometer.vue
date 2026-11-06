<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({ lang: { type: String, default: "en" } });

const PACKAGES = ["@cap.js/wasm", "@cap.js/widget", "cap-widget"];
const YEAR_MS = 365 * 864e5;

const total = ref(4695114711);
const armed = ref(false);
const rolled = ref(false);
const settled = ref(false);
const root = ref(null);

const format = computed(() => new Intl.NumberFormat(props.lang));
const label = computed(() => format.value.format(total.value));
const parts = computed(() => {
  const chars = [];
  for (const part of format.value.formatToParts(total.value)) {
    for (const ch of part.value) chars.push(part.type === "integer" ? { d: +ch } : { s: ch });
  }
  let place = 0;
  for (let i = chars.length - 1; i >= 0; i--) if ("d" in chars[i]) chars[i].place = place++;
  return chars;
});

const move = (strip, d) => {
  const row = strip.firstElementChild?.offsetHeight;
  if (!row) return;
  const at = (-new DOMMatrix(getComputedStyle(strip).transform).m42 / row) % 10;
  strip.style.transition = "none";
  strip.style.transform = `translateY(${-at * row}px)`;
  strip.offsetHeight;
  strip.style.transition = "";
  const to = d + 0.001 >= at ? d : d + 10;
  strip.style.transform = `translateY(calc(${-to} * 1lh))`;
};

const sync = () => {
  const strips = root.value?.querySelectorAll(".odo-strip");
  if (!strips) return;
  const digits = new Map(parts.value.filter((p) => "d" in p).map((p) => [p.place, p.d]));
  for (const strip of strips) {
    const d = digits.get(+strip.dataset.place);
    if (d !== undefined) move(strip, d);
  }
};

let timer = 0;
let io;
let visible = false;
let rate = 0;
let last = 0;

const tick = () => {
  const now = performance.now();
  const step = Math.round(rate * (now - last) * (0.55 + Math.random() * 0.9));
  last = now;
  if (step > 0) {
    total.value += step;
    if (rolled.value) nextTick(sync);
  }
  timer = setTimeout(tick, 650 + Math.random() * 1900);
};

onMounted(async () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    rolled.value = true;
    settled.value = true;
  } else armed.value = true;

  io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible || rolled.value) return;
    const wait = Math.max(0, 1100 - performance.now());
    setTimeout(() => {
      root.value?.classList.remove("is-armed");
      rolled.value = true;
      sync();
      setTimeout(() => (settled.value = true), 2400);
    }, wait);
  });
  if (root.value) io.observe(root.value);

  try {
    const counts = await Promise.all(
      PACKAGES.map((p) =>
        fetch(`https://data.jsdelivr.com/v1/stats/packages/npm/${p}?period=year`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => j?.hits?.total ?? 0),
      ),
    );
    const sum = counts.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      rate = sum / YEAR_MS;
      if (sum > total.value) total.value = sum;
      if (rolled.value) nextTick(sync);
    }
  } catch {}

  if (!rate || reduced) return;
  last = performance.now();
  timer = setTimeout(tick, 900);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  io?.disconnect();
});
</script>

<template>
  <span ref="root" class="odo" :class="{ 'is-armed': armed && !rolled, 'is-settled': settled }">
    <span class="odo-sr">{{ label }}</span>
    <span class="odo-face" aria-hidden="true"
      ><template v-for="(p, i) in parts" :key="'d' in p ? `d${p.place}` : `s${i}`"
        ><span v-if="'d' in p" class="odo-col"
          ><span class="odo-strip" :data-place="p.place" :style="{ '--o': p.d, '--p': p.place }"
            ><span v-for="n in 20" :key="n">{{ (n - 1) % 10 }}</span></span
          ></span
        ><span v-else class="odo-sep">{{ p.s }}</span></template
      ></span
    >
  </span>
</template>

<style>
#homev2 .odo {
  position: relative;
  display: inline-block;
  white-space: nowrap;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
#homev2 .odo-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
#homev2 .odo-face {
  display: inline-flex;
  vertical-align: bottom;
}
#homev2 .odo-sep {
  font-variant-numeric: normal;
}
#homev2 .odo-col {
  display: inline-block;
  height: 1lh;
  overflow: hidden;
  mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
}
#homev2 .odo-strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--o) * -1lh));
  transition: transform 700ms cubic-bezier(0.23, 1, 0.32, 1);
}
#homev2 .odo:not(.is-settled) .odo-strip {
  transition: transform 1600ms cubic-bezier(0.16, 1, 0.3, 1) calc(var(--p) * 45ms);
}
#homev2 .odo.is-armed .odo-strip {
  transform: none;
  transition: none !important;
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .odo-strip {
    transition: none !important;
  }
}
</style>
