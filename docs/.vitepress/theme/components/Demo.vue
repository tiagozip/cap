<script setup>
import { onMounted } from "vue";

onMounted(() => {
  import("https://unpkg.com/@cap.js/widget")
    .then(({ default: Cap }) => {
      window.CAP_CUSTOM_FETCH = async (url, options) => {
        if (url === "/api/challenge") {
          const browserCrypto = window.crypto;
          return new Response(
            JSON.stringify({
              challenge: Array.from({ length: 18 }, () => [
                Array.from(
                  browserCrypto.getRandomValues(
                    new Uint8Array(Math.ceil(32 / 2))
                  )
                )
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("")
                  .slice(0, 32),

                Array.from(
                  browserCrypto.getRandomValues(
                    new Uint8Array(Math.ceil(4 / 2))
                  )
                )
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("")
                  .slice(0, 4),
              ]),
              token: "",
              expires: new Date().getTime() + 6000 * 100,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        if (url === "/api/redeem") {
          return new Response(
            JSON.stringify({
              success: true,
              token: "",
              expires: new Date().getTime() + 1000 * 60,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return await window.fetch(url, options);
      };
    })
});
</script>

<template>
  <ClientOnly>
    <div style="margin-top: 0.6em"></div>
    <cap-widget data-cap-api-endpoint="/api/"></cap-widget>

    <template #fallback>
      <div>Loading widget...</div>
    </template>
  </ClientOnly>
</template>
