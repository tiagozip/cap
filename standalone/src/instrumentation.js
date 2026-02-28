import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cpus } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, "instrumentation-worker.js");

const POOL_SIZE = process.env.INSTRUMENTATION_WORKERS || Math.min(4, cpus().length || 4);
const WORKER_TIMEOUT = 15_000;
const MAX_QUEUE_SIZE = 50;
const QUEUE_ITEM_TTL = 20_000;

class InstrumentationWorkerPool {
  constructor(size) {
    this._size = size;
    this._workers = [];
    this._queue = [];
    this._available = [];

    for (let i = 0; i < size; i++) {
      this._spawnWorker(i);
    }
  }

  _spawnWorker(index) {
    const worker = new Worker(WORKER_PATH);
    this._workers[index] = worker;
    this._available.push(index);

    worker.on("error", (err) => {
      console.error(`[cap] instrumentation worker ${index} error:`, err);
      try {
        worker.terminate();
      } catch {}
      this._spawnWorker(index);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.warn(`[cap] instrumentation worker ${index} exited with code ${code}, respawning`);
        this._spawnWorker(index);
      }
    });
  }

  run(keyConfig) {
    return new Promise((resolve, reject) => {
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        return reject(new Error("Instrumentation queue is full, try again later"));
      }

      const task = { keyConfig, resolve, reject, queuedAt: Date.now() };

      if (this._available.length > 0) {
        this._dispatch(task);
      } else {
        const ttlTimer = setTimeout(() => {
          const idx = this._queue.indexOf(task);
          if (idx !== -1) {
            this._queue.splice(idx, 1);
          }
          reject(new Error("Instrumentation task expired while waiting in queue"));
        }, QUEUE_ITEM_TTL);

        if (ttlTimer.unref) ttlTimer.unref();

        task.ttlTimer = ttlTimer;
        this._queue.push(task);
      }
    });
  }

  _dispatch(task) {
    const index = this._available.shift();
    const worker = this._workers[index];

    const timeout = setTimeout(() => {
      cleanup();
      try {
        worker.terminate();
      } catch {}
      this._spawnWorker(index);
      task.reject(new Error("Instrumentation worker timed out"));
    }, WORKER_TIMEOUT);

    const onMessage = (msg) => {
      cleanup();
      this._release(index);

      if (msg.ok) {
        task.resolve(msg.result);
      } else {
        task.reject(new Error(msg.error || "Worker generation failed"));
      }
    };

    const onError = (err) => {
      cleanup();
      this._release(index);
      task.reject(err);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeListener("message", onMessage);
      worker.removeListener("error", onError);
    };

    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.postMessage({ keyConfig: task.keyConfig });
  }

  _release(index) {
    this._available.push(index);

    if (this._queue.length > 0) {
      const next = this._queue.shift();

      if (next.ttlTimer) {
        clearTimeout(next.ttlTimer);
        next.ttlTimer = null;
      }

      this._dispatch(next);
    }
  }

  async terminate() {
    for (const w of this._workers) {
      if (w) {
        try {
          await w.terminate();
        } catch {}
      }
    }
    this._workers = [];
    this._available = [];
    for (const task of this._queue) {
      if (task.ttlTimer) {
        clearTimeout(task.ttlTimer);
        task.ttlTimer = null;
      }
      task.reject(new Error("Pool terminated"));
    }
    this._queue = [];
  }
}

const pool = new InstrumentationWorkerPool(POOL_SIZE);

export async function generateInstrumentationChallenge(keyConfig = {}) {
  return pool.run(keyConfig);
}

export function verifyInstrumentationResult(challengeMeta, payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, env: null, reason: "missing_output" };
  }

  if (payload.i !== challengeMeta.id) {
    return { valid: false, env: null, reason: "id_mismatch" };
  }

  const actual = payload.state;
  if (!actual || typeof actual !== "object") {
    return { valid: false, env: null, reason: "invalid_state" };
  }

  let matchedEnv = null;
  for (const s of challengeMeta.validStates) {
    if (challengeMeta.vars.every((v, i) => actual[v] === s.vals[i])) {
      matchedEnv = s.env;
      break;
    }
  }

  if (!matchedEnv) {
    return { valid: false, env: null, reason: "failed_challenge" };
  }

  return {
    valid: true,
    env: matchedEnv,
  };
}
