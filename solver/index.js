import { Worker } from "worker_threads";
import os from "os";
import { performance } from "perf_hooks";

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
    salt,
    target,
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
  }
);

const workerUrl = URL.createObjectURL(workerBlob);

export default function wasmSolver(challenges, config = {}) {
  const totalChallenges = challenges.length;
  const numWorkers =
    config?.workerCount || Math.min(totalChallenges, os.cpus().length);

  let challengesProcessed = 0;
  let nextChallengeIndex = 0;
  let activeWorkers = 0;
  const results = new Array(totalChallenges);

  return new Promise((resolve, reject) => {
    const startTime = performance.now();

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
              result.error
            );
            reject(new Error(`Worker error: ${result.error}`));
            return;
          }

          results[result.challengeIndex] = [
            result.salt,
            result.target,
            result.nonce,
          ];
          challengesProcessed++;

          if (config?.onProgress) {
            config.onProgress({
              progress: Math.floor(
                (challengesProcessed / totalChallenges) * 100
              ),
              currentChallenge: currentChallengeIndex,
              challengesProcessed,
              totalChallenges,
              result,
            });
          }

          if (challengesProcessed === totalChallenges) {
            resolve(results.filter(Boolean));
          } else {
            startWorker();
          }
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

    if (totalChallenges === 0) {
      resolve([]);
    }
  });
}
