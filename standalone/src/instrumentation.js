import { fork } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, "instrumentation-worker.js");

const POOL_MAX = Number(process.env.INSTRUMENTATION_WORKERS) || 1;
const WORKER_TIMEOUT = 15_000;
const MAX_QUEUE_SIZE = 50;
const QUEUE_ITEM_TTL = 20_000;

class InstrumentationProcessPool {
  constructor(maxSize) {
    this._maxSize = maxSize;
    this._busy = 0;
    this._queue = [];
  }

  _spawnOne() {
    const child = fork(WORKER_PATH, [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
      });
    }

    return child;
  }

  run(keyConfig) {
    return new Promise((resolve, reject) => {
      if (this._queue.length >= MAX_QUEUE_SIZE) {
        return reject(new Error("Instrumentation queue is full, try again later"));
      }

      const task = { keyConfig, resolve, reject, ttlTimer: null };

      task.ttlTimer = setTimeout(() => {
        const idx = this._queue.indexOf(task);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error("Instrumentation task expired while waiting in queue"));
      }, QUEUE_ITEM_TTL);
      if (task.ttlTimer.unref) task.ttlTimer.unref();

      this._queue.push(task);
      this._drain();
    });
  }

  _drain() {
    while (this._queue.length > 0 && this._busy < this._maxSize) {
      const task = this._queue.shift();

      if (task.ttlTimer) {
        clearTimeout(task.ttlTimer);
        task.ttlTimer = null;
      }

      this._busy++;
      this._runTask(task);
    }
  }

  _runTask(task) {
    let child;
    try {
      child = this._spawnOne();
    } catch (err) {
      this._busy = Math.max(0, this._busy - 1);
      task.reject(err);
      this._drain();
      return;
    }

    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      child.removeAllListeners("message");
      child.removeAllListeners("error");
      child.removeAllListeners("exit");
    };

    const finish = (err, result) => {
      if (settled) return;
      settled = true;
      cleanup();

      try {
        child.kill("SIGTERM");
      } catch {}

      this._busy = Math.max(0, this._busy - 1);

      if (err) task.reject(err);
      else task.resolve(result);

      this._drain();
    };

    const timeout = setTimeout(() => {
      finish(new Error("Instrumentation worker timed out"), null);
    }, WORKER_TIMEOUT);

    child.on("message", (msg) => {
      if (msg.ok) {
        finish(null, msg.result);
      } else {
        finish(new Error(msg.error || "Worker generation failed"), null);
      }
    });

    child.on("error", (err) => {
      console.error("[cap] instrumentation child error:", err);
      finish(err, null);
    });

    child.on("exit", (code) => {
      if (!settled) {
        finish(new Error(`Instrumentation child exited unexpectedly with code ${code}`), null);
      }
    });

    child.send({ keyConfig: task.keyConfig });
  }

  async terminate() {
    this._busy = 0;
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

const pool = new InstrumentationProcessPool(POOL_MAX);

const PREWARM_SIZE = 2;

function _configFingerprint(keyConfig) {
  return JSON.stringify({
    b: keyConfig.blockAutomatedBrowsers === true,
  });
}

class InstrumentationChallengeCache {
  constructor() {
    this._buckets = new Map();
  }

  _bucket(fp) {
    if (!this._buckets.has(fp)) {
      this._buckets.set(fp, { ready: [], filling: 0 });
    }
    return this._buckets.get(fp);
  }

  fill(keyConfig) {
    const fp = _configFingerprint(keyConfig);
    const bucket = this._bucket(fp);

    if (bucket.ready.length + bucket.filling >= PREWARM_SIZE) return;
    if (bucket.filling >= 1) return;

    bucket.filling++;
    const p = pool
      .run(keyConfig)
      .then((result) => result)
      .catch((err) => {
        console.warn("[cap] instrumentation pre-warm failed:", err);
        return null;
      })
      .finally(() => {
        bucket.filling--;
        this.fill(keyConfig);
      });
    bucket.ready.push(p);
  }

  async get(keyConfig) {
    const fp = _configFingerprint(keyConfig);
    const bucket = this._bucket(fp);

    this.fill(keyConfig);

    while (bucket.ready.length > 0) {
      const p = bucket.ready.shift();
      this.fill(keyConfig);

      let result;
      try {
        result = await p;
      } catch {
        result = null;
      }

      if (result !== null) {
        return result;
      }
    }

    return pool.run(keyConfig);
  }
}

const challengeCache = new InstrumentationChallengeCache();

export function warmForConfigs(keyConfigs) {
  for (const kc of keyConfigs) {
    challengeCache.fill(kc);
  }
}

export async function generateInstrumentationChallenge(keyConfig = {}) {
  return challengeCache.get(keyConfig);
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
