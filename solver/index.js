import { Worker } from "worker_threads";
import os from "os";

const workerBlob = new Blob(
  [
    `
import crypto from "crypto";
import { parentPort, workerData } from "worker_threads";

const { salt, target } = workerData;

const saltBuffer = Buffer.from(salt);
const targetLen = target.length;
const targetBytes = Math.ceil(targetLen / 2);

let nonce = 0;

while (true) {
  const nonceStr = nonce.toString();

  const hash = crypto.createHash("sha256");

  hash.update(saltBuffer);
  hash.update(nonceStr);

  const hashBuffer = hash.digest();

  const hashPrefixHex = hashBuffer.toString("hex", 0, targetBytes);

  if (hashPrefixHex.startsWith(target)) {
    parentPort.postMessage({
      nonce: Number(nonce),
      salt,
      target,
    });
    break;
  }

  nonce++;
}`,
  ],
  {
    type: "application/typescript",
  }
);
const workerUrl = URL.createObjectURL(workerBlob);

export default function solver(challenges, config) {
  const totalChallenges = challenges.length;
  const numWorkers =
    config?.workerCount || Math.min(totalChallenges, 14, os.cpus().length);

  let challengesProcessed = 0;
  let nextChallengeIndex = 0;
  let activeWorkers = 0;
  const results = [];

  return new Promise((resolve) => {
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
          results.push([result.salt, result.target, result.nonce]);
          challengesProcessed++;
          activeWorkers--;

          if (challengesProcessed === totalChallenges) {
            resolve(results);
          } else {
            startWorker();
          }
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
