export { qs, url } from "../../../capd/dashboard/src/lib/api.js";

const STORAGE_KEY = "cap_demo_state";
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
const pending = new Map();
let next = 0;

const ready = new Promise((resolve) => {
  worker.onmessage = ({ data }) => {
    if (data.ready) return resolve();
    if (data.save) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.save));
      } catch {}
      return;
    }
    pending.get(data.id)?.(data.result);
    pending.delete(data.id);
  };
});

worker.postMessage({
  init: true,
  saved: (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  })(),
});

export const hasAuth = () => true;

export function signOut() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("cap_last_key");
  } catch {}
  location.reload();
}

export async function api(method, path, body) {
  await ready;
  const id = next++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({
      id,
      method,
      path: String(path),
      body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)),
    });
  });
}

export function liveEvents(_siteKey, onEvents) {
  let timer = null;
  const tick = () => {
    onEvents();
    timer = setTimeout(tick, 1400 + Math.random() * 800);
  };
  timer = setTimeout(tick, 400);
  return () => clearTimeout(timer);
}
