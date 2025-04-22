<script setup>
import Cap from "@cap.js/widget";

window.CAP_CUSTOM_FETCH = async (url, options) => {
  if (url === "/api/challenge") {
    return new Response(
      JSON.stringify({
        challenge: Array.from({ length: 18 }, () => [
          Array.from(
            crypto.getRandomValues(
              new Uint8Array(Math.ceil(32 / 2))
            )
          )
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 32),

          Array.from(
            crypto.getRandomValues(
              new Uint8Array(Math.ceil(4 / 2))
            )
          )
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 4),
        ]),
        token: "",
        expires: (new Date().getTime()) + (6000*100),
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
  return await fetch(...arguments);
};
</script>

<template>
  <div style="margin-top: .6em;"></div>
  <cap-widget data-cap-api-endpoint="/api/"></cap-widget>
</template>
