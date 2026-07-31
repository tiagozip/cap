<script setup>
defineProps({
  palettes: { type: Array, required: true },
  chips: { type: Object, required: true },
  active: { type: String, required: true },
});

defineEmits(["pick"]);
</script>

<template>
  <div class="ft-glow-picker" role="group" aria-label="Footer palette">
    <button
      v-for="p in palettes"
      :key="p.id"
      type="button"
      class="ft-glow-chip"
      :class="{ on: active === p.id }"
      :aria-pressed="active === p.id"
      @click="$emit('pick', p.id)"
    >
      <span class="ft-glow-swatch" :style="{ backgroundImage: chips[p.id] }" />
      {{ p.label }}
    </button>
  </div>
</template>

<style>
#homev2 .ft-glow-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  width: max-content;
  max-width: calc(100% - 32px);
  margin: 0 auto;
  padding: 6px;
  border: 1px solid color-mix(in oklab, var(--line) 80%, transparent);
  border-radius: 100px;
  background: color-mix(in oklab, var(--bg) 72%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
#homev2 .ft-glow-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px 0 8px;
  border: 1px solid transparent;
  border-radius: 100px;
  background: transparent;
  color: var(--fg-mute);
  font-family: var(--mono);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease;
}
#homev2 .ft-glow-chip:hover {
  color: var(--fg);
  background: color-mix(in oklab, var(--surface) 80%, transparent);
}
#homev2 .ft-glow-chip.on {
  color: var(--fg);
  border-color: color-mix(in oklab, var(--accent) 40%, var(--line));
  background: color-mix(in oklab, var(--accent) 10%, transparent);
}
#homev2 .ft-glow-swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);
}

@media (max-width: 700px) {
  #homev2 .ft-glow-picker {
    width: auto;
    max-width: none;
    border-radius: 16px;
  }
}
</style>
