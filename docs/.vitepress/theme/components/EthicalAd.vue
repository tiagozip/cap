<script setup>
import { useRoute } from "vitepress";
import { nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  variant: { type: String, default: "sidebar" },
  placement: { type: String, default: "capjsjsorg" },
});

const route = useRoute();
const nonce = ref(0);

const tryLoad = (attempt = 0) => {
  if (typeof window === "undefined") return;
  const ea = window.ethicalads;
  if (!ea || typeof ea.load !== "function") {
    if (attempt < 40) setTimeout(() => tryLoad(attempt + 1), 150);
    return;
  }
  try {
    ea.load();
  } catch (_) {}
};

const schedule = () => {
  nextTick(() => requestAnimationFrame(() => tryLoad()));
};

onMounted(schedule);

watch(
  () => route.path,
  () => {
    nonce.value++;
    schedule();
  },
);
</script>

<template>
  <div :class="['ea-wrap', `ea-wrap--${variant}`]">
    <div
      :key="route.path + '-' + nonce"
      :data-ea-publisher="placement"
      data-ea-type="image"
    ></div>
  </div>
</template>
