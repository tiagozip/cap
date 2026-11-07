<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import ToolboxApi from "./ToolboxApi.vue";
import ToolboxModes from "./ToolboxModes.vue";
import ToolboxPow from "./ToolboxPow.vue";
import ToolboxPrivacy from "./ToolboxPrivacy.vue";
import ToolboxRate from "./ToolboxRate.vue";
import ToolboxSize from "./ToolboxSize.vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const cleanups = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
});

onBeforeUnmount(() => {
  for (const fn of cleanups) fn();
});
</script>

<template>
  <div class="grid">
    <ToolboxModes :t="t" :lp="lp" />
    <ToolboxPow :t="t" :lp="lp" />
    <ToolboxRate :t="t" :lp="lp" />
    <ToolboxPrivacy :t="t" :lp="lp" />
    <ToolboxSize :t="t" :lp="lp" />
    <ToolboxApi :t="t" :lp="lp" />
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
  grid-template-rows: repeat(3, 340px);
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
  background: #1a1a29;
  box-shadow:
    inset 0 1px 0 #ffffff0a,
    inset 0 0 0 1px #ffffff09;
  overflow: hidden;
}
#homev2 .tb-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 28px 28px;
}
#homev2 .cell h3 {
  font-size: 1.125rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
#homev2 .cell p {
  font-size: 0.875rem;
  line-height: 1.55;
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
  min-height: 200px;
  overflow: hidden;
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
#homev2 .tb-art code {
  font: 0.75rem/1.75 var(--font-code);
  white-space: pre;
  color: var(--text-faint);
  background: none;
  padding: 0;
}

#homev2 .tb-plate {
  --c: 18px;
  position: absolute;
  pointer-events: none;
}
#homev2 .tb-plate::before,
#homev2 .tb-plate::after {
  content: "";
  position: absolute;
  clip-path: polygon(var(--c) 0, calc(100% - var(--c)) 0, 100% var(--c), 100% 100%, 0 100%, 0 var(--c));
}
#homev2 .tb-plate::before {
  inset: 0;
  background: linear-gradient(#ffffff17, #ffffff0b);
}
#homev2 .tb-plate::after {
  inset: 1px 1px 0;
  background: linear-gradient(#242437, #1f1f30);
}
#homev2 .tb-shelf {
  position: absolute;
  inset: auto 0 0;
  background: linear-gradient(#1f1f30, #1a1a29 85%);
  box-shadow: inset 0 1px 0 #ffffff0b;
  z-index: 0;
  pointer-events: none;
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

@media (max-width: 960px) {
  #homev2 .grid {
    grid-template-rows: none;
    grid-auto-rows: minmax(340px, auto);
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
}
</style>
