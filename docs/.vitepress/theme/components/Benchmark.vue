<script setup>
import { ref } from "vue";

const difficulty = ref(4);
const challenges = ref(50);
const challengeSize = ref(32);
const workers = ref(8);
const benchmarks = ref(1);

const isRunning = ref(false);
const resultMessage = ref("");
const progressValue = ref(0);

const doBenchmark = async (i, total) => {
  if (i < 1 || i > total) {
    console.error("Invalid benchmark index 'i'");
    return;
  }

  const Cap = window.Cap;

  try {
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

      const completedRunsProgress = ((i - 1) / total) * 100;
      const currentRunContribution = progress / total;
      const overallProgress = completedRunsProgress + currentRunContribution;

      progressValue.value = Math.min(100, Math.max(0, overallProgress));

      resultMessage.value = `Running benchmark ${i}/${total}... ${progress.toFixed(
        2
      )}% (Overall: ${overallProgress.toFixed(2)}%)`;
    });

    const start = performance.now();
    await cap.solve();
    const end = performance.now();
    const time = end - start;

    progressValue.value = (i / total) * 100;

    resultMessage.value = `Benchmark ${i}/${total} completed in ${Math.round(
      time
    )} ms.`;
    return time;
  } catch (error) {
    console.error(`Benchmark ${i}/${total} failed:`, error);
    resultMessage.value = `Error during benchmark ${i}/${total}: ${error.message}`;
    progressValue.value = ((i - 1) / total) * 100;
  }
};

async function runBenchmark() {
  if (isRunning.value) return;

  if (difficulty.value < 1 || difficulty.value > 10) {
    resultMessage.value =
      "Difficulty must be between 1 and 10. Difficulties above 10 may and will cause the widget to be unresponsive.";
    return;
  }

  isRunning.value = true;
  progressValue.value = 0;
  resultMessage.value = "Running benchmarks... 0%";

  try {
    const total = benchmarks.value;
    const times = [];
    for (let i = 1; i <= total; i++) {
      const time = await doBenchmark(i, total);
      if (time) {
        times.push(time);
      }
    }
    const totalTime = times.reduce((acc, time) => acc + time, 0);
    const averageTime = totalTime / times.length;

    resultMessage.value = `Average benchmark time: ${Math.round(
      averageTime
    )} ms over ${total} runs.`;

    try {
      plausible("benchmark", {
        props: {
          difficulty: difficulty.value,
          challenges: challenges.value,
          challengeSize: challengeSize.value,
          workers: workers.value,
          benchmarks: benchmarks.value,
          averageTime,
        },
      });
    } catch (e) {
      console.log("[plausible] error on benchmark log", e);
    }
  } catch {
  } finally {
    progressValue.value = 100;
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
      <div class="benchmark-field">
        <label for="benchmarks">Number of benchmarks</label>
        <input
          type="number"
          id="benchmarks"
          name="benchmarks"
          min="1"
          max="100"
          v-model.number="benchmarks"
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
