<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const props = defineProps({
  placement: { type: String, default: "capjsjsorg" },
  hideAfterPx: { type: Number, default: 1400 },
  keywords: {
    type: String,
    default:
      "security|captcha|authentication|bot-mitigation|devtools|web-development|javascript|nodejs|open-source",
  },
});

const isMobile = ref(false);
const hidden = ref(false);
const loaded = ref(false);
const noFill = ref(false);
const slot = ref(null);

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
    hidden.value = y >= props.hideAfterPx;
  });
};

const tryLoad = (attempt = 0) => {
  if (loaded.value) return;
  const ea = typeof window !== "undefined" ? window.ethicalads : null;
  if (!ea || typeof ea.load !== "function") {
    if (attempt < 40) setTimeout(() => tryLoad(attempt + 1), 150);
    return;
  }
  try {
    ea.load();
    loaded.value = true;
    watchFill();
  } catch (_) {}
};

const watchFill = () => {
  const startedAt = Date.now();
  const poll = setInterval(() => {
    const host = slot.value;
    if (!host) return;
    const pub = host.querySelector("[data-ea-publisher]");
    if (!pub) return;
    const text = (pub.textContent || "").toLowerCase();
    const isNoFill =
      pub.classList.contains("nofill") ||
      text.includes("no ads to show") ||
      text.includes("no ad to show");
    const isLoaded = pub.classList.contains("loaded");

    if (isNoFill) {
      clearInterval(poll);
      noFill.value = true;
      return;
    }
    if (isLoaded && !isNoFill) {
      clearInterval(poll);
      return;
    }
    if (Date.now() - startedAt > 4000) {
      clearInterval(poll);
      if (!isLoaded) noFill.value = true;
    }
  }, 200);
};

onMounted(() => {
  checkMobile();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", checkMobile);
  if (isMobile.value) {
    requestAnimationFrame(() => tryLoad());
  }
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div
    v-if="isMobile && !noFill"
    class="home-sticky-ad"
    :class="{ 'home-sticky-ad--hidden': hidden }"
    role="complementary"
  >
    <div ref="slot" class="home-sticky-ad__slot ea-wrap ea-wrap--homesticky">
      <div
        :data-ea-publisher="placement"
        :data-ea-keywords="keywords"
        data-ea-type="text"
      ></div>
    </div>
  </div>
</template>

<style>
.home-sticky-ad {
  position: fixed;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 50;
  background: var(--bg, #11111b);
  border: 1px solid var(--line, #313244);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  padding: 10px 12px;
  min-height: 60px;
  max-height: 96px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  color: var(--fg, #e8e8e8);
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.home-sticky-ad--hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.ea-wrap.ea-wrap--homesticky [data-ea-publisher] {
  margin: 0 !important;
}

.ea-wrap.ea-wrap--homesticky .ea-content,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-content {
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--fg, #e8e8e8) !important;
  border-radius: 0 !important;
}

.ea-wrap.ea-wrap--homesticky .ea-text,
.ea-wrap.ea-wrap--homesticky .ea-text *,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-content a {
  color: var(--fg, #e8e8e8) !important;
}

.ea-wrap.ea-wrap--homesticky strong.ea-headline,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-content a strong.ea-headline {
  color: var(--accent, #89b4fa) !important;
}

.ea-wrap.ea-wrap--homesticky strong.ea-cta,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-content a strong.ea-cta {
  color: var(--accent, #89b4fa) !important;
}

.ea-wrap.ea-wrap--homesticky .ea-domain,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-domain {
  color: var(--fg-mute, #7f849c) !important;
}

.ea-wrap.ea-wrap--homesticky .ea-callout,
.ea-wrap.ea-wrap--homesticky [data-ea-publisher].loaded .ea-callout {
  display: block !important;
  text-align: left !important;
  float: none !important;
  margin: 4px 0 0 !important;
  padding: 0 !important;
  font-size: 11px !important;
  font-style: normal !important;
  color: var(--fg-mute, #7f849c) !important;
  opacity: 0.7;
}

.ea-wrap.ea-wrap--homesticky .ea-callout > * {
  display: none !important;
}

.ea-wrap.ea-wrap--homesticky .ea-callout::before {
  content: "via EthicalAds";
}

.ea-wrap.ea-wrap--homesticky .ea-stickybox-hide {
  display: none !important;
}

@media (min-width: 769px) {
  .home-sticky-ad {
    display: none !important;
  }
}
</style>
