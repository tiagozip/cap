import os from "node:os";
import { Worker } from "node:worker_threads";

function prng(seed, length) {
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  let state = fnv1a(seed);
  let result = "";

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  while (result.length < length) {
    const rnd = next();
    result += rnd.toString(16).padStart(8, "0");
  }

  return result.substring(0, length);
}

const workerBlob = new Blob(
  [
    `
import { parentPort, workerData } from "worker_threads";
import { solve_pow } from "@cap.js/wasm";

const { salt, target, challengeIndex } = workerData;

try {
  const startTime = performance.now();
  const nonce = solve_pow(salt, target);
  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000; // seconds
  
  parentPort.postMessage({
    nonce,
    challengeIndex,
    duration
  });
} catch (error) {
  parentPort.postMessage({
    error: error.message,
    salt,
    target,
    challengeIndex
  });
}
`,
  ],
  {
    type: "application/typescript",
  },
);

const workerUrl = URL.createObjectURL(workerBlob);

export default function solve(challenge, config = {}) {
  let challenges = challenge;

  if (!Array.isArray(challenges)) {
    let i = 0;

    challenges = Array.from({ length: config.c }, () => {
      i = i + 1;

      return [
        prng(`${challenges}${i}`, config.s),
        prng(`${challenges}${i}d`, config.d),
      ];
    });
  }

  const totalChallenges = challenges.length;
  const numWorkers =
    config?.workerCount || Math.min(totalChallenges, os.cpus().length);

  let challengesProcessed = 0;
  let nextChallengeIndex = 0;
  let activeWorkers = 0;
  const results = new Array(totalChallenges);

  if (totalChallenges === 0) {
    resolve([]);
  }

  return new Promise((resolve, reject) => {
    function startWorker() {
      if (nextChallengeIndex < totalChallenges && activeWorkers < numWorkers) {
        const currentChallengeIndex = nextChallengeIndex;
        const [salt, target] = challenges[currentChallengeIndex];
        nextChallengeIndex++;
        activeWorkers++;

        const worker = new Worker(workerUrl, {
          workerData: { salt, target, challengeIndex: currentChallengeIndex },
        });

        worker.on("message", (result) => {
          worker.terminate();
          activeWorkers--;

          if (result.error) {
            console.error(
              `Error in worker for challenge ${currentChallengeIndex}:`,
              result.error,
            );
            reject(new Error(`Worker error: ${result.error}`));
            return;
          }

          results[result.challengeIndex] = result.nonce;
          challengesProcessed++;

          if (config?.onProgress) {
            config.onProgress({
              progress: Math.floor(
                (challengesProcessed / totalChallenges) * 100,
              ),
              currentChallenge: currentChallengeIndex,
              challengesProcessed,
              totalChallenges,
              result,
            });
          }

          if (challengesProcessed === totalChallenges) {
            return resolve(results);
          }

          startWorker();
        });

        worker.on("error", (err) => {
          console.error(`Worker error:`, err);
          worker.terminate();
          activeWorkers--;
          reject(err);
        });
      }
    }

    for (let i = 0; i < numWorkers; i++) {
      startWorker();
    }
  });
}
