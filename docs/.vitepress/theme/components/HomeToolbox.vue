<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const compliance = [
  { flag: "eu", name: "GDPR" },
  { flag: "us", name: "CCPA / CPRA" },
  { flag: "us", name: "HIPAA" },
  { flag: "ca", name: "PIPEDA" },
  { flag: "br", name: "LGPD" },
  { flag: "in", name: "DPDPA" },
  { flag: "cn", name: "PIPL" },
  { name: "152-FZ" },
];

const sizes = [
  { name: "Cap", kb: 20, self: true },
  { name: "ALTCHA", kb: 34 },
  { name: "Turnstile", kb: 110 },
  { name: "reCAPTCHA", kb: 500 },
  { name: "hCaptcha", kb: 600 },
];

const kbPerSecond = 240;
const rateMax = 30;
const rateRows = 36;
const rateGap = 140;
const rateLog = Array.from({ length: rateRows }, (_, i) => {
  const ms = 2000 + i * rateGap;
  return {
    n: i + 1,
    time: `14:09:${String(Math.floor(ms / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`,
    status: i < rateMax ? 200 : 429,
  };
}).reverse();

const programs = (() => {
  let x = 0x2545f491;
  const rnd = (n) => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return (x >>> 8) % n;
  };
  const ops = ["mul", "add", "sub", "xor", "or", "rotr", "shl"];
  return Array.from({ length: 3 }, () => ({
    seed: Array.from({ length: 8 }, () => rnd(16).toString(16)).join(""),
    lines: Array.from({ length: 10 }, (_, i) => {
      if (i === 9) return { op: "br", a: "start", b: "1/2" };
      const op = ops[rnd(ops.length)];
      return { op, a: `r${rnd(8)}`, b: op === "rotr" || op === "shl" ? String(1 + rnd(63)) : `r${rnd(8)}` };
    }),
  }));
})();

const modes = [
  { id: "checkbox", code: "<cap-widget>" },
  { id: "floating", code: "data-cap-floating" },
  { id: "invisible", code: "new Cap().solve()" },
];

const s = reactive({ bars: 1, prog: 0, rate: rateRows, priv: compliance.length, size: 1, api: 2 });
const m = reactive({ mode: "checkbox", pop: false, btn: "idle", token: "", cursor: false, press: false, cx: 0, cy: 0, gen: 0 });
const grid = ref(null);
const art = ref(null);
const widgetA = ref(null);
const widgetB = ref(null);
const btn = ref(null);
const cleanups = [];
let user = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const solveWidget = (w) =>
  new Promise((resolve) => {
    if (!w?.solve) return resolve();
    const done = () => {
      w.removeEventListener("solve", done);
      w.removeEventListener("error", done);
      resolve();
    };
    w.addEventListener("solve", done);
    w.addEventListener("error", done);
    setTimeout(done, 5000);
    w.solve();
  });

const pointAt = (el, dx = 0.5, dy = 0.5) => {
  if (!el || !art.value) return;
  const r = el.getBoundingClientRect();
  const c = art.value.getBoundingClientRect();
  m.cx = r.left - c.left + r.width * dx;
  m.cy = r.top - c.top + r.height * dy;
};

const setMode = async (id) => {
  m.mode = id;
  m.pop = false;
  m.btn = "idle";
  m.token = "";
  const dirty = [widgetA.value, widgetB.value].some((w) => w?.shadowRoot?.querySelector(".captcha")?.dataset.state);
  if (!dirty) return;
  m.gen++;
  await nextTick();
};

const runFloating = async () => {
  m.pop = true;
  await sleep(160);
  await solveWidget(widgetB.value);
  await sleep(500);
  m.pop = false;
};

const runInvisible = async () => {
  m.btn = "busy";
  const result = await new window.Cap({ apiEndpoint: "/toolbox/" }).solve().catch(() => null);
  const token = result?.token ?? "";
  m.token = token.length > 20 ? `${token.slice(0, 20)}…` : token;
  m.btn = "done";
};

const pickMode = (id) => {
  user = true;
  m.cursor = false;
  setMode(id);
};

const pressButton = () => {
  if (m.mode === "checkbox") return widgetA.value?.solve?.();
  if (m.mode === "floating") return m.pop || runFloating();
  if (m.btn === "idle") runInvisible();
};

onMounted(() => {
  const installId = setTimeout(() => {
    const prev = window.CAP_CUSTOM_FETCH;
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
    const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    const mine = async (url, options) => {
      if (!url.startsWith("/toolbox/")) return prev ? prev(url, options) : fetch(url, options);
      if (url.endsWith("challenge")) {
        await sleep(350);
        return json({ challenge: Array.from({ length: 50 }, () => [hex(16), hex(2)]), token: "", expires: Date.now() + 600000 });
      }
      await sleep(650);
      return json({ success: true, token: `${hex(5)}:${hex(12)}`, expires: Date.now() + 3600000 });
    };
    window.CAP_CUSTOM_FETCH = mine;
    cleanups.push(() => {
      if (window.CAP_CUSTOM_FETCH === mine) window.CAP_CUSTOM_FETCH = prev;
    });
  }, 60);
  cleanups.push(() => clearTimeout(installId));

  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const seen = {};
  const done = {};
  class Stop extends Error {}
  const hold = async (key, ms) => {
    await sleep(ms);
    if (!seen[key] || (key === "modes" && user)) throw new Stop();
  };

  const players = {
    modes: async () => {
      for (const { id } of modes) {
        await setMode(id);
        await hold("modes", 700);
        const target = id === "checkbox" ? widgetA.value?.shadowRoot?.querySelector(".checkbox") : btn.value;
        pointAt(target, id === "checkbox" ? 0.55 : 0.62, 0.6);
        m.cursor = true;
        await hold("modes", 900);
        m.press = true;
        await sleep(140);
        m.press = false;
        if (id === "checkbox") await solveWidget(widgetA.value);
        if (id === "floating") await runFloating();
        if (id === "invisible") await runInvisible();
        pointAt(target, 1.3, 1.6);
        await hold("modes", 1800);
      }
      m.cursor = false;
      await hold("modes", 400);
      await setMode("checkbox");
    },
    pow: async () => {
      s.bars = 2;
      await hold("pow", 360);
      s.bars = 0;
      await sleep(60);
      s.bars = 1;
      await hold("pow", 2000);
      s.prog = 1;
      await hold("pow", 1800);
      s.prog = 2;
    },
    rate: async () => {
      s.rate = 0;
      await hold("rate", 700);
      for (let i = 1; i <= rateRows; i++) {
        s.rate = i;
        await hold("rate", rateGap);
      }
    },
    priv: async () => {
      s.priv = 0;
      await hold("priv", 600);
      for (let i = 1; i <= compliance.length; i++) {
        s.priv = i;
        await hold("priv", 200);
      }
    },
    size: async () => {
      s.size = 2;
      await hold("size", 360);
      s.size = 0;
      await sleep(60);
      s.size = 1;
      await hold("size", 2800);
    },
    api: async () => {
      s.api = 3;
      await hold("api", 400);
      s.api = 0;
      await hold("api", 500);
      s.api = 1;
      await hold("api", 900);
      s.api = 2;
    },
  };
  const finals = {
    modes: () => {
      m.cursor = false;
      if (!user) setMode("checkbox");
    },
    pow: () => Object.assign(s, { bars: 1, prog: 2 }),
    rate: () => (s.rate = rateRows),
    priv: () => (s.priv = compliance.length),
    size: () => (s.size = 1),
    api: () => (s.api = 2),
  };

  const order = Object.keys(players);
  let busy = false;
  const pick = async () => {
    if (busy) return;
    const key = order.find((k) => seen[k] && !done[k]);
    if (!key) return;
    busy = true;
    done[key] = true;
    await sleep(300);
    try {
      await players[key]();
    } catch {
      finals[key]();
    }
    busy = false;
    pick();
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) seen[target.dataset.key] = isIntersecting;
      pick();
    },
    { threshold: 0.55 },
  );
  for (const el of grid.value.querySelectorAll("[data-key]")) io.observe(el);
  cleanups.push(() => io.disconnect());
});

onBeforeUnmount(() => {
  for (const fn of cleanups) fn();
});
</script>

<template>
  <div ref="grid" class="grid">
    <article class="cell tb-c-modes">
      <div class="tb-copy">
        <h3>{{ t.cellModesTitle }}</h3>
        <p>{{ t.cellModesBody }}</p>
        <div class="tb-tabs">
          <button
            v-for="mode in modes"
            :key="mode.id"
            type="button"
            class="tb-tab"
            :aria-pressed="m.mode === mode.id"
            @click="pickMode(mode.id)"
          >
            <code>{{ mode.code }}</code>
          </button>
        </div>
      </div>
      <div ref="art" class="tb-art tb-modes-art" data-key="modes" :data-mode="m.mode" :data-btn="m.btn">
        <div class="tb-form">
          <div class="tb-form-head">
            <b>Create account</b>
            <span>Sign up to get started</span>
          </div>
          <label class="tb-form-field">
            <span>Email</span>
            <span class="tb-input">you@example.com</span>
          </label>
          <div class="tb-slot">
            <cap-widget :key="`a${m.gen}`" ref="widgetA" class="tb-cap" data-cap-api-endpoint="/toolbox/"></cap-widget>
          </div>
          <div class="tb-submit">
            <div class="tb-float" :class="{ open: m.pop }">
              <cap-widget :key="`b${m.gen}`" ref="widgetB" class="tb-cap" data-cap-api-endpoint="/toolbox/"></cap-widget>
            </div>
            <button ref="btn" type="button" class="tb-signup" :class="{ pressed: m.press }" @click="pressButton">
              <span class="tb-signup-label tb-s-idle">Sign up</span>
              <span class="tb-signup-label tb-s-busy"><span class="tb-spin"></span>Signing up...</span>
              <span class="tb-signup-label tb-s-done">
                <svg class="tb-tick" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.4l2.6 2.6L12 5.6" /></svg>Signed up
              </span>
            </button>
            <code class="tb-token">token: "{{ m.token }}"</code>
          </div>
        </div>
        <svg
          class="tb-cursor"
          :class="{ on: m.cursor, press: m.press }"
          :style="{ '--x': `${m.cx}px`, '--y': `${m.cy}px` }"
          viewBox="0 0 16 20"
          width="15"
          height="19"
          aria-hidden="true"
        >
          <path d="M1 1v15.2l3.9-3.7 2.6 5.9 2.7-1.2-2.6-5.7H13z" />
        </svg>
      </div>
    </article>

    <article class="cell tb-c-pow">
      <div class="tb-copy">
        <h3>{{ t.cellPowTitle }}</h3>
        <p>{{ t.cellPowBody }}</p>
        <a class="text-link small" :href="`${lp}/guide/hashwx.html`">HashWX</a>
      </div>
      <div class="tb-art tb-pow-art" data-key="pow" :data-s="s.bars" aria-hidden="true">
        <div class="tb-chart">
          <div class="tb-axis">
            <span v-for="n in [1, 50, 100, 150]" :key="n" :style="{ '--p': (n / 170) * 100 }"><i>{{ n }}x</i></span>
          </div>
          <div
            v-for="([name, x], i) in t.powRows"
            :key="name"
            class="tb-row"
            :class="{ good: x < 10 }"
            :style="{ '--p': Math.max(1.4, (x / 170) * 100), '--to': x, '--i': i }"
          >
            <span class="tb-name">{{ name }}</span>
            <span class="tb-track"><span class="tb-fill"></span></span>
            <span class="tb-val tb-val-x"></span>
          </div>
        </div>
        <div class="tb-program" :data-prog="s.prog">
          <div class="tb-program-head">
            <code v-for="(p, i) in programs" :key="p.seed" :class="{ on: s.prog === i }">hashwx_make(0x{{ p.seed }})</code>
          </div>
          <div class="tb-program-body">
            <div v-for="(p, i) in programs" :key="p.seed" class="tb-program-lines" :class="{ on: s.prog === i }">
              <code v-for="(l, j) in p.lines" :key="j" :style="{ '--j': j }"
                ><i>{{ String(j + 1).padStart(2, " ") }}</i><b>{{ l.op.padEnd(5, " ") }}</b>{{ l.a }}, {{ l.b }}</code
              >
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="cell tb-c-rate">
      <div class="tb-art tb-rate-art" data-key="rate" :data-s="s.rate" aria-hidden="true">
        <div class="tb-rate-head">
          <span>203.0.113.7</span>
          <span>30 per 5000 ms</span>
        </div>
        <div class="tb-log">
          <div class="tb-log-rows" :style="{ '--shift': rateRows - s.rate }">
            <div v-for="row in rateLog" :key="row.n" class="tb-log-row" :class="{ no: row.status === 429 }">
              <span class="tb-log-time">{{ row.time }}</span>
              <span class="tb-log-req">POST /challenge</span>
              <span class="tb-log-status">{{ row.status }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="tb-copy">
        <h3>{{ t.cellRateTitle }}</h3>
        <p>{{ t.cellRateBody }}</p>
      </div>
    </article>

    <article class="cell tb-c-priv">
      <div class="tb-art tb-priv-art" data-key="priv" aria-hidden="true">
        <div class="tb-chips">
          <span v-for="(c, i) in compliance" :key="c.name" class="tb-chip" :class="{ on: s.priv > i }">
            <i></i>
            <img v-if="c.flag" :src="`/assets/flags/${c.flag}.svg`" alt="" width="14" height="14" loading="lazy" />
            {{ c.name }}
          </span>
        </div>
      </div>
      <div class="tb-copy">
        <h3>{{ t.cellPrivacyTitle }}</h3>
        <p>{{ t.cellPrivacyBody }}</p>
        <a class="text-link small" :href="`${lp}/guide/compliance.html`" data-cta="compliance" data-cta-location="home">{{ t.ftCompliance }}</a>
      </div>
    </article>

    <article class="cell tb-c-size">
      <div class="tb-art tb-size-art" data-key="size" :data-s="s.size" aria-hidden="true">
        <div class="tb-net">
          <div class="tb-net-ticks">
            <span v-for="n in [1, 2]" :key="n" :style="{ '--p': ((n * kbPerSecond) / 600) * 100 }"><i>{{ n }} s</i></span>
          </div>
          <div
            v-for="(row, i) in sizes"
            :key="row.name"
            class="tb-row"
            :class="{ good: row.self }"
            :style="{ '--p': (row.kb / 600) * 100, '--to': row.kb, '--d': `${(row.kb / kbPerSecond) * 1000}ms`, '--i': i }"
          >
            <span class="tb-name">{{ row.name }}</span>
            <span class="tb-val tb-val-kb"></span>
            <span class="tb-track"><span class="tb-fill"></span></span>
          </div>
        </div>
      </div>
      <div class="tb-copy">
        <h3>{{ t.cellSizeTitle }}</h3>
        <p>{{ t.cellSizeBody }}</p>
      </div>
    </article>

    <article class="cell tb-c-api">
      <div class="tb-copy">
        <h3>{{ t.cellApiTitle }}</h3>
        <p>{{ t.cellApiBody }}</p>
      </div>
      <div class="tb-art tb-api-art" data-key="api" :data-s="s.api" aria-hidden="true">
        <div class="tb-api-flow">
          <pre class="tb-frag tb-req"><code><span class="j-m">POST</span> /&lt;site-key&gt;/siteverify
{
  <span class="j-p">"secret"</span>: <span class="j-s">"…"</span>,
  <span class="j-p">"response"</span>: <span class="j-s">"…"</span>
}</code></pre>
          <div class="tb-wire"><span class="tb-packet"></span></div>
          <pre class="tb-frag tb-res"><code><span class="tb-res-code">200 OK</span>
{
  <span class="j-p">"success"</span>: <span class="j-t">true</span>
}</code></pre>
        </div>
      </div>
    </article>
  </div>
</template>

<style>
@property --tb-n {
  syntax: "<integer>";
  inherits: false;
  initial-value: 0;
}
#homev2 .grid {
  --tb-ease: cubic-bezier(0.23, 1, 0.32, 1);
  --tb-move: cubic-bezier(0.77, 0, 0.175, 1);
  --tb-line: #ffffff12;
  margin-top: 56px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas:
    "modes modes pow"
    "rate priv pow"
    "size api api";
  gap: 12px;
}
#homev2 .tb-c-modes {
  grid-area: modes;
}
#homev2 .tb-c-pow {
  grid-area: pow;
}
#homev2 .tb-c-rate {
  grid-area: rate;
}
#homev2 .tb-c-priv {
  grid-area: priv;
}
#homev2 .tb-c-size {
  grid-area: size;
}
#homev2 .tb-c-api {
  grid-area: api;
}
#homev2 .cell {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 16px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge);
  overflow: hidden;
}
#homev2 .tb-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 26px 28px 28px;
}
#homev2 .cell h3 {
  font-size: 1.25rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
#homev2 .cell p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  text-wrap: pretty;
  max-width: 42ch;
}
#homev2 .cell .text-link {
  align-self: flex-start;
}
#homev2 .tb-art {
  position: relative;
  flex: 1;
  min-height: 220px;
  font-family: Inter, var(--font-sans);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}
#homev2 .tb-art pre {
  margin: 0;
  background: none;
  overflow: visible;
}
#homev2 .tb-art code,
#homev2 .tb-tab code {
  font: 0.75rem/1.75 var(--font-code);
  white-space: pre;
  color: var(--text-faint);
  background: none;
  padding: 0;
}
#homev2 .tb-tick {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
#homev2 .tb-spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid #11111b40;
  border-top-color: var(--accent-ink);
}

#homev2 .tb-c-modes {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  min-height: 420px;
}
#homev2 .tb-c-modes .tb-copy {
  padding-right: 8px;
}
#homev2 .tb-tabs {
  display: grid;
  margin-top: auto;
  padding-top: 24px;
}
#homev2 .tb-tab {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  padding-left: 16px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
#homev2 .tb-tab::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: var(--tb-line);
}
#homev2 .tb-tab::after {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  margin-left: -0.5px;
  border-radius: 1px;
  background: var(--accent);
  transform: scaleY(0);
  opacity: 0;
}
#homev2 .tb-tab[aria-pressed="true"]::after {
  transform: none;
  opacity: 1;
}
#homev2 .tb-tab code {
  font-size: 0.8125rem;
  transition: color 120ms ease;
}
#homev2 .tb-tab[aria-pressed="true"] code {
  color: var(--text);
}
@media (hover: hover) {
  #homev2 .tb-tab:hover code {
    color: var(--text-secondary);
  }
  #homev2 .tb-tab[aria-pressed="true"]:hover code {
    color: var(--text);
  }
}
#homev2 .tb-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}
#homev2 .tb-modes-art {
  min-height: 0;
}
#homev2 .tb-form {
  position: absolute;
  top: 44px;
  left: 8px;
  right: -40px;
  bottom: -40px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 26px 64px 0 26px;
  border-radius: 14px;
  background: #ffffff03;
  box-shadow: inset 0 0 0 1px var(--tb-line);
  mask-image: linear-gradient(#000 70%, transparent);
}
#homev2 .tb-form-head {
  display: grid;
  gap: 2px;
  margin-bottom: 4px;
}
#homev2 .tb-form-head b {
  font-weight: 500;
  font-size: 0.9375rem;
  color: var(--text);
}
#homev2 .tb-form-field {
  display: grid;
  gap: 6px;
  font-size: 0.75rem;
}
#homev2 .tb-input {
  display: flex;
  align-items: center;
  height: 38px;
  padding-inline: 12px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--edge-strong);
  color: #6c7086;
  font-size: 0.8125rem;
}
#homev2 .tb-cap {
  display: block;
  width: 260px;
  min-height: 58px;
  --cap-background: var(--panel);
  --cap-border-color: var(--edge-strong);
  --cap-border-radius: var(--radius);
  --cap-color: var(--text);
  --cap-checkbox-background: transparent;
  --cap-checkbox-border: 1px solid #585b70;
  --cap-checkbox-border-radius: 6px;
  --cap-spinner-color: var(--accent);
  --cap-spinner-background-color: #313244;
  --cap-focus-ring: var(--accent);
  --cap-troubleshoot-color: var(--accent);
}
#homev2 .tb-slot {
  display: grid;
}
#homev2 .tb-modes-art:not([data-mode="checkbox"]) .tb-slot {
  display: none;
}
#homev2 .tb-submit {
  position: relative;
  display: grid;
  gap: 10px;
}
#homev2 .tb-float {
  position: absolute;
  left: 50%;
  margin-left: -130px;
  bottom: calc(100% + 8px);
  z-index: 1;
  border-radius: var(--radius);
  box-shadow: 0 6px 24px #0000004d;
  transform-origin: 50% 100%;
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  visibility: hidden;
}
#homev2 .tb-float.open {
  opacity: 1;
  transform: none;
  visibility: visible;
}
#homev2 .tb-modes-art:not([data-mode="floating"]) .tb-float {
  display: none;
}
#homev2 .tb-signup {
  display: grid;
  place-items: center;
  height: 38px;
  border: 0;
  border-radius: 8px;
  background: var(--text);
  color: var(--accent-ink);
  font: 500 0.8125rem/1 Inter, var(--font-sans);
  cursor: pointer;
}
#homev2 .tb-signup.pressed {
  transform: scale(0.97);
}
#homev2 .tb-signup:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
#homev2 .tb-signup-label {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  filter: blur(4px);
}
#homev2 .tb-modes-art:not([data-btn="busy"], [data-btn="done"]) .tb-s-idle,
#homev2 .tb-modes-art[data-btn="busy"] .tb-s-busy,
#homev2 .tb-modes-art[data-btn="done"] .tb-s-done {
  opacity: 1;
  filter: none;
}
#homev2 .tb-modes-art[data-btn="busy"] .tb-spin {
  animation: tb-spin 700ms linear infinite;
}
#homev2 .tb-s-done .tb-tick {
  width: 14px;
  height: 14px;
}
#homev2 .tb-token {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
}
#homev2 .tb-modes-art[data-mode="invisible"][data-btn="done"] .tb-token {
  opacity: 1;
}
#homev2 .tb-cursor {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  overflow: visible;
  fill: var(--text);
  stroke: var(--ground);
  stroke-width: 1.2;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 2px #0006);
  transform: translate(var(--x), var(--y));
  opacity: 0;
  pointer-events: none;
}
#homev2 .tb-cursor.on {
  opacity: 1;
}
#homev2 .tb-cursor.press {
  transform: translate(var(--x), var(--y)) scale(0.85);
}
@keyframes tb-spin {
  to {
    transform: rotate(1turn);
  }
}

#homev2 .tb-c-pow .tb-copy {
  padding-bottom: 8px;
}
#homev2 .tb-pow-art {
  display: flex;
  flex-direction: column;
  gap: 40px;
  padding: 36px 28px 0;
}
#homev2 .tb-chart {
  position: relative;
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) 2.75em;
  column-gap: 14px;
  row-gap: 18px;
}
#homev2 .tb-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  white-space: nowrap;
}
#homev2 .tb-track {
  position: relative;
  height: 4px;
  border-radius: 2px;
  background: #ffffff08;
  overflow: hidden;
}
#homev2 .tb-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #ffffff26;
  transform: translateX(calc(var(--p) * 1% - 100%));
}
#homev2 .tb-row.good .tb-fill {
  background: var(--accent);
}
#homev2 .tb-row.good .tb-name,
#homev2 .tb-row.good .tb-val {
  color: var(--text);
}
#homev2 .tb-val {
  --tb-n: var(--to);
  counter-reset: tbn var(--tb-n);
  text-align: right;
}
#homev2 .tb-val-x::before {
  content: counter(tbn) "x";
}
#homev2 .tb-val-kb::before {
  content: counter(tbn) " kB";
}
#homev2 .tb-art[data-s="0"] .tb-fill {
  transform: translateX(-100%);
}
#homev2 .tb-art[data-s="0"] .tb-val {
  --tb-n: 0;
  opacity: 0;
}
#homev2 .tb-art[data-s="2"] .tb-fill,
#homev2 .tb-art[data-s="2"] .tb-val {
  opacity: 0;
}
#homev2 .tb-axis {
  position: absolute;
  inset: -20px 0 -26px;
  display: grid;
  grid-template-columns: subgrid;
  pointer-events: none;
}
#homev2 .tb-axis span {
  grid-column: 2;
  grid-row: 1;
  position: relative;
}
#homev2 .tb-axis span::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 18px;
  left: calc(var(--p) * 1%);
  border-left: 1px dashed #ffffff0d;
  mask-image: linear-gradient(transparent, #000 25%, #000 75%, transparent);
}
#homev2 .tb-axis i {
  position: absolute;
  bottom: 0;
  left: calc(var(--p) * 1%);
  translate: -50% 0;
  font-style: normal;
  font-size: 0.6875rem;
  color: #6c7086;
}
#homev2 .tb-program {
  flex: 1;
  min-height: 220px;
  margin-inline: -28px -28px;
  margin-left: 0;
  border-radius: 12px 0 0 0;
  box-shadow: inset 1px 1px 0 var(--tb-line);
  background: #ffffff02;
  mask-image: linear-gradient(#000 55%, transparent);
}
#homev2 .tb-program-head {
  display: grid;
  height: 38px;
  align-items: center;
  padding-inline: 16px;
  box-shadow: inset 0 -1px 0 var(--tb-line);
}
#homev2 .tb-program-head code,
#homev2 .tb-program-lines {
  grid-area: 1 / 1;
}
#homev2 .tb-program-head code {
  color: var(--text-secondary);
  opacity: 0;
  filter: blur(4px);
}
#homev2 .tb-program-head code.on {
  opacity: 1;
  filter: none;
}
#homev2 .tb-program-body {
  display: grid;
  padding: 10px 0;
}
#homev2 .tb-program-lines {
  display: grid;
}
#homev2 .tb-program-lines code {
  display: block;
  padding-inline: 16px;
  line-height: 1.9;
  opacity: 0;
  filter: blur(4px);
  transform: translateY(3px);
}
#homev2 .tb-program-lines.on code {
  opacity: 1;
  filter: none;
  transform: none;
}
#homev2 .tb-program-lines i {
  display: inline-block;
  width: 3.5ch;
  font-style: normal;
  color: #45475a;
}
#homev2 .tb-program-lines b {
  font-weight: 400;
  color: #cba6f7;
}

#homev2 .tb-rate-art {
  display: flex;
  flex-direction: column;
  padding: 28px 28px 0;
}
#homev2 .tb-rate-head {
  display: flex;
  justify-content: space-between;
  padding-bottom: 12px;
  font-size: 0.75rem;
  box-shadow: inset 0 -1px 0 var(--tb-line);
}
#homev2 .tb-rate-head span:first-child {
  color: var(--text-secondary);
}
#homev2 .tb-log {
  flex: none;
  height: 176px;
  overflow: hidden;
  mask-image: linear-gradient(#000 45%, transparent);
}
#homev2 .tb-log-rows {
  transform: translateY(calc(var(--shift) * -32px));
}
#homev2 .tb-log-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
  height: 32px;
  font-size: 0.75rem;
  box-shadow: inset 0 -1px 0 #ffffff08;
}
#homev2 .tb-log-req {
  color: var(--text-secondary);
}
#homev2 .tb-log-status {
  color: var(--success);
}
#homev2 .tb-log-row.no .tb-log-status {
  color: var(--danger);
}
#homev2 .tb-log-row.no .tb-log-req {
  color: var(--text-faint);
}

#homev2 .tb-priv-art {
  display: grid;
  place-items: center;
  padding: 32px 24px 8px;
}
#homev2 .tb-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  max-width: 320px;
}
#homev2 .tb-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding-inline: 10px 11px;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--tb-line);
  font-size: 0.8125rem;
  white-space: nowrap;
}
#homev2 .tb-chip i {
  position: relative;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px #ffffff2e;
}
#homev2 .tb-chip i::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--success);
  opacity: 0;
  transform: scale(0.4);
}
#homev2 .tb-chip.on i::after {
  opacity: 1;
  transform: none;
}
#homev2 .tb-chip img {
  border-radius: 2px;
  outline: 1px solid #ffffff14;
  outline-offset: -1px;
}
#homev2 .tb-chip.on {
  color: var(--text-secondary);
}

#homev2 .tb-size-art {
  display: grid;
  align-items: center;
  padding: 36px 28px 4px;
}
#homev2 .tb-net {
  position: relative;
  display: grid;
  grid-template-columns: max-content 3.5em minmax(0, 1fr);
  column-gap: 14px;
  row-gap: 14px;
}
#homev2 .tb-net .tb-val {
  text-align: right;
}
#homev2 .tb-net-ticks {
  position: absolute;
  inset: -22px 0 -6px;
  display: grid;
  grid-template-columns: subgrid;
  pointer-events: none;
}
#homev2 .tb-net-ticks span {
  grid-column: 3;
  grid-row: 1;
  position: relative;
}
#homev2 .tb-net-ticks span::before {
  content: "";
  position: absolute;
  top: 20px;
  bottom: 0;
  left: calc(var(--p) * 1%);
  border-left: 1px dashed #ffffff0d;
}
#homev2 .tb-net-ticks i {
  position: absolute;
  top: 0;
  left: calc(var(--p) * 1%);
  translate: -50% 0;
  font-style: normal;
  font-size: 0.6875rem;
  color: #6c7086;
}

#homev2 .tb-c-api {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
}
#homev2 .tb-api-art {
  overflow: hidden;
}
#homev2 .tb-api-flow {
  position: absolute;
  top: 28px;
  bottom: -16px;
  left: 0;
  right: -1px;
  display: flex;
  align-items: stretch;
  mask-image: linear-gradient(#000 60%, transparent);
}
#homev2 .tb-frag {
  flex: none;
  padding: 14px 16px 40px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--tb-line);
  background: #ffffff02;
}
#homev2 .tb-frag code {
  color: var(--text-secondary);
}
#homev2 .tb-res {
  border-radius: 12px 0 0 12px;
  flex: 1;
}
#homev2 .tb-res-code {
  color: var(--success);
}
#homev2 .tb-wire {
  position: relative;
  flex: 1;
  min-width: 32px;
  max-width: 72px;
  height: 1px;
  margin-top: 26px;
  align-self: flex-start;
  background: var(--tb-line);
}
#homev2 .tb-packet {
  position: absolute;
  inset: 0;
  opacity: 0;
}
#homev2 .tb-packet::before {
  content: "";
  position: absolute;
  top: -2.5px;
  left: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
#homev2 .tb-api-art:not([data-s="2"]) .tb-res code {
  opacity: 0;
  filter: blur(4px);
}

#homev2 .j-k {
  color: #cba6f7;
}
#homev2 .j-f,
#homev2 .j-m {
  color: var(--accent);
}
#homev2 .j-p {
  color: #89dceb;
}
#homev2 .j-s {
  color: var(--success);
}
#homev2 .j-t {
  color: #fab387;
}

@media (prefers-reduced-motion: no-preference) {
  #homev2 .tb-tab::after {
    transition:
      transform 260ms var(--tb-ease),
      opacity 160ms ease-out;
  }
  #homev2 .tb-float {
    transition:
      opacity 150ms ease-out,
      transform 200ms var(--tb-ease),
      visibility 0s linear 200ms;
  }
  #homev2 .tb-float.open {
    transition:
      opacity 150ms ease-out,
      transform 200ms var(--tb-ease),
      visibility 0s;
  }
  #homev2 .tb-signup {
    transition: transform 160ms ease-out;
  }
  #homev2 .tb-signup:active {
    transform: scale(0.97);
  }
  #homev2 .tb-signup-label,
  #homev2 .tb-token {
    transition:
      opacity 220ms ease-out,
      filter 220ms ease-out;
  }
  #homev2 .tb-cursor {
    transition:
      transform 900ms var(--tb-move),
      opacity 240ms ease-out;
  }
  #homev2 .tb-cursor.press {
    transition:
      transform 120ms ease-out,
      opacity 240ms ease-out;
  }
  #homev2 .tb-pow-art .tb-fill {
    transition:
      transform 1600ms var(--tb-ease) calc(var(--i) * 90ms),
      opacity 300ms ease-out;
  }
  #homev2 .tb-pow-art .tb-val {
    transition:
      --tb-n 1600ms var(--tb-ease) calc(var(--i) * 90ms),
      opacity 300ms ease-out calc(var(--i) * 90ms);
  }
  #homev2 .tb-size-art .tb-fill {
    transition:
      transform var(--d) linear,
      opacity 300ms ease-out;
  }
  #homev2 .tb-size-art .tb-val {
    transition:
      --tb-n var(--d) linear,
      opacity 200ms ease-out;
  }
  #homev2 .tb-art[data-s="0"] .tb-fill,
  #homev2 .tb-art[data-s="0"] .tb-val {
    transition: none;
  }
  #homev2 .tb-program-head code {
    transition:
      opacity 240ms ease-out,
      filter 240ms ease-out;
  }
  #homev2 .tb-program-lines code {
    transition:
      opacity 200ms ease-out,
      filter 200ms ease-out,
      transform 260ms var(--tb-ease);
  }
  #homev2 .tb-program-lines.on code {
    transition:
      opacity 260ms ease-out calc(var(--j) * 45ms + 80ms),
      filter 260ms ease-out calc(var(--j) * 45ms + 80ms),
      transform 320ms var(--tb-ease) calc(var(--j) * 45ms + 80ms);
  }
  #homev2 .tb-log-rows {
    transition: transform 240ms var(--tb-ease);
  }
  #homev2 .tb-chip i::after {
    transition:
      opacity 200ms ease-out,
      transform 280ms var(--tb-ease);
  }
  #homev2 .tb-chip {
    transition: color 200ms ease-out;
  }
  #homev2 .tb-res code {
    transition:
      opacity 320ms ease-out,
      filter 320ms ease-out;
  }
  #homev2 .tb-api-art[data-s="1"] .tb-packet {
    animation: tb-packet 760ms var(--tb-move) forwards;
  }
}
@keyframes tb-packet {
  0% {
    opacity: 0;
    transform: translateX(0);
  }
  15%,
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}
@keyframes tb-packet-down {
  0% {
    opacity: 0;
    transform: translateY(0);
  }
  15%,
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(100%);
  }
}
@media (max-width: 960px) {
  #homev2 .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      "modes modes"
      "pow rate"
      "pow priv"
      "size size"
      "api api";
  }
}
@media (max-width: 600px) {
  #homev2 .grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "modes" "pow" "rate" "priv" "size" "api";
  }
  #homev2 .tb-c-modes,
  #homev2 .tb-c-api {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .tb-modes-art {
    min-height: 360px;
  }
  #homev2 .tb-form {
    top: 8px;
    left: 20px;
  }
  #homev2 .tb-api-art {
    min-height: 330px;
  }
  #homev2 .tb-api-flow {
    top: 4px;
    left: 28px;
    flex-direction: column;
    align-items: flex-start;
  }
  #homev2 .tb-frag {
    padding-bottom: 14px;
  }
  #homev2 .tb-res {
    flex: none;
    align-self: stretch;
    padding-bottom: 40px;
  }
  #homev2 .tb-wire {
    flex: none;
    min-width: 0;
    width: 1px;
    height: 32px;
    margin: 0 0 0 28px;
  }
  #homev2 .tb-packet::before {
    top: -3px;
    left: -2.5px;
  }
  #homev2 .tb-api-art[data-s="1"] .tb-packet {
    animation-name: tb-packet-down;
  }
  #homev2 .tb-program {
    min-height: 260px;
  }
}
</style>
