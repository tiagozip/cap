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

const injectCarbon = (attempt = 0) => {
  const host = slot.value;
  if (!host) return;
  if (document.getElementById("_carbonads_js")) {
    if (attempt < 40) setTimeout(() => injectCarbon(attempt + 1), 150);
    return;
  }
  host.innerHTML = "";
  const s = document.createElement("script");
  s.async = true;
  s.type = "text/javascript";
  s.id = "_carbonads_js";
  const format = props.position === "top" ? "responsive" : "cover";
  s.src = `//cdn.carbonads.com/carbon.js?serve=CWBDKK3E&placement=${props.placement}&format=${format}`;
  host.appendChild(s);

  let freed = false;
  const free = () => {
    if (freed) return;
    freed = true;
    if (s.id === "_carbonads_js") s.id = `_carbonads_js_done_${Date.now()}`;
  };
  const startedAt = Date.now();
  const poll = setInterval(() => {
    if (host.querySelector("#carbonads") || Date.now() - startedAt > 4000) {
      clearInterval(poll);
      free();
    }
  }, 100);
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

const US_TIMEZONES = new Set([
  "America/New_York",
  "America/Detroit",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Indiana/Indianapolis",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Vevay",
  "America/Indiana/Tell_City",
  "America/Indiana/Knox",
  "America/Menominee",
  "America/Chicago",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/North_Dakota/Beulah",
  "America/Denver",
  "America/Boise",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Juneau",
  "America/Sitka",
  "America/Metlakatla",
  "America/Yakutat",
  "America/Nome",
  "America/Adak",
  "Pacific/Honolulu",
]);

const isUsCarbonRoll = () => {
  if (typeof window === "undefined") return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (!US_TIMEZONES.has(tz)) return false;
    return Math.random() < 0.33;
  } catch (_) {
    return false;
  }
};

const schedule = () => {
  nextTick(() =>
    requestAnimationFrame(() => {
      if (usingCarbon.value) loadCarbon();
      else if (isUsCarbonRoll()) loadCarbon();
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
    <div
      v-else
      ref="slot"
      :key="'carbon-' + route.path + '-' + nonce"
      class="carbon-slot"
    ></div>
  </div>
</template>
