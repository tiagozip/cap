<script setup>
import { demoMode } from "./demoMode";

const setTab = (tab) => {
  if (demoMode.value === tab) return;
  demoMode.value = tab;
  try {
    plausible("demo-tab", { props: { tab } });
  } catch {}
};
</script>

<template>
  <ClientOnly>
    <div class="demo-tabs-wrap">
      <div class="demo-tabs" :data-active="demoMode" role="tablist">
        <div class="demo-tabs-indicator" aria-hidden="true"></div>
        <button
          type="button"
          class="demo-tab"
          role="tab"
          :aria-selected="demoMode === 'widget'"
          :class="{ active: demoMode === 'widget' }"
          @click="setTab('widget')"
        >
          Widget
        </button>
        <button
          type="button"
          class="demo-tab"
          role="tab"
          :aria-selected="demoMode === 'floating'"
          :class="{ active: demoMode === 'floating' }"
          @click="setTab('floating')"
        >
          Floating
        </button>
      </div>
    </div>
  </ClientOnly>
</template>

<style>
.demo-tabs-wrap {
  margin-top: 1.2em;
  margin-bottom: 4px;
  width: 300px;
  max-width: 100%;
}

.demo-tabs {
  display: flex;
  gap: 3px;
  background: var(--vp-c-bg-soft);
  padding: 4px;
  border-radius: 10px;
  position: relative;
}

.demo-tabs-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 11px) / 2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  transition:
    transform 280ms cubic-bezier(0.2, 0.9, 0.3, 1.05),
    width 280ms cubic-bezier(0.2, 0.9, 0.3, 1.05);
  z-index: 0;
  pointer-events: none;
  box-sizing: border-box;
}

.demo-tabs[data-active="floating"] .demo-tabs-indicator {
  transform: translateX(calc(100% + 3px));
}

.demo-tab {
  flex: 1;
  padding: 7px 0;
  border: none;
  background: none;
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border-radius: 7px;
  transition: color 200ms ease;
  user-select: none;
  position: relative;
  z-index: 1;
}

.demo-tab:hover {
  color: var(--vp-c-text-1);
}

.demo-tab.active {
  color: var(--vp-c-text-1);
}
</style>
