<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import claude from "../../../../capd/dashboard/src/assets/agents/claude.svg?raw";
import codex from "../../../../capd/dashboard/src/assets/agents/codex.svg?raw";
import cursor from "../../../../capd/dashboard/src/assets/agents/cursor.svg?raw";
import { playConnect } from "../../../../capd/dashboard/src/components/cap/connect.js";
import { fieldLines } from "../../../../capd/dashboard/src/polish/login/field.js";

const props = defineProps({
  t: { type: Object, required: true },
  lp: { type: String, default: "" },
});

const URL = "https://cap.example.com/mcp";
const PROMPT =
  "Connect to my capd server over MCP. The endpoint is /mcp on my capd URL, so ask me for the URL if you don't know it. Setup steps for each agent are at https://trycap.dev/guide/capd/options.html#mcp-server";

const AGENTS = [
  {
    name: "Claude Code",
    host: "localhost:33418",
    icon: claude,
    acts: [
      ["list_site_keys", "3 keys"],
      ["get_analytics", "41.2k solves this week"],
      ["set_rules", "challenge datacenter IPs"],
    ],
    code: [
      [["c-tag", "claude"], ["", " mcp add "], ["c-attr", "--transport"], ["", " http capd \\"]],
      [["", "  "], ["c-str", URL]],
    ],
  },
  {
    name: "Cursor",
    host: "cursor:",
    icon: cursor,
    file: "~/.cursor/mcp.json",
    acts: [
      ["create_site_key", "Checkout"],
      ["set_cors", "shop.example.com"],
      ["get_secret_key", "added to .env"],
    ],
    code: [
      [["", "{"]],
      [["", "  "], ["c-attr", '"mcpServers"'], ["", ": {"]],
      [["", "    "], ["c-attr", '"capd"'], ["", ": {"]],
      [["", "      "], ["c-attr", '"url"'], ["", ": "], ["c-str", `"${URL}"`]],
      [["", "    }"]],
      [["", "  }"]],
      [["", "}"]],
    ],
  },
  {
    name: "Codex",
    host: "localhost:1455",
    icon: codex,
    acts: [
      ["what_changed", "fails up 6x since 14:02"],
      ["search_events", "1.8k from AS16509"],
      ["block_ip", "203.0.113.0/24"],
    ],
    code: [
      [["c-tag", "codex"], ["", " mcp add capd \\"]],
      [["", "  "], ["c-attr", "--url"], ["", " "], ["c-str", URL]],
    ],
  },
];

const PACKETS = [
  [13, 9, 0],
  [16, 11, 3.5],
  [11, 13, 6.2],
  [18, 10, 1.8],
  [9, 12, 8.4],
  [20, 14, 4.9],
  [14, 8.5, 10.1],
  [6, 15, 2.7],
  [23, 12.5, 7.3],
];

const box = ref(null);
const stage = ref(null);
const allow = ref(null);
const canvas = ref(null);
const at = ref(0);
const done = ref(false);
const pressing = ref(false);
const linked = ref(false);
const charged = ref(0);
const fading = ref(false);
const mark = ref(null);
const run = ref(0);
const copied = ref(false);
const promptCopied = ref(false);
const snippets = ref([]);
const snipHeight = ref(null);

const fit = async () => {
  await nextTick();
  snipHeight.value = snippets.value[at.value]?.offsetHeight ?? null;
};
watch(at, fit);

const snippet = computed(() =>
  AGENTS[at.value].code.map((line) => line.map(([, text]) => text).join("")).join("\n"),
);

let timer = 0;
let copyTimer = 0;
let promptTimer = 0;
let stop = null;
let seen;
let live = false;
let gen = 0;
let pinned = false;

const wait = (ms) =>
  new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });

const connect = async () => {
  pressing.value = true;
  await wait(140);
  pressing.value = false;
  const cb = stage.value.getBoundingClientRect();
  const bb = allow.value.getBoundingClientRect();
  const press = [bb.left - cb.left + bb.width / 2, bb.top - cb.top + bb.height / 2];
  done.value = true;
  await nextTick();
  stop = playConnect(canvas.value, {
    origin: performance.now(),
    press,
    fadeAt: 9000,
    end: 9600,
    onready: (ms) => {
      charged.value = ms;
      linked.value = true;
    },
    onmark: (m) => {
      mark.value = m;
    },
  });
};

const reset = async (next) => {
  fading.value = true;
  at.value = next;
  done.value = false;
  await wait(440);
  stop?.();
  stop = null;
  mark.value = null;
  linked.value = false;
  run.value++;
  await wait(60);
  fading.value = false;
};

const loop = async (g) => {
  while (live && g === gen) {
    await wait(2400);
    if (g !== gen) return;
    await connect();
    await wait(5400);
    if (g !== gen) return;
    await reset(pinned ? at.value : (at.value + 1) % AGENTS.length);
  }
};

const restart = () => {
  gen++;
  clearTimeout(timer);
  if (live) loop(gen);
};

const pick = async (i) => {
  pinned = true;
  if (i === at.value && !done.value) return;
  gen++;
  clearTimeout(timer);
  pressing.value = false;
  if (done.value || stop) await reset(i);
  else at.value = i;
  restart();
};

const copy = async () => {
  try {
    await navigator.clipboard.writeText(snippet.value);
  } catch {
    return;
  }
  copied.value = true;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 2200);
};

const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(PROMPT);
  } catch {
    return;
  }
  promptCopied.value = true;
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    promptCopied.value = false;
  }, 2200);
};

onMounted(() => {
  fit();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  seen = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !live) {
      live = true;
      restart();
    } else if (!entry.isIntersecting && live) {
      live = false;
      gen++;
      clearTimeout(timer);
      if (done.value) reset(at.value);
    }
  });
  seen.observe(box.value);
});

onBeforeUnmount(() => {
  live = false;
  gen++;
  clearTimeout(timer);
  clearTimeout(copyTimer);
  clearTimeout(promptTimer);
  seen?.disconnect();
  stop?.();
});
</script>

<template>
  <div class="mcp-copy">
    <h2>{{ props.t.mcpTitle }}</h2>
    <p>{{ props.t.mcpBody }}</p>
    <div class="code-win mc-win">
      <div class="code-head">
        <div class="seg" role="tablist" :aria-label="props.t.mcpClientLabel" :style="{ '--n': AGENTS.length, '--i': at }">
          <span class="seg-pill" aria-hidden="true"></span>
          <button v-for="(a, i) in AGENTS" :key="a.name" type="button" role="tab" class="seg-opt mc-tab" :aria-selected="i === at" :aria-label="a.name" @click="pick(i)">
            <span class="mc-tab-icon" aria-hidden="true" v-html="a.icon"></span>
            <span class="mc-tab-name">{{ a.name }}</span>
          </button>
        </div>
        <button type="button" class="code-copy" :class="{ 'is-copied': copied }" @click="copy">
          <span class="cc-icons" aria-hidden="true">
            <svg class="cc-copy" viewBox="0 0 16 16"><rect x="5.25" y="5.25" width="8" height="8" rx="2" /><path d="M10.75 3.5v-.25a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.25" /></svg>
            <svg class="cc-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
          </span>
          <span>{{ copied ? props.t.heroCtaCopied : props.t.startCopy }}</span>
          <span class="sr-only" role="status">{{ copied ? props.t.heroCtaCopied : "" }}</span>
        </button>
      </div>
      <div class="mc-snippets" :style="{ height: snipHeight ? `${snipHeight}px` : undefined }">
        <div v-for="(a, i) in AGENTS" :key="a.name" ref="snippets" class="mc-snippet" :class="{ 'mc-shown': i === at }" :aria-hidden="i !== at">
          <span class="mc-file">{{ a.file ?? "Terminal" }}</span>
          <pre class="code"><code><span v-for="(line, li) in a.code" :key="li" class="mc-code-line"><span v-for="([c, text], ti) in line" :key="ti" :class="c || undefined">{{ text }}</span></span></code></pre>
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-primary mc-prompt" :class="{ 'is-copied': promptCopied }" data-cta="mcp_prompt" data-cta-location="home" @click="copyPrompt">
      <span class="mc-prompt-icons" aria-hidden="true">
        <svg class="mc-pi-copy" viewBox="0 0 16 16"><rect x="5.25" y="5.25" width="8" height="8" rx="2" /><path d="M10.75 3.5v-.25a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.25" /></svg>
        <svg class="mc-pi-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
      </span>
      <span class="mc-prompt-label">
        <span class="mc-pl-idle">{{ props.t.mcpPrompt }}</span>
        <span class="mc-pl-done">{{ props.t.heroCtaCopied }}</span>
      </span>
      <span class="sr-only" role="status">{{ promptCopied ? props.t.heroCtaCopied : "" }}</span>
    </button>
  </div>
  <div ref="box" class="mcp-box" :style="{ '--charged': `${charged}ms` }" role="img" :aria-label="props.t.mcpAlt">
  <svg class="mc-field" viewBox="0 0 1600 960" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <path v-for="(d, i) in fieldLines" :key="i" class="mc-line" :class="{ 'mc-strong': i % 5 === 2 }" :d="d" />
    <g v-for="([line, dur, delay], i) in PACKETS" :key="`p${i}`" :style="{ '--dur': `${dur}s`, '--delay': `-${delay}s` }">
      <path class="mc-trail" :d="fieldLines[line]" pathLength="1" />
      <path class="mc-head" :d="fieldLines[line]" pathLength="1" />
    </g>
  </svg>
  <div ref="stage" class="mcp-stage" :class="{ 'mc-fading': fading }">
    <canvas :key="run" ref="canvas" class="mc-dots"></canvas>
    <div class="mc-consent" :class="{ 'mc-done': done }" aria-hidden="true">
      <div class="mc-tiles">
        <span class="mc-tile from-start" :class="{ 'mc-joined': linked }" :style="{ '--join': `${charged - 100}ms` }">
          <Transition name="swap">
            <span :key="AGENTS[at].name" class="mc-glyph" v-html="AGENTS[at].icon"></span>
          </Transition>
        </span>
        <span class="consent-link" :class="{ 'mc-gone': linked }" :style="{ transitionDelay: linked ? `${charged + 200}ms` : '0ms' }">
          <span class="mc-wire"></span>
          <svg class="mc-link" viewBox="0 0 24 24" width="20" height="20"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span class="mc-wire"></span>
        </span>
        <span class="mc-tile from-end"><img src="/logo.png" alt="" width="38" height="38" /></span>
      </div>

      <div class="mc-head">
        <Transition name="swap-text" mode="out-in">
          <p :key="`${done}${at}`" class="mc-title" :style="{ '--d': done ? `${charged + 760}ms` : '0ms' }">
            {{ done ? `${AGENTS[at].name} is connected` : `Connect ${AGENTS[at].name} to Cap` }}
          </p>
        </Transition>
      </div>

      <div class="mc-acts">
        <div class="mc-acts-inner">
          <template v-if="linked">
          <div v-for="([tool, detail], ai) in AGENTS[at].acts" :key="`${run}${tool}`" class="mc-act" :style="{ '--d': `${charged + 1100 + ai * 520}ms` }">
            <span class="mc-act-state" aria-hidden="true">
              <span class="mc-spin"></span>
              <svg class="mc-act-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
            </span>
            <span class="mc-tool">{{ tool }}</span>
            <span class="mc-act-detail">{{ detail }}</span>
          </div>
          </template>
        </div>
      </div>

      <div class="mc-fold">
        <div class="mc-fold-inner">
          <p class="mc-host">Returns to <b>{{ AGENTS[at].host }}</b></p>
          <div class="mc-panel">
            <div class="mc-row">
              <span class="mc-row-label">Access<small>Can view and change</small></span>
              <span class="mc-seg"><span class="mc-on">Full</span><span>Read only</span></span>
            </div>
            <div class="mc-row">
              <span class="mc-row-label">Site keys</span>
              <span class="mc-seg"><span class="mc-on">All</span><span>Some</span></span>
            </div>
          </div>
          <div class="mc-buttons">
            <span class="mc-btn mc-deny">Deny</span>
            <span ref="allow" class="mc-btn mc-allow" :class="{ 'mc-pressing': pressing }">Allow</span>
          </div>
        </div>
      </div>
    </div>
    <svg v-if="mark" class="mc-tick" :style="{ left: `${mark.x}px`, top: `${mark.y}px`, '--d': `${mark.delay}ms` }" width="30" height="30" viewBox="0 0 30 30" fill="none">
      <path d="M7.5 15.5l5 5L22.5 9.5" pathLength="1" />
    </svg>
  </div>
  </div>
</template>

<style scoped>
.mcp-box {
  position: relative;
  isolation: isolate;
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: 400px;
  padding-inline: 20px;
}

.mc-field {
  position: absolute;
  inset: -72px -40px;
  z-index: -1;
  width: calc(100% + 80px);
  height: calc(100% + 144px);
  pointer-events: none;
  mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, #000 45%, transparent 100%);
}

.mc-line {
  stroke: color-mix(in oklab, var(--text) 11%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.mc-line.mc-strong {
  stroke: color-mix(in oklab, var(--text) 20%, transparent);
}

.mc-trail,
.mc-head {
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  opacity: 0;
}

.mc-trail {
  stroke: color-mix(in oklab, var(--text) 34%, transparent);
  stroke-width: 1;
  stroke-dasharray: 0.12 1.3;
}

.mc-head {
  stroke: color-mix(in oklab, var(--text) 90%, transparent);
  stroke-width: 1.75;
  stroke-dasharray: 0.025 1.4;
}

@media (prefers-reduced-motion: no-preference) {
  .mc-trail,
  .mc-head {
    opacity: 1;
    animation: travel var(--dur) var(--delay) linear infinite;
  }

  .mc-trail {
    --from: 0.12;
    --to: -1;
  }

  .mc-head {
    --from: 0.025;
    --to: -1.095;
  }
}

@keyframes travel {
  from {
    stroke-dashoffset: var(--from);
  }

  to {
    stroke-dashoffset: var(--to);
  }
}

.mcp-stage {
  position: relative;
  display: grid;
  width: 100%;
  max-width: 384px;
  padding: 32px 24px 24px;
  border-radius: 24px;
  background: var(--panel);
  box-shadow:
    inset 0 0 0 1px var(--edge-strong),
    0 1px 2px #0000001f,
    0 8px 24px -8px #00000033;
}

.mc-consent {
  position: relative;
  display: grid;
  width: 100%;
  max-width: 336px;
  color: var(--text);
  font-family: var(--font-sans);
}

.mc-tiles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.mc-tile {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--raised);
  box-shadow: inset 0 0 0 1px #ffffff1a;
}

.mc-glyph {
  grid-area: 1 / 1;
  display: grid;
  place-items: center;
}

.mc-glyph :deep(svg) {
  width: 28px;
  height: 28px;
}

.consent-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-faint);
  transition: opacity 300ms var(--ease-out);
}

.consent-link.mc-gone {
  opacity: 0;
}

.mc-wire {
  width: 16px;
  border-top: 1px dashed currentColor;
}

.mc-link {
  margin: 2px;
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mc-head {
  display: grid;
  margin-top: 24px;
  text-align: center;
}

.mc-title {
  font-size: 1.125rem;
  line-height: 1.75rem;
  font-weight: 600;
  color: var(--text);
  text-wrap: balance;
}

.mc-done .mc-title {
  animation: rise 460ms var(--ease-out) var(--d) backwards;
}

.mc-fold {
  display: grid;
  grid-template-rows: 1fr;
  transition:
    grid-template-rows 420ms var(--ease-out),
    opacity 300ms var(--ease-out);
}

.mc-done .mc-fold {
  grid-template-rows: 0fr;
  opacity: 0;
}

.mc-fold-inner {
  min-height: 0;
  overflow: hidden;
  padding: 4px 4px 16px;
  margin: 0 -4px -16px;
}

.mc-host {
  text-align: center;
  font-size: 0.8125rem;
  line-height: 1.2rem;
  color: var(--text-secondary);
}

.mc-host b {
  font-weight: 500;
  color: var(--text);
}

.mc-panel {
  margin-top: 24px;
  border-radius: 16px;
  background: #ffffff08;
  box-shadow: inset 0 0 0 1px #ffffff0d;
}

.mc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 51px;
  padding: 12px 16px;
}

.mc-row + .mc-row {
  border-top: 1px solid var(--edge);
}

.mc-row-label {
  display: grid;
  gap: 2px;
  font-size: 0.8125rem;
  line-height: 1.125rem;
  font-weight: 500;
}

.mc-row-label small {
  font-size: 0.75rem;
  line-height: 1rem;
  font-weight: 400;
  color: var(--text-secondary);
}

.mc-seg {
  display: flex;
  padding: 2px;
  border-radius: 10px;
  background: #ffffff0f;
  font-size: 0.8125rem;
  line-height: 1.125rem;
  color: var(--text-secondary);
}

.mc-seg span {
  padding: 2px 10px;
  border-radius: 8px;
  white-space: nowrap;
}

.mc-seg .mc-on {
  background: color-mix(in oklch, var(--raised), var(--text) 16%);
  box-shadow: inset 0 0 0 1px #ffffff12;
  color: var(--text);
}

.mc-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 24px;
}

.mc-btn {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  height: 36px;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: scale 160ms var(--ease-out);
}

.mc-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
}

.mc-deny {
  color: var(--text);
}

.mc-deny::before {
  background: #ffffff0d;
  box-shadow:
    inset 0 1px 0 #ffffff0f,
    inset 0 8px 24px -4px #ffffff0a,
    inset 0 -4px 12px -4px #ffffff0a,
    inset 0 0 0 1px #ffffff14;
}

.mc-allow {
  color: var(--accent-ink);
}

.mc-allow::before {
  background: var(--text);
  box-shadow:
    inset 0 1px 0 #fffffff2,
    inset 0 1px 2px -0.5px #fffc,
    inset 0 12px 16px -10px #ffffffb3,
    inset 0 -12px 16px -10px #0000003d,
    inset 0 -1px 2px -1px #00000024,
    0 0 0 1px #0006,
    0 0.5px 0.5px #00000029,
    0 2px 2px -1px #0000001f,
    0 3px 3px -1.5px #0000001a,
    0 5px 5px -2.5px #00000014,
    0 8px 8px -3px #0000000f,
    0 12px 12px -6px #0000000d;
}

.mc-btn.mc-pressing {
  scale: 0.97;
}

.mc-dots {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
  color: var(--success);
  --splash-ink: var(--text);
  transition: opacity 400ms var(--ease-out);
}

.mc-tick {
  position: absolute;
  translate: -50% -50%;
  color: var(--success);
  pointer-events: none;
  animation: tick-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--d) backwards;
  transition: opacity 400ms var(--ease-out);
}

.mc-tick path {
  stroke: currentColor;
  stroke-width: 2.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  animation: tick-draw 380ms cubic-bezier(0.65, 0, 0.35, 1) var(--d) backwards;
}

.mc-fading .mc-dots,
.mc-fading .mc-tick {
  opacity: 0;
}

.mc-tile.mc-joined {
  animation: join 1100ms var(--ease-out) var(--join, 0ms);
}

.from-start {
  --pull: -10px;
}

.from-end {
  --pull: 10px;
}

.swap-enter-active,
.swap-leave-active {
  transition:
    opacity 260ms var(--ease-out),
    scale 260ms var(--ease-out),
    filter 260ms var(--ease-out);
}

.swap-enter-from,
.swap-leave-to {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}

.swap-text-enter-active,
.swap-text-leave-active {
  transition:
    opacity 220ms var(--ease-out),
    filter 220ms var(--ease-out),
    translate 220ms var(--ease-out);
}

.swap-text-enter-from {
  opacity: 0;
  filter: blur(4px);
  translate: 0 4px;
}

.swap-text-leave-to {
  opacity: 0;
  filter: blur(4px);
  translate: 0 -2px;
}

@keyframes join {
  30% {
    translate: var(--pull) 0;
  }

  62% {
    translate: calc(var(--pull) * -0.35) 0;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    filter: blur(4px);
    translate: 0 4px;
  }
}

@keyframes tick-pop {
  from {
    scale: 0.6;
    filter: blur(2px);
  }
}

@keyframes tick-draw {
  from {
    stroke-dashoffset: 1;
  }
}

.mc-acts {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 420ms var(--ease-out),
    opacity 300ms var(--ease-out);
}

.mc-done .mc-acts {
  grid-template-rows: 1fr;
  opacity: 1;
  transition-delay: calc(var(--charged) + 900ms);
}

.mc-acts-inner {
  display: grid;
  gap: 2px;
  min-height: 0;
  overflow: hidden;
}

.mc-act {
  display: grid;
  grid-template-columns: 16px auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  height: 36px;
  padding-inline: 12px;
  border-radius: 10px;
  background: #ffffff06;
  font-size: 0.8125rem;
  animation: rise 420ms var(--ease-out) var(--d) backwards;
}

.mc-act:first-child {
  margin-top: 20px;
}

.mc-tool {
  font: 0.75rem/1 var(--font-code);
  color: var(--text);
}

.mc-act-detail {
  overflow: hidden;
  text-align: end;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.mc-act-state {
  display: grid;
  width: 16px;
  height: 16px;
}

.mc-spin,
.mc-act-check {
  grid-area: 1 / 1;
}

.mc-spin {
  margin: 1.5px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 15%, var(--text-secondary));
  mask: radial-gradient(farthest-side, transparent calc(100% - 1.75px), #000 calc(100% - 1.5px));
  animation:
    spin 700ms linear infinite,
    out 220ms var(--ease-out) calc(var(--d) + 520ms) forwards;
}

.mc-act-check {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--success);
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: check-in 320ms var(--ease-out) calc(var(--d) + 560ms) backwards;
}

@keyframes check-in {
  from {
    opacity: 0;
    scale: 0.25;
    filter: blur(4px);
  }
}

@keyframes spin {
  to {
    rotate: 1turn;
  }
}

@keyframes out {
  to {
    opacity: 0;
    scale: 0.25;
    filter: blur(4px);
  }
}

.mcp-copy .mc-win {
  width: 100%;
}

.mc-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
}

.mc-tab-icon {
  display: grid;
  opacity: 0.55;
  filter: grayscale(1);
  transition:
    opacity 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}

.mc-tab[aria-selected="true"] .mc-tab-icon {
  opacity: 1;
  filter: none;
}

.mc-tab-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.mc-snippets {
  display: grid;
  align-items: start;
  overflow: hidden;
  transition: height 320ms var(--ease-out);
}

.mc-snippet {
  grid-area: 1 / 1;
  min-width: 0;
  opacity: 0;
  visibility: hidden;
  filter: blur(4px);
  transition:
    opacity 220ms var(--ease-out),
    filter 220ms var(--ease-out),
    visibility 0s 220ms;
}

.mc-snippet.mc-shown {
  opacity: 1;
  visibility: visible;
  filter: none;
  transition:
    opacity 220ms var(--ease-out),
    filter 220ms var(--ease-out);
}

.mc-file {
  display: block;
  padding: 14px 22px 0;
  font-size: 0.75rem;
  color: var(--text-faint);
}

.mc-snippet .code {
  padding-top: 6px;
}

.mc-code-line {
  display: block;
}

@media (max-width: 640px) {
  .mcp-box {
    min-height: 380px;
    padding-inline: 4px;
  }

  .mc-tab-name {
    display: none;
  }

  .mcp-stage {
    padding: 28px 18px 18px;
  }
}
</style>

<style>
#homev2 .mc-win .code-head {
  gap: 8px;
  height: 44px;
  padding-inline: 5px;
}

#homev2 .mc-win .seg {
  flex: 0 1 auto;
  min-width: 0;
  border-radius: 9px;
}

#homev2 .mc-win .seg-pill {
  border-radius: 7px;
}

#homev2 .mc-win .seg-opt {
  border-radius: 7px;
  padding-inline: 9px 11px;
}

#homev2 .mc-win .code-copy {
  border-radius: 9px;
}

#homev2 .mc-prompt {
  gap: 9px;
  padding-inline: 14px 16px;
}

#homev2 .mc-prompt-icons {
  display: grid;
}

#homev2 .mc-prompt-icons svg {
  grid-area: 1 / 1;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    opacity 200ms var(--ease-out),
    scale 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}

#homev2 .mc-prompt-label {
  display: grid;
  justify-items: start;
}

#homev2 .mc-prompt-label > span {
  grid-area: 1 / 1;
  transition:
    opacity 200ms var(--ease-out),
    scale 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}

#homev2 .mc-pi-check,
#homev2 .mc-prompt.is-copied .mc-pi-copy,
#homev2 .mc-pl-done,
#homev2 .mc-prompt.is-copied .mc-pl-idle {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}

#homev2 .mc-pl-done,
#homev2 .mc-prompt.is-copied .mc-pl-idle {
  scale: 0.9;
}

#homev2 .mc-prompt.is-copied .mc-pi-check,
#homev2 .mc-prompt.is-copied .mc-pl-done {
  opacity: 1;
  scale: 1;
  filter: none;
}

@media (max-width: 640px) {
  #homev2 .mc-win .seg-opt {
    padding-inline: 14px;
  }
}
</style>
