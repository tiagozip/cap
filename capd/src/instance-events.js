import { Elysia } from "elysia";
import { db } from "#db";
import { notifyInstance } from "./policy/webhooks.js";

const quoted = (v) => (v ? `"${String(v).slice(0, 80)}"` : "");
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const CHANGES = {
  "POST /keys": [
    "keys",
    (c) => `Created the site key ${quoted(c.body?.name || c.res?.siteKey)}`,
  ],
  "PUT /keys/:siteKey/config": [
    "keys",
    (c) => `Changed the settings of ${c.key}`,
  ],
  "DELETE /keys/:siteKey": ["keys", (c) => `Deleted the site key ${c.key}`],
  "POST /keys/:siteKey/rotate-secret": [
    "access",
    (c) => `Reset the secret of ${c.key}`,
  ],
  "PUT /keys/:siteKey/rules": ["keys", (c) => `Changed the rules of ${c.key}`],
  "POST /keys/:siteKey/shares": [
    "access",
    (c) => `Created a share link for ${c.key}`,
  ],
  "DELETE /keys/:siteKey/shares/:id": [
    "access",
    (c) => `Revoked a share link for ${c.key}`,
  ],
  "POST /keys/:siteKey/block-ip": [
    "keys",
    (c) => `Blocked ${c.body?.ip || c.body?.value || "an address"} on ${c.key}`,
  ],
  "POST /keys/:siteKey/unblock-ip": [
    "keys",
    (c) =>
      `Unblocked ${c.body?.ip || c.body?.value || "an address"} on ${c.key}`,
  ],
  "POST /keys/:siteKey/webhooks": [
    "keys",
    (c) => `Added a webhook to ${c.key}`,
  ],
  "PUT /keys/:siteKey/webhooks/:id": [
    "keys",
    (c) => `Changed a webhook on ${c.key}`,
  ],
  "DELETE /keys/:siteKey/webhooks/:id": [
    "keys",
    (c) => `Deleted a webhook from ${c.key}`,
  ],
  "POST /keys/:siteKey/webhooks/:id/rotate": [
    "access",
    (c) => `Rotated a webhook secret on ${c.key}`,
  ],
  "POST /lists": ["keys", (c) => `Created the list ${quoted(c.body?.name)}`],
  "PUT /lists/:id": ["keys", () => "Changed a list"],
  "DELETE /lists/:id": ["keys", () => "Deleted a list"],
  "POST /lists/:id/items": [
    "keys",
    (c) =>
      `Added ${count(c.body?.items?.length ?? 0, "entry", "entries")} to a list`,
  ],
  "DELETE /lists/:id/items": [
    "keys",
    (c) =>
      `Removed ${count(c.body?.items?.length ?? 0, "entry", "entries")} from a list`,
  ],
  "POST /settings/apikeys": [
    "access",
    (c) => `Created the API key ${quoted(c.body?.name)}`,
  ],
  "DELETE /settings/apikeys/:id": ["access", () => "Deleted an API key"],
  "POST /settings/webhooks": ["settings", () => "Added a server webhook"],
  "PUT /settings/webhooks/:id": ["settings", () => "Changed a server webhook"],
  "DELETE /settings/webhooks/:id": [
    "settings",
    () => "Deleted a server webhook",
  ],
  "POST /settings/webhooks/:id/rotate": [
    "access",
    () => "Rotated a server webhook secret",
  ],
  "PUT /settings/headers": [
    "settings",
    () => "Changed the visitor location headers",
  ],
  "PUT /settings/proxy-auth": [
    "access",
    () => "Changed the sign-in proxy settings",
  ],
  "POST /settings/proxy-auth/secret": [
    "access",
    () => "Reset the sign-in proxy secret",
  ],
  "PUT /settings/ratelimit": ["settings", () => "Changed the rate limits"],
  "PUT /settings/cors": ["settings", () => "Changed the CORS settings"],
  "PUT /settings/filtering": ["settings", () => "Changed IP filtering"],
  "POST /settings/ipdb/download": [
    "settings",
    () => "Downloaded the IP database",
  ],
  "DELETE /settings/ipdb": ["settings", () => "Removed the IP database"],
  "PUT /settings/assets": [
    "settings",
    () => "Changed where widget files come from",
  ],
  "PUT /settings/update-check": [
    "settings",
    () => "Changed the update check settings",
  ],
  "PUT /settings/login-background": [
    "settings",
    () => "Changed the login background",
  ],
  "PUT /settings/login-background/image": [
    "settings",
    () => "Uploaded a login background",
  ],
  "DELETE /settings/login-background/image": [
    "settings",
    () => "Removed the login background",
  ],
  "PUT /settings/analytics": [
    "settings",
    () => "Changed the analytics settings",
  ],
  "POST /oauth/requests/:id": [
    "access",
    (c) =>
      c.body?.allow
        ? `Connected an MCP app with ${c.body.access === "read" ? "read-only" : "full"} access`
        : "",
  ],
  "DELETE /oauth/grants/:id": ["access", () => "Disconnected an MCP app"],
};

async function actorOf(actor) {
  if (actor.type === "api") {
    const name = await db.hget(`apikey:${actor.id}`, "name").catch(() => "");
    return { type: "api", id: actor.id, name: name || actor.id };
  }
  if (actor.type === "mcp") {
    try {
      const grant = JSON.parse(
        (await db.get(`oauth:grant:${actor.grant}`)) || "{}",
      );
      return { type: "mcp", name: grant.clientName || "" };
    } catch {
      return { type: "mcp", name: "" };
    }
  }
  return { type: "dashboard", name: "Dashboard" };
}

export const instanceEvents = new Elysia({
  name: "instance-events",
}).onAfterResponse({ as: "global" }, async (ctx) => {
  const { request, route, actor, set } = ctx;
  if (!actor || request.method === "GET") return;
  const status = typeof set.status === "number" ? set.status : 200;
  const res = ctx.responseValue;
  if (status >= 400 || res?.success === false) return;
  const path = String(route ?? "").replace(/^\/server(?=\/)/, "");
  const change = CHANGES[`${request.method} ${path}`];
  if (!change) return;
  const siteKey = ctx.params?.siteKey;
  const name = siteKey
    ? (await db.hget(`key:${siteKey}`, "name").catch(() => "")) || ""
    : "";
  const [trigger, describe] = change;
  const summary = describe({
    body: ctx.body,
    res,
    params: ctx.params,
    key: name ? quoted(name) : siteKey,
  });
  if (!summary) return;
  await notifyInstance({
    trigger,
    summary,
    actor: await actorOf(actor),
    ...(siteKey && { siteKey, keyName: name }),
  }).catch(() => {});
});
