<script setup>
import { onMounted, ref } from "vue";

const difficulty = ref(1_000_000);
const subChallenges = ref(4);
const workers = ref(8);
const runs = ref(1);

const isRunning = ref(false);
const resultMessage = ref("");
const progressValue = ref(0);

onMounted(() => {
  workers.value = Math.min(16, navigator.hardwareConcurrency || 8);
});

const hex = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

const json = (body) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const doBenchmark = async (i, total) => {
  const each = Math.max(1, Math.round(difficulty.value / subChallenges.value));
  window.CAP_CUSTOM_FETCH = async (url, options) => {
    if (url === "/api/challenge") {
      return json({
        format: 2,
        token: "benchmark",
        expires: Date.now() + 600_000,
        challenges: Array.from({ length: subChallenges.value }, () => ({
          protocol: "hashwx",
          payload: { c: hex(32), d: each, n: 65536 },
        })),
      });
    }
    if (url === "/api/redeem") {
      return json({ success: true, token: "benchmark", expires: Date.now() + 60_000 });
    }
    return window.fetch(url, options);
  };

  const cap = new window.Cap({
    apiEndpoint: "/api/",
    "data-cap-worker-count": workers.value,
  });

  cap.addEventListener("progress", (event) => {
    const overall = ((i - 1) / total) * 100 + event.detail.progress / total;
    progressValue.value = Math.min(100, Math.max(0, overall));
    resultMessage.value = `Run ${i} of ${total}: ${Math.round(event.detail.progress)}%`;
  });

  try {
    const start = performance.now();
    await cap.solve();
    const time = performance.now() - start;
    progressValue.value = (i / total) * 100;
    resultMessage.value = `Run ${i} of ${total} took ${Math.round(time)} ms.`;
    return time;
  } catch (error) {
    console.error(`Benchmark run ${i} failed:`, error);
    resultMessage.value = `Run ${i} of ${total} failed: ${error.message}`;
    progressValue.value = ((i - 1) / total) * 100;
  }
};

async function runBenchmark() {
  if (isRunning.value) return;

  if (!Number.isInteger(difficulty.value) || difficulty.value < 1000 || difficulty.value > 100_000_000) {
    resultMessage.value = "Difficulty must be between 1,000 and 100,000,000.";
    return;
  }
  if (!Number.isInteger(subChallenges.value) || subChallenges.value < 1 || subChallenges.value > 32) {
    resultMessage.value = "Sub-challenges must be between 1 and 32.";
    return;
  }

  isRunning.value = true;
  progressValue.value = 0;
  resultMessage.value = "Loading HashWX...";

  try {
    const total = runs.value;
    const times = [];
    for (let i = 1; i <= total; i++) {
      const time = await doBenchmark(i, total);
      if (time) times.push(time);
    }
    if (!times.length) return;
    const sorted = [...times].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    resultMessage.value =
      total === 1
        ? `Solved in ${Math.round(times[0])} ms.`
        : `Median ${Math.round(median)} ms over ${times.length} runs, slowest ${Math.round(sorted.at(-1))} ms.`;

    try {
      plausible("benchmark", {
        props: {
          protocol: "hashwx",
          difficulty: difficulty.value,
          subChallenges: subChallenges.value,
          workers: workers.value,
          runs: total,
          median,
        },
      });
    } catch {}
  } finally {
    progressValue.value = 100;
    isRunning.value = false;
  }
}
</script>

<template>
  <ClientOnly>
    <div class="benchmark-form" :style="{ '--progress-percent': progressValue }">
      <div class="benchmark-field">
        <label for="difficulty">Difficulty</label>
        <input type="number" id="difficulty" name="difficulty" min="1000" step="100000" v-model.number="difficulty" />
      </div>
      <div class="benchmark-field">
        <label for="subChallenges">Sub-challenges</label>
        <input type="number" id="subChallenges" name="subChallenges" min="1" max="32" v-model.number="subChallenges" />
      </div>
      <div class="benchmark-field">
        <label for="workers">Workers</label>
        <input type="number" id="workers" name="workers" min="1" max="32" v-model.number="workers" />
      </div>
      <div class="benchmark-field">
        <label for="runs">Runs</label>
        <input type="number" id="runs" name="runs" min="1" max="50" v-model.number="runs" />
      </div>
      <button @click="runBenchmark" :disabled="isRunning">
        {{ isRunning ? "Running..." : "Run benchmark" }}
      </button>
      <div v-if="resultMessage" class="benchmark-result" role="status">
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
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)) padding-box,
    conic-gradient(var(--vp-c-brand-1) calc(var(--progress-percent, 0) * 1%), var(--vp-c-divider) 0)
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
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease,
    filter 0.2s ease;
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
