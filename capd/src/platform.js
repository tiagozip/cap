import { lookup } from "node:dns/promises";

export const runtime = "bun";
export const runtimeVersion = () => Bun.version;
export const uuidv7 = () => Bun.randomUUIDv7();
export const sleep = (ms) => Bun.sleep(ms);
export const defer = () => {};
export const every = (fn, ms) => setInterval(fn, ms).unref();
export const later = (fn, ms) => setTimeout(fn, ms).unref();
export const socketIp = (request, srv) =>
  srv?.requestIP?.(request)?.address || null;
export const requestGeo = () => null;
export const resolveHost = (host) =>
  lookup(host, { all: true, verbatim: true });
export const bufferEvents = true;
