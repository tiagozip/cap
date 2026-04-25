<script setup>
import { useRoute } from "vitepress";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  placement: { type: String, default: "capjsjsorg" },
  showAfterPx: { type: Number, default: 400 },
  hideNearFooterPx: { type: Number, default: 240 },
  keywords: {
    type: String,
    default:
      "security|captcha|authentication|bot-mitigation|devtools|web-development|javascript|nodejs|open-source",
  },
});

const DISMISS_KEY = "cap-sticky-ad-dismissed";
const route = useRoute();
const nonce = ref(0);
const visible = ref(false);
const dismissed = ref(false);
const isMobile = ref(false);
const loaded = ref(false);

const isHome = computed(() => {
  const p = route.path.replace(/\/+$/, "/");
  return p === "/" || p === "/index.html";
});

const shouldRender = computed(
  () =>
    isMobile.value && !isHome.value && !dismissed.value && visible.value,
);

let lastY = 0;
let rafPending = false;

const checkMobile = () => {
  isMobile.value =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;
};

const onScroll = () => {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const y = window.scrollY || window.pageYOffset || 0;
    const goingDown = y > lastY;
    lastY = y;

    const doc = document.documentElement;
    const nearFooter =
      doc.scrollHeight - (y + window.innerHeight) < props.hideNearFooterPx;

    if (!visible.value && goingDown && y > props.showAfterPx && !nearFooter) {
      visible.value = true;
    } else if (visible.value && nearFooter) {
      visible.value = false;
    }
  });
};

const loadAd = () => {
  if (loaded.value) return;
  const ea =
    typeof window !== "undefined" ? window.ethicalads : null;
  if (!ea || typeof ea.load !== "function") return;
  try {
    ea.load();
    loaded.value = true;
  } catch (_) {}
};

const dismiss = () => {
  dismissed.value = true;
  visible.value = false;
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch (_) {}
};

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch (_) {}
  checkMobile();
  lastY = window.scrollY || 0;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", checkMobile);
});

watch(shouldRender, (v) => {
  if (v) nextTick(() => requestAnimationFrame(loadAd));
});

watch(
  () => route.path,
  () => {
    nonce.value++;
    loaded.value = false;
  },
);
</script>

<template>
  <Transition name="sticky-ad">
    <div v-if="shouldRender" class="sticky-mobile-ad" role="complementary">
      <button
        type="button"
        class="sticky-mobile-ad__close"
        aria-label="Dismiss ad"
        @click="dismiss"
      >
        ×
      </button>
      <div
        :key="route.path + '-' + nonce"
        :data-ea-publisher="placement"
        :data-ea-keywords="keywords"
        data-ea-type="text"
        class="sticky-mobile-ad__slot"
      ></div>
    </div>
  </Transition>
</template>

<style>
.sticky-mobile-ad {
  position: fixed;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 50;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  padding: 10px 36px 10px 12px;
  min-height: 60px;
  max-height: 96px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
}

.sticky-mobile-ad__close {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
}

.sticky-mobile-ad__close:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.sticky-mobile-ad__slot [data-ea-publisher] {
  margin: 0 !important;
}

.sticky-mobile-ad__slot .ea-content {
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.sticky-ad-enter-active,
.sticky-ad-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.sticky-ad-enter-from,
.sticky-ad-leave-to {
  transform: translateY(110%);
  opacity: 0;
}

@media (min-width: 769px) {
  .sticky-mobile-ad {
    display: none !important;
  }
}
</style>
