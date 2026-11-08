<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createTorch } from "../torch.js";

defineProps({ t: { type: Object, required: true } });

const torchLines = [
  { text: "agent via Playwright · webdriver_true · blocked", kind: 1 },
  { text: "Firefox 147 on Linux · 1.9 s · passed", kind: 2 },
  { text: "puppeteer-extra-stealth · webdriver_stripped · blocked", kind: 1 },
  { text: "python-requests · no token · rejected", kind: 1 },
  { text: "Safari on iPhone · 2.4 s · passed", kind: 2 },
  { text: "Camoufox · geometry_quantized · blocked", kind: 1 },
  { text: "chrome-headless-shell · chrome_object_missing · blocked", kind: 1 },
  { text: "Canvas Blocker extension · native_tamper · harder puzzle", kind: 3 },
  { text: "HeadlessChrome/142 · headless_token · blocked", kind: 1 },
  { text: "Brave on Windows · 2.1 s · passed", kind: 2 },
  { text: "Selenium + Firefox · webdriver_true · blocked", kind: 1 },
  { text: "curl/8.11 · no token · rejected", kind: 1 },
  { text: "Playwright Firefox · juggler_package · blocked", kind: 1 },
  { text: "Chrome on Android · 3.2 s · passed", kind: 2 },
  { text: "spoofed UA, real one in worker · worker_mismatch · blocked", kind: 1 },
  { text: "LibreWolf · 2.0 s · passed", kind: 2 },
  { text: "CDP viewport override · window_exceeds_screen · blocked", kind: 1 },
  { text: "ungoogled-chromium · 1.8 s · passed", kind: 2 },
  { text: "Firefox via Marionette · webdriver_true · blocked", kind: 1 },
  { text: "Firefox faking Chrome APIs · gecko_contradiction · blocked", kind: 1 },
  { text: "Vivaldi on macOS · 1.7 s · passed", kind: 2 },
  { text: "Go-http-client · no token · rejected", kind: 1 },
  { text: "Firefox on Android · 3.0 s · passed", kind: 2 },
  { text: "GPTBot · no token · rejected", kind: 1 },
  { text: "Opera on Windows · 2.2 s · passed", kind: 2 },
  { text: "node-fetch · no token · rejected", kind: 1 },
  { text: "CDP device emulation · viewport_override · blocked", kind: 1 },
  { text: "Samsung Internet · 2.8 s · passed", kind: 2 },
  { text: "curl · rejected", kind: 1 },
  { text: "Firefox · passed", kind: 2 },
  { text: "Scrapy · rejected", kind: 1 },
  { text: "Safari · passed", kind: 2 },
  { text: "Selenium · blocked", kind: 1 },
  { text: "wget · rejected", kind: 1 },
  { text: "Edge · passed", kind: 2 },
  { text: "Puppeteer · blocked", kind: 1 },
  { text: "httpx · rejected", kind: 1 },
  { text: "Vivaldi · passed", kind: 2 },
  { text: "aiohttp · rejected", kind: 1 },
  { text: "Opera · passed", kind: 2 },
  { text: "Deno fetch · rejected", kind: 1 },
  { text: "Brave · passed", kind: 2 },
  { text: "lynx · rejected", kind: 1 },
  { text: "Chromium · passed", kind: 2 },
  { text: "Go-colly · rejected", kind: 1 },
  { text: "Arc · passed", kind: 2 },
  { text: "Nightmare · blocked", kind: 1 },
  { text: "Zen · passed", kind: 2 },
];

const tab = ref("you");
const fieldEl = ref(null);
const canvasEl = ref(null);
const copyEl = ref(null);
const cardEl = ref(null);
const tabEls = ref([]);
const botRan = ref(false);
const cleanups = [];
let torch = null;

const widget = (pane) => cardEl.value?.querySelector(`#demo-pane-${pane} cap-widget`);

const runBot = () => {
  const el = widget("bot");
  if (!el?.solve) return;
  botRan.value = true;
  el.reset?.();
  el.solve().catch(() => {});
};

const selectTab = (name, focus) => {
  if (tab.value === name) return;
  tab.value = name;
  if (focus) tabEls.value[name === "you" ? 0 : 1]?.focus();
  if (name === "bot" && !botRan.value) runBot();
};

const onTabKey = (e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  const next = e.key === "Home" ? "you" : e.key === "End" ? "bot" : tab.value === "you" ? "bot" : "you";
  selectTab(next, true);
};

const resetDemo = () => {
  widget("you")?.reset?.();
  torch?.forget();
  if (tab.value === "bot") return runBot();
  widget("bot")?.reset?.();
  botRan.value = false;
};

onMounted(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.fonts
    .load('13px "Departure Mono"')
    .catch(() => {})
    .then(() => {
      if (!fieldEl.value || !canvasEl.value) return;
      torch = createTorch({
        field: fieldEl.value,
        canvas: canvasEl.value,
        lamp: () => widget(tab.value) ?? cardEl.value,
        avoid: () => [...(copyEl.value?.querySelectorAll("h1 > span, .lead, .actions > a") ?? []), cardEl.value?.querySelector(".demo-try"), cardEl.value],
        lines: torchLines,
        reduced,
      });
      if (torch) fieldEl.value.classList.add("is-lit");
    });
  cleanups.push(() => torch?.destroy());

  const blocker = (async () => {
    const script = 'parent.postMessage({ type: "cap:instr", blocked: true, blockReason: "automated_browser" }, "*")';
    const stream = new Blob([script]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return btoa(String.fromCharCode(...bytes));
  })();

  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");

  const wrapFetch = () => {
    const prev = window.CAP_CUSTOM_FETCH;
    if (prev?.homeDemo) return;
    const wrapped = async (url, options) => {
      if (url === "/api-bot/challenge") {
        return json({
          challenge: Array.from({ length: 50 }, () => [hex(16), hex(2)]),
          token: "",
          expires: Date.now() + 600000,
          instrumentation: await blocker,
        });
      }
      if (url === "/api-bot/redeem") return json({ success: false, reason: "instr_automated_browser" });
      return (prev ?? window.fetch)(url, options);
    };
    wrapped.homeDemo = true;
    window.CAP_CUSTOM_FETCH = wrapped;
    cleanups.push(() => {
      if (window.CAP_CUSTOM_FETCH === wrapped) window.CAP_CUSTOM_FETCH = prev;
    });
  };
  queueMicrotask(wrapFetch);

  const card = cardEl.value;
  if (!card) return;
  let startedAt = 0;
  const isBot = (e) => !!e.target?.closest?.("#demo-pane-bot");
  let spinning = false;
  const onProgress = () => {
    if (spinning) return;
    spinning = true;
    wrapFetch();
    startedAt ||= performance.now();
    torch?.busy(true);
  };
  const onSolve = (e) => {
    const elapsed = startedAt ? (performance.now() - startedAt) / 1000 : 0;
    startedAt = 0;
    spinning = false;
    torch?.busy(false);
    if (isBot(e)) return;
    const ua = navigator.userAgent;
    const browser = /Firefox\//.test(ua)
      ? "Firefox"
      : /Edg\//.test(ua)
        ? "Edge"
        : /OPR\//.test(ua)
          ? "Opera"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "your browser";
    torch?.reveal(`you · ${browser} · ${elapsed < 0.1 ? "cached" : `${elapsed.toFixed(1)} s`} · passed`, 4);
  };
  const onError = (e) => {
    startedAt = 0;
    spinning = false;
    torch?.busy(false);
    if (isBot(e)) torch?.reveal("Playwright · webdriver_true · blocked", 1);
  };
  const onPress = (e) => {
    if (!startedAt && !isBot(e) && e.target?.closest?.("cap-widget")) startedAt = performance.now();
  };
  card.addEventListener("pointerdown", onPress);
  card.addEventListener("progress", onProgress);
  card.addEventListener("solve", onSolve);
  card.addEventListener("error", onError);
  cleanups.push(() => {
    card.removeEventListener("pointerdown", onPress);
    card.removeEventListener("progress", onProgress);
    card.removeEventListener("solve", onSolve);
    card.removeEventListener("error", onError);
  });
});

onBeforeUnmount(() => {
  while (cleanups.length) {
    try {
      cleanups.pop()();
    } catch {}
  }
});
</script>

<template>
  <div ref="fieldEl" class="field">
    <canvas ref="canvasEl" class="field-canvas" aria-hidden="true"></canvas>
    <div ref="copyEl" class="field-copy">
      <slot />
    </div>
    <div ref="cardEl" class="demo" data-torch-ignore :data-tab="tab">
      <div class="demo-panes">
        <div class="demo-try" aria-hidden="true">
          <span>{{ tab === "bot" ? t.demoTryBot : t.demoTry }}</span>
          <svg viewBox="0 0 72 46" width="72" height="46" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 4c2 18 12 32 30 34 8 1 16 0 24-3" />
            <path d="M56 29l9 5-8 6" />
          </svg>
        </div>
        <section
          id="demo-pane-you"
          class="demo-pane"
          role="tabpanel"
          aria-labelledby="hero-tab-you"
          :inert="tab !== 'you'"
          :data-active="tab === 'you'"
        >
          <ClientOnly>
            <cap-widget class="demo-widget" data-cap-api-endpoint="/api/"></cap-widget>
            <template #fallback>
              <div class="demo-widget demo-widget-fallback"></div>
            </template>
          </ClientOnly>
        </section>
        <section
          id="demo-pane-bot"
          class="demo-pane"
          role="tabpanel"
          aria-labelledby="hero-tab-bot"
          :inert="tab !== 'bot'"
          :data-active="tab === 'bot'"
        >
          <ClientOnly>
            <cap-widget class="demo-widget" data-cap-api-endpoint="/api-bot/" :data-cap-i18n-error-label="t.demoBotError"></cap-widget>
            <template #fallback>
              <div class="demo-widget demo-widget-fallback"></div>
            </template>
          </ClientOnly>
        </section>
      </div>
      <div class="demo-bar">
        <div class="hero-tabs" role="tablist" :aria-label="t.demoLabel" :data-tab="tab" @keydown="onTabKey">
          <span class="hero-tab-thumb" aria-hidden="true"></span>
          <button
            :ref="(el) => (tabEls[0] = el)"
            type="button"
            role="tab"
            class="hero-tab"
            id="hero-tab-you"
            aria-controls="demo-pane-you"
            :aria-selected="tab === 'you'"
            :tabindex="tab === 'you' ? 0 : -1"
            @click="selectTab('you')"
          >
            {{ t.demoTabYou }}
          </button>
          <button
            :ref="(el) => (tabEls[1] = el)"
            type="button"
            role="tab"
            class="hero-tab"
            id="hero-tab-bot"
            aria-controls="demo-pane-bot"
            :aria-selected="tab === 'bot'"
            :tabindex="tab === 'bot' ? 0 : -1"
            @click="selectTab('bot')"
          >
            {{ t.demoTabBot }}
          </button>
        </div>
        <button type="button" class="icon-btn" :aria-label="t.demoReset" @click="resetDemo">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.35-5.65" />
            <path d="M4 4v4.5h4.5" />
          </svg>
        </button>
      </div>
    </div>
    <ul class="sr-only" :aria-label="t.torchListLabel">
      <li v-for="line in torchLines" :key="line.text">{{ line.text }}</li>
    </ul>
  </div>
</template>

<style>
#homev2 .field {
  position: relative;
  display: grid;
  justify-items: center;
  gap: clamp(44px, 6vh, 64px);
  margin-inline: calc(var(--frame-pad) * -1);
  padding: clamp(72px, 10vh, 112px) var(--frame-pad) clamp(88px, 12vh, 128px);
  touch-action: pan-y;
  --torch-bg: var(--ground);
  --torch-dim: #45475a;
  --torch-lit: #cdd6f4;
  --torch-wash: var(--accent);
  --torch-blocked: var(--danger);
  --torch-passed: var(--accent);
  --torch-flagged: var(--caution);
  --torch-you: var(--success);
}
#homev2 .field-canvas {
  position: absolute;
  inset: 0;
  display: block;
  opacity: 0;
  pointer-events: none;
}
#homev2 .field.is-lit .field-canvas {
  opacity: 1;
  transition: opacity 1800ms ease 200ms;
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .hero .demo {
    animation: hero-card 1200ms var(--ease-out) 780ms both;
  }
}
@keyframes hero-card {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.96);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
#homev2 .field-copy,
#homev2 .demo {
  position: relative;
}
#homev2 .demo {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 16px;
}
#homev2 .demo-try {
  position: absolute;
  bottom: 26px;
  right: calc(100% + 10px);
  display: grid;
  justify-items: start;
  gap: 2px;
  color: var(--text-secondary);
  pointer-events: none;
}
#homev2 .demo-try span {
  font-family: var(--font-serif);
  font-size: 1.1875rem;
  white-space: nowrap;
  rotate: -5deg;
  translate: -18px 0;
}
#homev2 .demo-try svg {
  justify-self: end;
}
@media (max-width: 760px) {
  #homev2 .demo-try {
    display: none;
  }
}
@media (max-width: 639px) {
  #homev2 .field {
    padding-bottom: 200px;
  }
}
#homev2 .demo-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
#homev2 .demo-bar .icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--text-faint);
}
#homev2 .demo-bar .icon-btn svg {
  width: 13px;
  height: 13px;
}
#homev2 .hero-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-radius: 999px;
}
#homev2 .hero-tab-thumb {
  grid-area: 1 / 1;
  border-radius: 999px;
  background: #ffffff0f;
  transition: transform 260ms var(--ease-out);
}
#homev2 #hero-tab-you {
  grid-column: 1;
}
#homev2 #hero-tab-bot {
  grid-column: 2;
}
#homev2 .hero-tabs[data-tab="bot"] .hero-tab-thumb {
  transform: translateX(100%);
}
#homev2 .hero-tab {
  position: relative;
  grid-row: 1;
  height: 28px;
  padding-inline: 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-faint);
  font: inherit;
  font-size: 0.8125rem;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 160ms ease,
    scale 160ms var(--ease-out);
}
#homev2 .hero-tab[aria-selected="true"] {
  color: var(--text);
}
#homev2 .hero-tab:active {
  scale: 0.97;
}
@media (hover: hover) {
  #homev2 .hero-tab:hover {
    color: var(--text);
  }
}
#homev2 .hero-tab:focus-visible,
#homev2 .icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
#homev2 .icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    scale 160ms var(--ease-out);
}
#homev2 .icon-btn:active:not(:disabled) {
  scale: 0.95;
}
#homev2 .icon-btn:disabled {
  color: var(--text-faint);
  cursor: default;
}
@media (hover: hover) {
  #homev2 .icon-btn:hover:not(:disabled) {
    background: #ffffff0d;
    color: var(--text);
  }
}
#homev2 .demo-panes {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
  min-height: 114px;
}
#homev2 .demo-pane {
  grid-area: 1 / 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    opacity 240ms var(--ease-out) 90ms,
    transform 240ms var(--ease-out) 90ms,
    filter 240ms var(--ease-out) 90ms,
    visibility 0s linear 0s;
}
#homev2 .demo-pane[data-active="false"] {
  opacity: 0;
  transform: translateY(-3px);
  filter: blur(3px);
  visibility: hidden;
  transition:
    opacity 100ms ease,
    transform 100ms ease,
    filter 100ms ease,
    visibility 0s linear 100ms;
}
#homev2 .demo-widget {
  display: block;
  width: 260px;
  min-height: 58px;
  zoom: 1.25;
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
#homev2 .demo-widget-fallback {
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge-strong);
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .demo-pane,
  #homev2 .demo-pane[data-active="false"] {
    transform: none;
  }
  #homev2 .hero-tab-thumb {
    transition: none;
  }
}
</style>
