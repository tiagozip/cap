<script setup>
import { useRoute } from "vitepress";
import { computed, nextTick, onMounted, ref, watch } from "vue";

const props = defineProps({
  variant: { type: String, default: "sidebar" },
  position: { type: String, default: "bottom" },
  placement: { type: String, default: "capjsjsorg" },
});

const route = useRoute();
const nonce = ref(0);
const slot = ref(null);
const usingCarbon = ref(false);

const isQuickstart = computed(() => {
  const p = route.path.replace(/\/+$/, "/");
  return p === "/guide/" || p === "/guide/index.html";
});

const shouldRender = computed(() => {
  if (props.position === "top" && isQuickstart.value) return false;
  return true;
});

const injectCarbon = () => {
  const host = slot.value;
  if (!host) return;
  host.innerHTML = "";
  const prev = document.getElementById("_carbonads_js");
  if (prev) prev.remove();
  const s = document.createElement("script");
  s.async = true;
  s.type = "text/javascript";
  s.id = "_carbonads_js";
  s.src = `//cdn.carbonads.com/carbon.js?serve=CWBDKK3E&placement=${props.placement}&format=cover`;
  host.appendChild(s);
};

const loadCarbon = () => {
  usingCarbon.value = true;
  nextTick(injectCarbon);
};

const tryLoad = (attempt = 0) => {
  if (typeof window === "undefined") return;
  const ea = window.ethicalads;
  if (!ea || typeof ea.load !== "function") {
    if (attempt < 40) setTimeout(() => tryLoad(attempt + 1), 150);
    else loadCarbon();
    return;
  }
  try {
    ea.load();
  } catch (_) {
    loadCarbon();
  }
};

const schedule = () => {
  nextTick(() =>
    requestAnimationFrame(() => {
      if (usingCarbon.value) loadCarbon();
      else tryLoad();
    }),
  );
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
  <div v-if="shouldRender" :class="['ea-wrap', `ea-wrap--${variant}`]">
    <div
      v-if="!usingCarbon"
      :key="route.path + '-' + nonce"
      :data-ea-publisher="placement"
      data-ea-type="image"
      class="adaptive-css"
    ></div>
    <div v-else ref="slot" :key="'carbon-' + route.path + '-' + nonce"></div>
  </div>
</template>
