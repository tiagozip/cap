<script setup>
import { onKeyStroke } from "@vueuse/core";
import { getScrollOffset, onContentUpdated, useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  headers: { type: Array, default: () => [] },
  navHeight: { type: Number, default: 0 },
});

const { theme, page, localeIndex } = useData();
const open = ref(false);
const active = ref(null);
const progress = ref(0);
const root = ref(null);
const scrolled = ref(false);
const copied = ref("");

const mdUrl = computed(() => {
  if (localeIndex.value !== "root") return null;
  const path = page.value.relativePath;
  if (import.meta.env.DEV) return `/${path}`;
  return `/${path.replace(/\/index\.md$/, ".md")}`;
});

let copyTimer = 0;
const copyMarkdown = async () => {
  clearTimeout(copyTimer);
  try {
    const res = await fetch(mdUrl.value);
    if (!res.ok) throw new Error(res.status);
    const text = (await res.text()).replace(/^---\n[\s\S]*?\n---\n+/, "");
    await navigator.clipboard.writeText(text);
    copied.value = "ok";
  } catch {
    copied.value = "fail";
  }
  copyTimer = setTimeout(() => (copied.value = ""), 1600);
};

const flat = computed(() => {
  const out = [];
  const walk = (items, depth) => {
    for (const item of items) {
      out.push({ title: item.title, link: item.link, depth });
      if (item.children?.length) walk(item.children, depth + 1);
    }
  };
  walk(props.headers, 0);
  return out;
});

const fallback = computed(() => {
  const o = theme.value.outline;
  return (typeof o === "object" && !Array.isArray(o) && o.label) || theme.value.outlineTitle || "On this page";
});

const label = computed(() => flat.value.find((h) => h.link === active.value)?.title ?? fallback.value);

const RING = 2 * Math.PI * 6;

let frame = 0;
const measure = () => {
  frame = 0;
  scrolled.value = window.scrollY > 160;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  if (window.scrollY < 1) {
    active.value = null;
    return;
  }
  if (max > 0 && window.scrollY >= max - 1) {
    active.value = flat.value.at(-1)?.link ?? null;
    return;
  }
  const line = getScrollOffset() + 4;
  let current = null;
  for (const h of flat.value) {
    const el = document.getElementById(decodeURIComponent(h.link.slice(1)));
    if (!el) continue;
    if (el.getBoundingClientRect().top > line) break;
    current = h.link;
  }
  active.value = current;
};
const schedule = () => {
  if (!frame) frame = requestAnimationFrame(measure);
};

const onOutside = (e) => {
  if (!root.value?.contains(e.target)) open.value = false;
};

watch(open, (value) => {
  if (value) document.addEventListener("pointerdown", onOutside);
  else document.removeEventListener("pointerdown", onOutside);
});

watch(flat, schedule);

onKeyStroke("Escape", () => {
  open.value = false;
});

onContentUpdated(() => {
  open.value = false;
  schedule();
});

onMounted(() => {
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  schedule();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  clearTimeout(copyTimer);
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  document.removeEventListener("pointerdown", onOutside);
});

const scrollToTop = () => {
  open.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};
</script>

<template>
  <div ref="root" class="VPLocalNavOutlineDropdown toc">
    <template v-if="flat.length">
      <button
        type="button"
        class="toc-trigger"
        :aria-expanded="open"
        aria-controls="toc-panel"
        @click="open = !open"
      >
        <svg class="toc-ring" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" />
          <circle
            class="toc-ring-fill"
            cx="8"
            cy="8"
            r="6"
            :stroke-dasharray="RING"
            :stroke-dashoffset="RING * (1 - progress)"
          />
        </svg>
        <span class="toc-label">{{ label }}</span>
        <svg class="toc-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <Transition name="toc">
        <nav v-if="open" id="toc-panel" class="toc-panel" :aria-label="fallback">
          <a
            v-for="h in flat"
            :key="h.link"
            :href="h.link"
            class="toc-link"
            :class="{ 'is-active': h.link === active }"
            :style="{ '--depth': h.depth }"
            :aria-current="h.link === active ? 'location' : undefined"
            @click="open = false"
            >{{ h.title }}</a
          >
        </nav>
      </Transition>
    </template>
    <button v-else type="button" class="toc-trigger" @click="scrollToTop">
      {{ theme.returnToTopLabel || "Return to top" }}
    </button>
    <button
      v-if="mdUrl"
      type="button"
      class="toc-copy"
      :class="{ 'is-hidden': scrolled && !copied }"
      :tabindex="scrolled && !copied ? -1 : undefined"
      @click="copyMarkdown"
    >
      <span class="toc-copy-icon" :data-state="copied || 'idle'" aria-hidden="true">
        <svg class="i-copy" viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="8" rx="2" /><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" /></svg>
        <svg class="i-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>
      </span>
      <span role="status">{{ copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy markdown" }}</span>
    </button>
  </div>
</template>

<style scoped>
.toc {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 20px;
}

.toc-copy {
  display: none;
  align-items: center;
  gap: 7px;
  height: 32px;
  margin-left: auto;
  padding: 0 10px 0 8px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  transition:
    color 120ms,
    background-color 120ms,
    opacity 200ms var(--ease-out),
    scale 200ms ease-out;
}

.toc-copy:active {
  scale: 0.97;
}

.toc-copy.is-hidden {
  opacity: 0;
  pointer-events: none;
}

@media (hover: hover) {
  .toc-copy:hover {
    color: var(--text);
    background: #ffffff0d;
  }
}

.toc-copy-icon {
  position: relative;
  width: 14px;
  height: 14px;
}

.toc-copy-icon svg {
  position: absolute;
  inset: 0;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    opacity 160ms,
    scale 160ms var(--ease-out),
    filter 160ms;
}

.toc-copy-icon .i-check,
.toc-copy-icon[data-state="ok"] .i-copy {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}

.toc-copy-icon[data-state="ok"] .i-check {
  opacity: 1;
  scale: 1;
  filter: none;
}

.toc-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(320px, 60vw);
  height: 32px;
  padding: 0 8px 0 10px;
  border-radius: 10px;
  background: transparent;
  font-size: 14px;
  color: var(--text);
  transition:
    background-color 120ms,
    scale 200ms ease-out;
}

.toc-trigger:active {
  scale: 0.97;
}

.toc-trigger[aria-expanded="true"] {
  background: #ffffff0d;
}

@media (hover: hover) {
  .toc-trigger:hover {
    background: #ffffff0d;
  }
}

.toc-ring {
  flex: none;
  width: 16px;
  height: 16px;
  rotate: -90deg;
  fill: none;
  stroke-width: 2;
}

.toc-ring circle {
  stroke: #ffffff14;
}

.toc-ring .toc-ring-fill {
  stroke: var(--accent);
  stroke-linecap: round;
  transition: stroke-dashoffset 150ms linear;
}

.toc-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toc-chevron {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--text-faint);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: rotate 200ms var(--ease-out);
}

.toc-trigger[aria-expanded="true"] .toc-chevron {
  rotate: 180deg;
}

.toc-panel {
  position: absolute;
  top: calc(100% - 6px);
  left: 20px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 200px;
  max-width: min(320px, calc(100vw - 40px));
  max-height: min(60vh, calc(100dvh - var(--vp-nav-height) - 96px));
  overflow-y: auto;
  padding: 4px;
  border-radius: 12px;
  background: var(--panel);
  box-shadow:
    0 0 0 1px var(--edge),
    0 4px 8px #00000024,
    0 16px 32px #00000040;
  transform-origin: 16px 0;
}

.toc-link {
  display: block;
  padding: 5px 12px 5px calc(12px + var(--depth) * 12px);
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  color: var(--text-secondary);
  transition:
    color 120ms,
    background-color 120ms;
}

.toc-link.is-active {
  color: var(--accent);
  background: #89b4fa14;
}

@media (hover: hover) {
  .toc-link:not(.is-active):hover {
    color: var(--text);
    background: #ffffff0a;
  }
}

.toc-enter-active {
  transition:
    opacity 140ms var(--ease-out),
    transform 140ms var(--ease-out);
}

.toc-leave-active {
  transition:
    opacity 120ms ease-in,
    transform 120ms ease-in,
    filter 120ms ease-in;
}

.toc-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.toc-leave-to {
  opacity: 0;
  transform: translateY(-2px);
  filter: blur(4px);
}

@media (min-width: 960px) {
  .toc {
    padding: 10px 0;
  }

  .toc-trigger {
    margin-left: -10px;
  }

  .toc {
    flex: 1;
  }

  .toc-copy {
    display: inline-flex;
    margin-right: -10px;
  }

  .toc-panel {
    left: -10px;
  }
}

@media (max-width: 959px) {
  .toc-panel {
    left: auto;
    right: 20px;
    transform-origin: calc(100% - 16px) 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toc-enter-active,
  .toc-leave-active,
  .toc-ring .toc-ring-fill,
  .toc-chevron,
  .toc-copy,
  .toc-copy-icon svg {
    transition: none;
  }
}
</style>
