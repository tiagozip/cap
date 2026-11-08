import { RedisClient } from "bun";
import { Elysia } from "elysia";
import { db } from "#db";
import { authBeforeHandle } from "./auth.js";
import { valkeyOptions, valkeyUrl } from "./config.js";
import { getClientIp } from "./events/context.js";
import { onFlush } from "./events/index.js";
import { scopeGuard } from "./guards.js";

const CHANNEL = "cap:live";
const AUTH_TIMEOUT_MS = 5_000;
const RECHECK_MS = 60_000;
const MAX_SOCKETS = 500;
const MAX_PENDING = 50;
const MAX_PENDING_PER_IP = 5;
const SITE_KEY = /^[a-z0-9]{1,64}$/;

const watchers = new Map();
const sockets = new Set();
const authed = new Set();
const pendingByIp = new Map();
let pendingTotal = 0;
let subscriber = null;

const notify = (keys) => {
  for (const key of keys) {
    for (const ws of watchers.get(key) ?? []) ws.send('{"type":"events"}');
  }
};

export async function startLive() {
  try {
    subscriber = new RedisClient(valkeyUrl(), valkeyOptions());
    await subscriber.subscribe(
      `${process.env.REDIS_PREFIX || ""}${CHANNEL}`,
      (message) => {
        try {
          notify(JSON.parse(message));
        } catch {}
      },
    );
  } catch (e) {
    subscriber = null;
    console.warn(
      "[cap] live events: Valkey pub/sub unavailable, only this instance's events are pushed:",
      e.message,
    );
  }
  onFlush((keys) => {
    if (!subscriber) return notify(keys);
    db.send("PUBLISH", [CHANNEL, JSON.stringify(keys)]).catch(() =>
      notify(keys),
    );
  });
}

export function stopLive() {
  for (const ws of sockets) ws.close(1001, "Server restarting");
  subscriber?.close();
  subscriber = null;
}

const authorize = async (authorization, siteKey, request) => {
  const ctx = {
    headers: { authorization },
    set: { headers: {} },
    request: { method: "GET", headers: request.headers },
    params: { siteKey },
  };
  const denied = await authBeforeHandle(ctx);
  if (denied) return false;
  return !scopeGuard({ ...ctx, scope: ctx.scope });
};

const release = (live) => {
  if (!live.pending) return;
  live.pending = false;
  pendingTotal--;
  const left = (pendingByIp.get(live.ip) ?? 1) - 1;
  if (left > 0) pendingByIp.set(live.ip, left);
  else pendingByIp.delete(live.ip);
};

const unwatch = (ws) => {
  const key = ws.data.live?.siteKey;
  if (!key) return;
  const set = watchers.get(key);
  set?.delete(ws);
  if (!set?.size) watchers.delete(key);
};

export const liveServer = new Elysia().ws("/server/live", {
  open(ws) {
    const ip =
      getClientIp(ws.data.request, ws.data.server) || ws.remoteAddress || "";
    if (
      pendingTotal >= MAX_PENDING ||
      (pendingByIp.get(ip) ?? 0) >= MAX_PENDING_PER_IP
    )
      return ws.close(1013, "Too many live connections");
    pendingTotal++;
    pendingByIp.set(ip, (pendingByIp.get(ip) ?? 0) + 1);
    sockets.add(ws);
    ws.data.live = {
      ip,
      pending: true,
      timer: setTimeout(() => ws.close(4001, "Unauthorized"), AUTH_TIMEOUT_MS),
    };
  },
  async message(ws, message) {
    const live = ws.data.live;
    if (!live || live.siteKey || live.checking) return;
    let data = message;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }
    const { authorization, siteKey } =
      typeof data === "object" && data ? data : {};
    if (
      typeof authorization !== "string" ||
      authorization.length > 2048 ||
      typeof siteKey !== "string" ||
      !SITE_KEY.test(siteKey)
    )
      return ws.close(4001, "Unauthorized");
    live.checking = true;
    if (!(await authorize(authorization, siteKey, ws.data.request)))
      return ws.close(4001, "Unauthorized");
    if (!(await db.sismember("keys", siteKey)))
      return ws.close(4004, "Site key not found");
    if (live.closed) return;
    if (authed.size >= MAX_SOCKETS)
      return ws.close(1013, "Too many live connections");
    release(live);
    authed.add(ws);
    clearTimeout(live.timer);
    live.siteKey = siteKey;
    live.recheck = setInterval(async () => {
      if (
        !(await authorize(authorization, siteKey, ws.data.request).catch(
          () => false,
        ))
      )
        ws.close(4001, "Unauthorized");
    }, RECHECK_MS);
    if (!watchers.has(siteKey)) watchers.set(siteKey, new Set());
    watchers.get(siteKey).add(ws);
    ws.send('{"type":"ready"}');
  },
  close(ws) {
    const live = ws.data.live;
    if (!live) return;
    live.closed = true;
    release(live);
    sockets.delete(ws);
    authed.delete(ws);
    clearTimeout(live.timer);
    clearInterval(live.recheck);
    unwatch(ws);
  },
});
