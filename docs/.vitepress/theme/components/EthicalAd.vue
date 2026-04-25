<script setup>
import { useRoute } from "vitepress";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  variant: { type: String, default: "sidebar" },
  position: { type: String, default: "bottom" },
  placement: { type: String, default: "capjsjsorg" },
  keywords: { type: String, default: "" },
  skipOnMobile: { type: Boolean, default: false },
});

const isMobile = ref(false);
const checkMobile = () => {
  isMobile.value =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;
};

const DEFAULT_KEYWORDS =
  "security|captcha|authentication|bot-mitigation|devtools|web-development|javascript|nodejs|open-source";

const PATH_KEYWORDS = [
  {
    match: /^\/guide\/alternatives/,
    keywords: "recaptcha|hcaptcha|turnstile|captcha|comparison|alternatives",
  },
  {
    match: /^\/guide\/benchmark/,
    keywords: "benchmark|performance|captcha|security",
  },
  {
    match: /^\/guide\/effectiveness/,
    keywords: "bot-mitigation|security|fraud-prevention|captcha",
  },
  {
    match: /^\/guide\/widget/,
    keywords: "frontend|javascript|web-components|captcha|integration",
  },
  {
    match: /^\/guide\/server/,
    keywords: "nodejs|backend|api|authentication|captcha",
  },
  { match: /^\/guide\/standalone/, keywords: "docker|self-hosted|devops" },
  { match: /^\/guide/, keywords: "developer-tools|integration|tutorial" },
];

const route = useRoute();
const nonce = ref(0);

const resolvedKeywords = computed(() => {
  if (props.keywords) return props.keywords;
  const path = route.path.replace(/\/+$/, "/");
  const hit = PATH_KEYWORDS.find((p) => p.match.test(path));
  return hit ? `${hit.keywords}|${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;
});

const SKIP_TOP_PATHS = new Set([
  "/guide/",
  "/guide/index.html",
  "/guide/demo.html",
  "/guide/demo",
]);

const shouldRender = computed(() => {
  if (props.skipOnMobile && isMobile.value) return false;
  if (props.position !== "top") return true;
  return !SKIP_TOP_PATHS.has(route.path);
});

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
  nextTick(() =>
    requestAnimationFrame(() => {
      tryLoad();
    }),
  );
};

onMounted(() => {
  checkMobile();
  window.addEventListener("resize", checkMobile);
  schedule();
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});

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
      :key="route.path + '-' + nonce"
      :data-ea-publisher="placement"
      :data-ea-keywords="resolvedKeywords"
      data-ea-type="image"
      class="adaptive-css"
    ></div>
  </div>
</template>
