<script setup>
import { ref } from "vue";

const difficulty = ref(4);
const challenges = ref(18);
const challengeSize = ref(32);
const workers = ref(8);

const isRunning = ref(false);
const resultMessage = ref("");
const progressValue = ref(0);

async function runBenchmark() {
  if (isRunning.value) return;

  isRunning.value = true;
  progressValue.value = 0;
  resultMessage.value = "Running benchmark... 0%";

  try {
    const { default: Cap } = await import("https://unpkg.com/@cap.js/widget");

    window.CAP_CUSTOM_FETCH = async (url, options) => {
      if (url === "/api/challenge") {
        const browserCrypto = window.crypto;
        return new Response(
          JSON.stringify({
            challenge: Array.from({ length: challenges.value }, () => [
              Array.from(
                browserCrypto.getRandomValues(
                  new Uint8Array(Math.ceil(challengeSize.value / 2))
                )
              )
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("")
                .slice(0, challengeSize.value),

              Array.from(
                browserCrypto.getRandomValues(
                  new Uint8Array(Math.ceil(difficulty.value / 2))
                )
              )
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("")
                .slice(0, difficulty.value),
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

    const cap = new Cap({
      apiEndpoint: "/api/",
      workers: workers.value,
    });

    cap.addEventListener("progress", (event) => {
      const { progress } = event.detail;
      progressValue.value = progress;
      resultMessage.value = `Running benchmark... ${progress.toFixed(2)}%`;
    });

    const start = performance.now();
    await cap.solve();
    const end = performance.now();
    const time = end - start;

    progressValue.value = 100;
    resultMessage.value = `Completed in ${time.toFixed(2)} ms.`;
  } catch (error) {
    console.error("Benchmark failed:", error);
    resultMessage.value = `Error: ${error.message}`;
    progressValue.value = 0;
  } finally {
    isRunning.value = false;
  }
}
</script>

<template>
  <ClientOnly>
    <div
      class="benchmark-form"
      :style="{ '--progress-percent': progressValue }"
    >
      <div class="benchmark-field">
        <label for="difficulty">Challenge difficulty</label>
        <input
          type="number"
          id="difficulty"
          name="difficulty"
          min="1"
          max="10"
          v-model.number="difficulty"
        />
      </div>
      <div class="benchmark-field">
        <label for="challenges">Number of challenges</label>
        <input
          type="number"
          id="challenges"
          name="challenges"
          min="1"
          max="100"
          v-model.number="challenges"
        />
      </div>
      <div class="benchmark-field">
        <label for="challengeSize">Challenge size</label>
        <input
          type="number"
          id="challengeSize"
          name="challengeSize"
          min="1"
          max="120"
          v-model.number="challengeSize"
        />
      </div>
      <div class="benchmark-field">
        <label for="workers">Number of workers</label>
        <input
          type="number"
          id="workers"
          name="workers"
          min="1"
          max="28"
          v-model.number="workers"
        />
      </div>
      <button @click="runBenchmark" :disabled="isRunning">
        {{ isRunning ? "Running..." : "Run benchmark" }}
      </button>
      <div v-if="resultMessage" class="benchmark-result">
        {{ resultMessage }}
      </div>
    </div>
    <template #fallback>
      <div>Loading benchmark tool...</div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.benchmark-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 300px;
  padding: 16px;
  border-radius: 12px;
  background-color: var(--vp-c-bg-soft);

  border: 1px solid transparent;
  background: linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft))
      padding-box,
    conic-gradient(
        var(--vp-c-brand-1) calc(var(--progress-percent, 0) * 1%),
        var(--vp-c-divider) 0
      )
      border-box;

  transition: background 0.2s ease;
  --progress-percent: 0;
}

.benchmark-field {
  display: flex;
  flex-direction: column;
}

.benchmark-field label {
  margin: 0;
  font-size: 0.9rem;
  margin-bottom: 0.2rem;
  opacity: 0.9;
  color: var(--vp-c-text-2);
}

.benchmark-field input {
  padding: 0.5rem 0.8rem;
  border-radius: 6px;
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  font-size: 16px;
  font-family: inherit;
  color: var(--vp-c-text-1);
}

.benchmark-field input:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

.benchmark-form button {
  background-color: var(--vp-c-brand-1);
  font-size: 14px;
  font-weight: 500;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  transition: background-color 0.2s ease, opacity 0.2s ease, filter 0.2s ease;
  border: none;
  cursor: pointer;
}

.benchmark-form button:hover:not(:disabled) {
  background-color: var(--vp-c-brand-2);
}

.benchmark-form button:disabled {
  opacity: 0.8;
  filter: grayscale(1);
  cursor: not-allowed;
}

.benchmark-result {
  margin-top: 0.5rem;
  padding: 0.5rem 0.8rem;
  background-color: var(--vp-c-bg-alt);
  border-radius: 6px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}
</style>
