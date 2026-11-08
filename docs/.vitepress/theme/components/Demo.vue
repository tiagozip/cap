<script setup>
import { onBeforeUnmount, onMounted } from "vue";
import { demoInstrumentation, judgeDemo, onDemoError } from "../demoCheck.js";
import { demoMode } from "./demoMode";

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
          ...(await demoInstrumentation()),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (url === "/api/redeem") {
      judgeDemo(options);
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

  document.addEventListener("error", onDemoError);

  if (!document.querySelector("script[data-cap-floating-loaded]")) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/cap-widget/cap-floating.min.js";
    s.async = true;
    s.setAttribute("data-cap-floating-loaded", "");
    document.head.appendChild(s);
  }
});

onBeforeUnmount(() => document.removeEventListener("error", onDemoError));
</script>

<template>
  <ClientOnly>
    <div style="margin-top: 0.6em"></div>
    <cap-widget
      v-if="demoMode === 'widget'"
      class="demo-widget-highlight"
      data-cap-api-endpoint="/api/"
    ></cap-widget>
    <cap-widget
      id="demo-floating-widget"
      data-cap-api-endpoint="/api/"
      style="display: none"
    ></cap-widget>

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
  height: 58px;
}
</style>
