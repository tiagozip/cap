import { url as realUrl } from "../../../capd/dashboard/src/lib/api.js";

export { qs } from "../../../capd/dashboard/src/lib/api.js";

const STORAGE_KEY = "cap_demo_state";
const BACKGROUND_KEY = "cap_demo_login_background";
const empty = new URLSearchParams(location.search).has("empty");

let background = (() => {
  try {
    return localStorage.getItem(BACKGROUND_KEY);
  } catch {
    return null;
  }
})();

const keepBackground = (data) => {
  background = data;
  try {
    if (data) localStorage.setItem(BACKGROUND_KEY, data);
    else localStorage.removeItem(BACKGROUND_KEY);
  } catch {}
};

export const url = (p) =>
  background && String(p).startsWith("login-background?")
    ? background
    : realUrl(p);

export const authHeader = () => "";

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const target = String(input?.url ?? input);
  const at = target.indexOf("server/keys/");
  if (at < 0 || !/\/events\/export(\?|$)/.test(target))
    return realFetch(input, init);
  const result = await api("GET", target.slice(at + 6));
  if (!result?.export) return Response.json(result ?? {}, { status: 400 });
  return new Response(result.body, {
    headers: {
      "content-type": result.type,
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
};
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});
const pending = new Map();
let next = 0;

const ready = new Promise((resolve) => {
  worker.onmessage = ({ data }) => {
    if (data.ready) return resolve();
    if (data.save) {
      if (empty) return;
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
  empty,
  saved: (() => {
    if (empty) return null;
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
    localStorage.removeItem(BACKGROUND_KEY);
  } catch {}
  location.reload();
}

export async function api(method, path, body) {
  await ready;
  const id = next++;
  const route = String(path).split("?")[0];
  return new Promise((resolve) => {
    if (route === "/settings/login-background/image")
      pending.set(id, (result) => {
        if (result?.success)
          keepBackground(method === "PUT" ? body?.data : null);
        resolve(result);
      });
    else pending.set(id, resolve);
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
