<script setup>
import { onMounted } from "vue";

onMounted(() => {
  window.CAP_CUSTOM_FETCH = async (url, options) => {
    if (url === "/api/challenge") {
      const browserCrypto = window.crypto;

      try {
        plausible("demo");
      } catch {}

      return new Response(
        JSON.stringify({
          challenge: Array.from({ length: 50 }, () => [
            Array.from(browserCrypto.getRandomValues(new Uint8Array(Math.ceil(32 / 2))))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 32),

            Array.from(browserCrypto.getRandomValues(new Uint8Array(Math.ceil(4 / 2))))
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 4),
          ]),
          token: "",
          expires: Date.now() + 6000 * 100,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (url === "/api/redeem") {
      if (document.querySelector(".signin-button")) {
        document.querySelector(".signin-button").classList.add("active");
      }

      try {
        plausible("demo-solved");
      } catch {}

      return new Response(
        JSON.stringify({
          success: true,
          token: "",
          expires: Date.now() + 3600000,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return await window.fetch(url, options);
  };
});
</script>

<template>
  <ClientOnly>
    <div style="margin-top: 0.6em"></div>
    <cap-widget class="demo-widget-highlight" data-cap-api-endpoint="/api/"></cap-widget>

    <template #fallback>
      <div>Loading widget...</div>
    </template>
  </ClientOnly>
</template>

<style>
cap-widget.demo-widget-highlight {
  display: block;
  width: fit-content !important;
  border-radius: 14px;
  animation: demo-widget-pulse 1.6s ease-out 0.4s 2;
}

@keyframes demo-widget-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vp-c-brand-1) 65%, transparent);
  }
  70% {
    box-shadow: 0 0 0 14px color-mix(in srgb, var(--vp-c-brand-1) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vp-c-brand-1) 0%, transparent);
  }
}
</style>
