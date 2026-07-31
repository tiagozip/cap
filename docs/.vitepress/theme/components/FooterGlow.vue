<script setup>
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

const VBW = 1271;
const VBH = 599;
const BASE = 614;
const BLUR = 15;

const BARS = [
  { x: -16, w: 174, h: 323 },
  { x: 125, w: 174, h: 404 },
  { x: 266, w: 174, h: 478 },
  { x: 407, w: 175, h: 530 },
  { x: 549, w: 173, h: 584 },
  { x: 689, w: 175, h: 530 },
  { x: 831, w: 174, h: 478 },
  { x: 972, w: 174, h: 404 },
  { x: 1113, w: 174, h: 323 },
];

const DEV = import.meta.env.DEV;

const TRANS = {
  id: "trans",
  label: "trans",
  colors: [
    "#03060D",
    "#5BCEFA",
    "#F5A9B8",
    "#FFFFFF",
    "#F5A9B8",
    "#5BCEFA",
    "#5BCEFA00",
  ],
};

const EXTRA_PALETTES = [
  {
    id: "dia",
    label: "dia",
    stops: [
      [0, "#340B05"],
      [0.182709, "#0358F7"],
      [0.283673, "#5092C7"],
      [0.413484, "#E1ECFE"],
      [0.586565, "#FFD400"],
      [0.682722, "#FA3D1D"],
      [0.802892, "#FD02F5"],
      [1, "#FFC0FD00"],
    ],
  },
  {
    id: "ocean",
    label: "ocean",
    colors: [
      "#010A18",
      "#023E6B",
      "#0077B6",
      "#00B4D8",
      "#90E0EF",
      "#CAF0F8",
      "#CAF0F800",
    ],
  },
  {
    id: "ember",
    label: "ember",
    colors: [
      "#140300",
      "#5A1200",
      "#B02E0C",
      "#F97316",
      "#FDBA74",
      "#FFE8D6",
      "#FFE8D600",
    ],
  },
  {
    id: "aurora",
    label: "aurora",
    colors: [
      "#01060F",
      "#062B4A",
      "#0F9E9E",
      "#23D18B",
      "#B6FF9E",
      "#E8FFF3",
      "#E8FFF300",
    ],
  },
  {
    id: "neon",
    label: "neon",
    colors: [
      "#0B0221",
      "#3B0A75",
      "#7B2CBF",
      "#E0218A",
      "#FF6EC7",
      "#7DF9FF",
      "#7DF9FF00",
    ],
  },
  {
    id: "pride",
    label: "pride",
    colors: [
      "#0A0018",
      "#750787",
      "#004DFF",
      "#008026",
      "#FFED00",
      "#FF8C00",
      "#E40303",
      "#E4030300",
    ],
  },
  {
    id: "bi",
    label: "bi",
    colors: ["#0B0116", "#D60270", "#9B4F96", "#0038A8", "#0038A800"],
  },
  {
    id: "lesbian",
    label: "lesbian",
    colors: [
      "#180400",
      "#D62900",
      "#FF9B55",
      "#FFFFFF",
      "#D461A6",
      "#A50062",
      "#A5006200",
    ],
  },
  {
    id: "nonbinary",
    label: "enby",
    colors: ["#050505", "#2C2C2C", "#9C59D1", "#FFFFFF", "#FCF434", "#FCF43400"],
  },
];

const PALETTES = DEV ? [TRANS, ...EXTRA_PALETTES] : [TRANS];

const Picker = DEV
  ? defineAsyncComponent(() => import("./FooterGlowPicker.vue"))
  : null;

const SAMPLES = 32;

function parseHex(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
    full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
  ];
}

function normalize(palette) {
  const raw =
    palette.stops ??
    palette.colors.map((c, i) => [i / (palette.colors.length - 1), c]);
  const parsed = raw.map(([offset, color]) => ({ offset, rgba: parseHex(color) }));
  const out = [];
  for (let s = 0; s < SAMPLES; s++) {
    const t = s / (SAMPLES - 1);
    let hi = parsed.findIndex((p) => p.offset >= t);
    if (hi < 0) hi = parsed.length - 1;
    const lo = Math.max(0, hi - 1);
    const a = parsed[lo];
    const b = parsed[hi];
    const span = b.offset - a.offset;
    const k = span <= 0 ? 0 : (t - a.offset) / span;
    const rgba = a.rgba.map((v, i) => v + (b.rgba[i] - v) * k);
    out.push({
      offset: t,
      color: `rgb(${Math.round(rgba[0])} ${Math.round(rgba[1])} ${Math.round(rgba[2])})`,
      opacity: rgba[3].toFixed(3),
    });
  }
  return out;
}

const RAMPS = Object.fromEntries(PALETTES.map((p) => [p.id, normalize(p)]));

const CHIPS = Object.fromEntries(
  PALETTES.map((p) => [
    p.id,
    `linear-gradient(0deg, ${RAMPS[p.id]
      .filter((_, i) => i % 4 === 0 && i < SAMPLES - 4)
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(", ")})`,
  ]),
);

const active = ref("trans");
const ramp = computed(() => RAMPS[active.value]);
const spacer = ref(null);
const art = ref(null);

function pick(id) {
  active.value = id;
  try {
    localStorage.setItem("cap-footer-glow", id);
  } catch {}
}

let teardown = () => {};

onMounted(() => {
  try {
    const saved = localStorage.getItem("cap-footer-glow");
    if (saved && RAMPS[saved]) active.value = saved;
  } catch {}

  const pad = spacer.value;
  const node = art.value;
  if (!pad || !node) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.style.transform = "scaleY(1)";
    return;
  }

  const desktop = window.matchMedia("(min-width: 1000px)");

  let progress = 0;
  let ticking = false;
  let settle = 0;
  let snapping = false;
  let snapRelease = 0;
  let last = 0;
  let lastAt = 0;
  let ticks = 0;
  let slow = false;

  const measure = () => {
    ticking = false;
    const rect = pad.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height || 1)));
    node.style.transform = `scaleY(${Math.min(1, progress / 0.995).toFixed(4)})`;
    document.documentElement.style.setProperty(
      "--glow-push",
      `${(progress * 12).toFixed(2)}vh`,
    );

    const now = performance.now();
    const dt = now - lastAt;
    const speed = dt > 0 ? (Math.abs(progress - last) / dt) * 1000 : 0;
    if (++ticks > 10) {
      slow = speed < 5 && dt < 50;
      ticks = 0;
    }
    if (snapping && speed > 0.1) snapping = false;
    last = progress;
    lastAt = now;
  };

  const snap = () => {
    if (!desktop.matches || snapping || progress <= 0.05) return;
    snapping = true;
    const top =
      window.scrollY + pad.getBoundingClientRect().top - window.innerHeight - 50;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    clearTimeout(snapRelease);
    snapRelease = setTimeout(() => {
      snapping = false;
    }, 1000);
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(measure);
    }
    clearTimeout(settle);
    settle = setTimeout(snap, slow ? 150 : 350);
  };

  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  teardown = () => {
    clearTimeout(settle);
    clearTimeout(snapRelease);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
});

onBeforeUnmount(() => teardown());
</script>

<template>
  <div class="ft-glow">
    <component
      :is="Picker"
      v-if="Picker"
      :palettes="PALETTES"
      :chips="CHIPS"
      :active="active"
      @pick="pick"
    />
    <div class="ft-glow-spacer" ref="spacer" />
  </div>

  <Teleport to="body">
    <div class="dia-glow" ref="art" aria-hidden="true">
      <svg
        :viewBox="`0 0 ${VBW} ${VBH}`"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="dia-glow-grad" x1="0" y1="1" x2="0" y2="0">
            <stop
              v-for="(s, i) in ramp"
              :key="i"
              :offset="s.offset"
              :style="{ stopColor: s.color, stopOpacity: s.opacity }"
            />
          </linearGradient>
          <filter
            id="dia-glow-blur"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            filterUnits="objectBoundingBox"
            color-interpolation-filters="sRGB"
          >
            <feGaussianBlur :stdDeviation="BLUR" />
          </filter>
        </defs>
        <g filter="url(#dia-glow-blur)">
          <rect
            v-for="(b, i) in BARS"
            :key="i"
            :x="b.x"
            :y="BASE - b.h"
            :width="b.w"
            :height="b.h"
            fill="url(#dia-glow-grad)"
          />
        </g>
      </svg>
    </div>
  </Teleport>
</template>

<style>
.dia-glow {
  position: fixed;
  left: 0;
  right: 0;
  bottom: -2vh;
  height: 175px;
  z-index: 2;
  pointer-events: none;
  mix-blend-mode: screen;
  transform: scaleY(0);
  transform-origin: bottom;
  will-change: transform;
}
.dia-glow svg {
  display: block;
  width: 100%;
  height: 100%;
}
.dia-glow stop {
  transition:
    stop-color 0.5s ease,
    stop-opacity 0.5s ease;
}

#homev2 .ft-glow-spacer {
  height: 175px;
}
@media (min-width: 600px) {
  .dia-glow,
  #homev2 .ft-glow-spacer {
    height: 300px;
  }
}
@media (min-width: 1000px) {
  .dia-glow,
  #homev2 .ft-glow-spacer {
    height: 65vh;
  }
  #homev2 .ft-bottom {
    transform: translateY(var(--glow-push, 0));
  }
}

#homev2 .ft-glow {
  position: relative;
  z-index: 3;
  margin-top: 50px;
}
@media (max-width: 700px) {
  #homev2 .ft-glow {
    margin-top: 32px;
  }
}
</style>
