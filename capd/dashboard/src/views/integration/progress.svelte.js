import { api, liveEvents, qs } from "../../lib/api.js";

const latest = async (siteKey, filters) => {
  const r = await api(
    "GET",
    `/keys/${siteKey}/events${qs({ range: "30d", limit: 1, f: filters })}`,
  );
  return Array.isArray(r?.events) ? (r.events[0] ?? null) : undefined;
};

export const watchProgress = (siteKey) => {
  const state = $state({ loaded: false, solve: null, verify: null, now: 0 });
  let busy = false;
  let again = false;
  let last = 0;
  let wait = null;

  const load = async () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    last = Date.now();
    const [solve, verify] = await Promise.all([
      latest(siteKey, [
        "type:redeem",
        "outcome:pass",
        `-origin:${location.host}`,
      ]),
      latest(siteKey, ["type:siteverify"]),
    ]);
    busy = false;
    if (solve !== undefined && verify !== undefined) {
      state.solve = solve;
      state.verify = verify;
      state.loaded = true;
    }
    state.now = Date.now();
    if (again) {
      again = false;
      queue();
    }
  };

  const queue = () => {
    if (wait) return;
    const gap = Math.max(0, 3000 - (Date.now() - last));
    wait = setTimeout(() => {
      wait = null;
      if (document.visibilityState === "visible") load();
    }, gap);
  };

  load();
  const stop = liveEvents(siteKey, queue);
  const tick = setInterval(() => {
    state.now = Date.now();
  }, 15_000);

  return {
    state,
    stop: () => {
      stop();
      clearInterval(tick);
      clearTimeout(wait);
    },
  };
};
