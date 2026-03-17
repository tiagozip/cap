import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_PATH = join(__dirname, "instrumentation-worker.js");

const MAX_POOL = process.env.INSTRUMENTATION_MAX_POOL || 6;
const MAX_QUEUE = parseInt(process.env.INSTRUMENTATION_MAX_QUEUE, 10) || 200;
const JOB_TIMEOUT = 15_000;
const IDLE_TTL = 10_000;

const pool = [];
const queue = [];

function spawnWorker() {
  const child = fork(WORKER_PATH, [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  if (child.stderr) {
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  }

  const w = { child, busy: false, idleTimer: null };

  child.on("message", (msg) => {
    if (!w._job) return;
    const job = w._job;
    w._job = null;
    w.busy = false;
    clearTimeout(job.timer);

    if (msg.ok) job.resolve(msg.result);
    else job.reject(new Error(msg.error || "Worker generation failed"));

    drain();
    resetIdleTimer(w);
  });

  child.on("exit", () => {
    clearIdleTimer(w);
    const idx = pool.indexOf(w);
    if (idx !== -1) pool.splice(idx, 1);

    if (w._job) {
      clearTimeout(w._job.timer);
      w._job.reject(new Error("Instrumentation worker exited unexpectedly"));
      w._job = null;
      w.busy = false;
      drain();
    }
  });

  child.on("error", (err) => {
    console.error("[cap] instrumentation worker error:", err);
  });

  resetIdleTimer(w);
  pool.push(w);
  return w;
}

function resetIdleTimer(w) {
  clearIdleTimer(w);
  w.idleTimer = setTimeout(() => {
    if (!w.busy) {
      const idx = pool.indexOf(w);
      if (idx !== -1) pool.splice(idx, 1);
      try { w.child.kill("SIGTERM"); } catch {}
    }
  }, IDLE_TTL);
  if (w.idleTimer.unref) w.idleTimer.unref();
}

function clearIdleTimer(w) {
  if (w.idleTimer) {
    clearTimeout(w.idleTimer);
    w.idleTimer = null;
  }
}

function assignJob(w, job) {
  w.busy = true;
  w._job = job;
  clearIdleTimer(w);
  const id = randomUUID();
  w.child.send({ id, keyConfig: job.keyConfig });
}

function drain() {
  while (queue.length > 0) {
    const idle = pool.find((w) => !w.busy);
    if (idle) {
      assignJob(idle, queue.shift());
      continue;
    }

    if (pool.length < MAX_POOL) {
      const w = spawnWorker();
      assignJob(w, queue.shift());
      continue;
    }

    break;
  }
}

export async function generateInstrumentationChallenge(keyConfig = {}) {
  if (queue.length >= MAX_QUEUE) {
    throw new Error("Instrumentation queue full");
  }

  return new Promise((resolve, reject) => {
    const job = { keyConfig, resolve, reject, timer: null };

    job.timer = setTimeout(() => {
      const idx = queue.indexOf(job);
      if (idx !== -1) queue.splice(idx, 1);
      reject(new Error("Instrumentation worker timed out"));
    }, JOB_TIMEOUT);
    if (job.timer.unref) job.timer.unref();

    queue.push(job);
    drain();
  });
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

  const match = challengeMeta.vars.every((v, i) => actual[v] === challengeMeta.expectedVals[i]);

  if (!match) {
    return { valid: false, reason: "failed_challenge" };
  }

  return { valid: true };
}
