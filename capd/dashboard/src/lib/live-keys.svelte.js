import { api } from "./api.js";
import { app } from "./state.svelte.js";

let busy = false;

const refresh = async () => {
  if (busy || document.hidden || !app.keys.length) return;
  busy = true;
  try {
    const res = await api("GET", "/keys");
    if (!Array.isArray(res)) return;
    for (const k of res) {
      const listed = app.keys.find((x) => x.siteKey === k.siteKey);
      if (!listed) continue;
      listed.solvesLast24h = k.solvesLast24h;
      listed.difference = k.difference;
    }
  } finally {
    busy = false;
  }
};

export const watchKeyCounts = (every) => {
  refresh();
  const timer = setInterval(refresh, every);
  const wake = () => !document.hidden && refresh();
  document.addEventListener("visibilitychange", wake);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", wake);
  };
};
