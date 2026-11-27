import { Elysia } from "elysia";
import { db } from "#db";
import pkg from "../package.json";
import { authBeforeHandle } from "./auth.js";
import { publicOrigin } from "./oauth.js";
import { logToolCall } from "./oauth-tokens.js";
import valkeyRateLimit from "./ratelimit.js";

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_TEXT = 100_000;

export const CATALOG = {
  "GET /server/keys": [
    "list_site_keys",
    "List site keys with their solves in the last 24 hours.",
  ],
  "POST /server/keys": [
    "create_site_key",
    "Create a site key. The response holds its secret key, which is shown only once.",
  ],
  "GET /server/keys/:siteKey": [
    "get_site_key",
    "Read a site key's settings and its solve chart.",
  ],
  "PUT /server/keys/:siteKey/config": [
    "update_site_key",
    "Change a site key's settings. Pass only the fields to change.",
  ],
  "DELETE /server/keys/:siteKey": [
    "delete_site_key",
    "Delete a site key. Its widgets stop working and this can't be undone.",
  ],
  "POST /server/keys/:siteKey/rotate-secret": [
    "rotate_secret_key",
    "Replace a site key's secret key. The old secret stops working right away.",
  ],
  "GET /server/keys/:siteKey/secret": [
    "get_secret_key",
    "Read a site key's secret key.",
  ],
  "GET /server/keys/:siteKey/geo-stats": [
    "get_geo_stats",
    "Read a site key's solves by country.",
  ],
  "GET /server/keys/:siteKey/shares": [
    "list_share_links",
    "List a site key's read-only stats links.",
  ],
  "POST /server/keys/:siteKey/shares": [
    "create_share_link",
    "Create a read-only link to a site key's stats. expiresIn is in seconds, 0 for never.",
  ],
  "DELETE /server/keys/:siteKey/shares/:id": [
    "delete_share_link",
    "Delete a stats link.",
  ],
  "POST /server/keys/:siteKey/block-ip": [
    "block_ip",
    "Block an IP or range for one site key. duration is in seconds. For blocks across keys, add to a list instead.",
  ],
  "POST /server/keys/:siteKey/unblock-ip": [
    "unblock_ip",
    "Remove an IP or range blocked with block_ip.",
  ],
  "GET /server/keys/:siteKey/blocked-ips": [
    "list_blocked_ips",
    "List the IPs and ranges blocked with block_ip.",
  ],
  "GET /server/keys/:siteKey/analytics": [
    "get_analytics",
    "Read totals and charts for a site key: solves, blocks, flags and failures.",
  ],
  "GET /server/keys/:siteKey/analytics/insights": [
    "get_insights",
    "Read notable changes in a site key's traffic, like spikes and new sources of blocks.",
  ],
  "GET /server/keys/:siteKey/analytics/top": [
    "get_top",
    "Read the top values for a site key by country, network, block reason, bot flag, AI agent, browser or OS.",
  ],
  "GET /server/keys/:siteKey/events": [
    "search_events",
    "List a site key's events, newest first.",
  ],
  "GET /server/keys/:siteKey/events/:id": [
    "get_event",
    "Read one event with every signal Cap recorded for it.",
  ],
  "GET /server/keys/:siteKey/analytics/movers": [
    "what_changed",
    "Find countries, networks, signals, agents, block reasons, browsers and rules whose volume moved most against the previous period, scaled for overall traffic.",
  ],
  "GET /server/keys/:siteKey/events/:id/context": [
    "get_event_context",
    "Read the history of an event's IP, network and visitor, the lists they are on and the rules that match the event now.",
  ],
  "GET /server/keys/:siteKey/analytics/checks": [
    "get_check_activity",
    "Read how often each risk signal and AI agent fired over a range, with blocks, a time series and the previous period's count.",
  ],
  "GET /server/lists/:id/hits": [
    "get_list_hits",
    "Read how much traffic each entry of a list matched across all keys, to find entries that are busy or never hit.",
  ],
  "GET /server/keys/:siteKey/rules/stats": [
    "get_rule_stats",
    "Read how often each rule matched over a range, with outcomes, a time series, unique IPs and the last hit.",
  ],
  "POST /server/keys/:siteKey/rules/preview": [
    "preview_rules",
    "Replay a draft rule list against recent traffic without saving it. Send the whole list like set_rules. Returns matches per rule and how many requests would be blocked or let through compared with the saved rules.",
  ],
  "GET /server/keys/:siteKey/rules": [
    "get_rules",
    "Read a site key's rules in the order Cap checks them.",
  ],
  "PUT /server/keys/:siteKey/rules": [
    "set_rules",
    "Replace a site key's rules. Read them with get_rules and the allowed fields with get_rule_catalog first, then send the whole list back.",
  ],
  "GET /server/policy/catalog": [
    "get_rule_catalog",
    "Read the fields, operators and actions that rules can use.",
  ],
  "GET /server/lists": [
    "list_lists",
    "List the shared lists that rules can reference.",
  ],
  "POST /server/lists": [
    "create_list",
    "Create a shared list, optionally with entries.",
  ],
  "GET /server/lists/:id": ["get_list", "Read a list and its entries."],
  "PUT /server/lists/:id": [
    "update_list",
    "Rename a list or change its description.",
  ],
  "DELETE /server/lists/:id": [
    "delete_list",
    "Delete a list. Rules that use it stop matching.",
  ],
  "POST /server/lists/:id/items": [
    "add_list_items",
    "Add entries to a list. kind is ip, cidr, asn, country, ua or visitor. ttl is in seconds.",
  ],
  "DELETE /server/lists/:id/items": [
    "remove_list_items",
    "Remove entries from a list.",
  ],
  "GET /server/keys/:siteKey/webhooks": [
    "list_webhooks",
    "List a site key's webhooks.",
  ],
  "POST /server/keys/:siteKey/webhooks": [
    "create_webhook",
    "Create a webhook. Set service to generic for signed JSON to your own URL, or to a service like discord, slack, telegram or ntfy with its config fields. GET /server/policy/catalog lists the services and their fields. triggers takes the ids in webhookTriggers from the catalog, and filters narrows them: rules, flags, agents and reasons take lists of ids, score takes 0.05 to 1, countries with exceptCountries limits by country. Set digest to a number of seconds to group events into one message, and min to skip summaries with fewer events. For generic webhooks the response holds the signing secret, shown only once.",
  ],
  "PUT /server/keys/:siteKey/webhooks/:id": [
    "update_webhook",
    "Change a webhook. Pass only the fields to change.",
  ],
  "DELETE /server/keys/:siteKey/webhooks/:id": [
    "delete_webhook",
    "Delete a webhook.",
  ],
  "POST /server/keys/:siteKey/webhooks/:id/test": [
    "test_webhook",
    "Send a test delivery to a webhook.",
  ],
  "POST /server/keys/:siteKey/webhooks/:id/rotate": [
    "rotate_webhook_secret",
    "Give a generic webhook a new signing secret. The response holds it, shown only once.",
  ],
  "POST /server/keys/:siteKey/webhooks/:id/resend": [
    "resend_webhook_event",
    "Send a stored event to a webhook again, by event ID.",
  ],
  "GET /server/keys/:siteKey/webhooks/:id/deliveries": [
    "list_webhook_deliveries",
    "List a webhook's recent deliveries and their responses.",
  ],
  "GET /server/settings/webhooks": [
    "list_server_webhooks",
    "List server webhooks, which post about sign-ins, changes and updates instead of traffic.",
  ],
  "POST /server/settings/webhooks": [
    "create_server_webhook",
    "Create a server webhook. Takes the same body as create_webhook, with triggers from webhookInstanceTriggers in the catalog. digest and filters are ignored.",
  ],
  "PUT /server/settings/webhooks/:id": [
    "update_server_webhook",
    "Change a server webhook. Pass only the fields to change.",
  ],
  "DELETE /server/settings/webhooks/:id": [
    "delete_server_webhook",
    "Delete a server webhook.",
  ],
  "POST /server/settings/webhooks/:id/test": [
    "test_server_webhook",
    "Send a test delivery to a server webhook.",
  ],
  "POST /server/settings/webhooks/:id/rotate": [
    "rotate_server_webhook_secret",
    "Give a generic server webhook a new signing secret. The response holds it, shown only once.",
  ],
  "GET /server/settings/webhooks/:id/deliveries": [
    "list_server_webhook_deliveries",
    "List a server webhook's recent deliveries and their responses.",
  ],
  "GET /server/settings/sessions": [
    "list_sessions",
    "List dashboard sign-in sessions.",
  ],
  "GET /server/settings/apikeys": ["list_api_keys", "List API keys."],
  "POST /server/settings/apikeys": [
    "create_api_key",
    "Create an API key, optionally limited to some site keys or read-only. The response holds the key, shown only once.",
  ],
  "DELETE /server/settings/apikeys/:id": [
    "delete_api_key",
    "Delete an API key.",
  ],
  "GET /server/settings/headers": [
    "get_ip_headers",
    "Read which request headers capd trusts for the visitor's IP, country and network.",
  ],
  "PUT /server/settings/headers": [
    "set_ip_headers",
    "Set which request headers capd trusts for the visitor's IP, country and network.",
  ],
  "GET /server/settings/proxy-auth": [
    "get_proxy_sign_in",
    "Read the proxy sign-in settings.",
  ],
  "GET /server/settings/ratelimit": [
    "get_rate_limit",
    "Read how many challenges a visitor can request per window.",
  ],
  "PUT /server/settings/ratelimit": [
    "set_rate_limit",
    "Set how many challenges a visitor can request per window. duration is in milliseconds.",
  ],
  "GET /server/settings/cors": [
    "get_cors",
    "Read which origins can call the challenge endpoints.",
  ],
  "PUT /server/settings/cors": [
    "set_cors",
    "Set which origins can call the challenge endpoints. null allows any origin.",
  ],
  "GET /server/settings/filtering": [
    "get_request_filtering",
    "Read the request filters applied before a challenge.",
  ],
  "PUT /server/settings/filtering": [
    "set_request_filtering",
    "Set the request filters applied before a challenge.",
  ],
  "GET /server/settings/ipdb": [
    "get_ip_database",
    "Read which IP location database capd uses.",
  ],
  "POST /server/settings/ipdb/download": [
    "download_ip_database",
    "Download an IP location database. mode is dbip, maxmind or ipinfo, and the last two need credentials.",
  ],
  "GET /server/settings/ipdb/progress": [
    "get_ip_database_progress",
    "Read the progress of an IP location database download.",
  ],
  "DELETE /server/settings/ipdb": [
    "delete_ip_database",
    "Remove the IP location database.",
  ],
  "GET /server/settings/assets": [
    "get_widget_files",
    "Read whether capd serves the widget files itself and which versions.",
  ],
  "PUT /server/settings/assets": [
    "set_widget_files",
    "Choose whether capd serves the widget files itself and which versions.",
  ],
  "POST /server/settings/assets/refresh": [
    "refresh_widget_files",
    "Download the chosen widget file versions again.",
  ],
  "GET /server/settings/assets/latest": [
    "get_latest_widget_versions",
    "Read the newest published widget versions.",
  ],
  "GET /server/settings/analytics": [
    "get_event_storage",
    "Read how long events are kept and how IPs are stored.",
  ],
  "PUT /server/settings/analytics": [
    "set_event_storage",
    "Set how long events are kept, how IPs are stored (full, truncate or none) and whether every challenge is logged.",
  ],
  "GET /server/settings/updates": [
    "get_update_notices",
    "Read whether a newer capd is out and whether a security advisory affects this server.",
  ],
  "GET /server/settings/update-check": [
    "get_update_check",
    "Read the update check settings and the anonymous report it sends.",
  ],
  "PUT /server/settings/update-check": [
    "set_update_check",
    "Turn the update check on or off and set how often it runs.",
  ],
  "GET /server/about": [
    "get_server_info",
    "Read the capd version and runtime.",
  ],
};

export const EXCLUDED = new Set([
  "POST /server/logout",
  "GET /server/api-docs",
  "PUT /server/settings/proxy-auth",
  "POST /server/settings/proxy-auth/secret",
  "GET /server/keys/:siteKey/events/export",
  "GET /server/settings/login-background",
  "PUT /server/settings/login-background",
  "PUT /server/settings/login-background/image",
  "DELETE /server/settings/login-background/image",
]);

const PARAMS = {
  siteKey: "Site key, from list_site_keys",
  id: "ID from the matching list call",
};

const QUERY = {
  range: "Time range, 24h by default",
  from: "Start as a Unix time in milliseconds, instead of range",
  to: "End as a Unix time in milliseconds, instead of range",
  f: "Filters as field:value, for example outcome:blocked or country:US",
  q: "Free-text search over IP, user agent and reason",
  dims: "Comma-separated dimensions: country, city, asn_org, flag, agent, reason, browser, os",
  limit: "How many rows to return",
  cursor: "Cursor from the previous page",
  chartDuration:
    "Chart range: today, yesterday, last7days, last28days, last91days or alltime",
};

const BODY_HINTS = {
  "POST /server/keys/:siteKey/webhooks": {
    type: "object",
    properties: {
      url: { type: "string", description: "https URL that receives events" },
      triggers: {
        type: "array",
        items: {
          type: "string",
          enum: ["block", "fail", "flagged", "agent", "rule", "all"],
        },
      },
      name: { type: "string" },
      enabled: { type: "boolean" },
    },
    required: ["url", "triggers"],
  },
};
BODY_HINTS["PUT /server/keys/:siteKey/webhooks/:id"] = {
  ...BODY_HINTS["POST /server/keys/:siteKey/webhooks"],
  required: [],
};

const clean = (schema) => {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(clean);
  if (schema.anyOf?.some((s) => s.format === "numeric"))
    return { type: "number" };
  const out = {};
  for (const [k, v] of Object.entries(schema))
    if (k !== "default" && k !== "format") out[k] = clean(v);
  if (out.anyOf?.every((s) => "const" in s))
    return { type: "string", enum: out.anyOf.map((s) => s.const) };
  return out;
};

const describe = (method, path, hooks) => {
  const key = `${method} ${path}`;
  const props = {};
  const required = [];
  const where = {};
  for (const [, p] of path.matchAll(/:(\w+)/g)) {
    props[p] = { type: "string", description: PARAMS[p] ?? p };
    required.push(p);
    where[p] = "path";
  }
  for (const [k, s] of Object.entries(hooks?.query?.properties ?? {})) {
    props[k] = { ...clean(s), ...(QUERY[k] && { description: QUERY[k] }) };
    where[k] = "query";
  }
  const body = BODY_HINTS[key] ?? clean(hooks?.body);
  const fields = body?.properties;
  if (fields && !Object.keys(fields).some((k) => k in props)) {
    for (const [k, s] of Object.entries(fields)) {
      props[k] = s;
      where[k] = "body";
    }
    required.push(...(body.required ?? []));
  } else if (body && method !== "GET") {
    props.body = { type: "object", description: "Request body" };
    where.body = "raw";
  }
  return {
    inputSchema: {
      type: "object",
      properties: props,
      required,
      additionalProperties: false,
    },
    where,
    body: fields ? body : null,
  };
};

const routeList = (app) =>
  app.routes.filter(
    (r) => r.path.startsWith("/server/") && r.method !== "OPTIONS",
  );

export function buildTools(app) {
  return routeList(app)
    .filter((r) => CATALOG[`${r.method} ${r.path}`])
    .map((r) => {
      const [name, description] = CATALOG[`${r.method} ${r.path}`];
      const { inputSchema, where, body } = describe(r.method, r.path, r.hooks);
      return {
        name,
        description,
        inputSchema,
        method: r.method,
        path: r.path,
        tag: r.hooks?.detail?.tags?.[0] ?? "Other",
        body,
        where,
        write: r.method !== "GET",
        call: (args) => {
          const path = r.path.replace(/:(\w+)/g, (_, p) =>
            encodeURIComponent(String(args[p])),
          );
          const qs = new URLSearchParams();
          let payload;
          for (const [k, v] of Object.entries(args)) {
            if (v === undefined || v === null) continue;
            if (where[k] === "query")
              for (const x of [v].flat()) qs.append(k, String(x));
            if (where[k] === "body") payload = { ...payload, [k]: v };
            if (where[k] === "raw") payload = v;
          }
          if (r.method !== "GET" && !payload && r.hooks?.body) payload = {};
          const query = qs.toString();
          return [r.method, `${path}${query ? `?${query}` : ""}`, payload];
        },
      };
    });
}

const typeOf = (s) => {
  if (!s) return "any";
  if (s.enum) return s.enum.map((v) => `"${v}"`).join(" | ");
  if (s.anyOf) return s.anyOf.map(typeOf).join(" | ");
  if (s.type === "array") return `${typeOf(s.items)}[]`;
  if (s.type === "object" && s.properties)
    return `{ ${Object.entries(s.properties)
      .map(
        ([k, v]) => `${k}${s.required?.includes(k) ? "" : "?"}: ${typeOf(v)}`,
      )
      .join(", ")} }`;
  if (
    s.type === "number" &&
    (s.minimum !== undefined || s.maximum !== undefined)
  )
    return `number, ${s.minimum ?? "any"} to ${s.maximum ?? "any"}`;
  return s.type ?? "any";
};

export function apiDocs(app, base) {
  const tools = buildTools(app);
  const lines = [
    "# capd API",
    "",
    `Base URL: ${base}`,
    "",
    "Every request needs an API key in the Authorization header: `Authorization: Bot <api-key>`. Create one under API and MCP in the capd dashboard. Requests and responses are JSON.",
    "",
    "AI agents that speak MCP can use the MCP server at `/mcp` instead. It has a tool for each endpoint below and signs agents in with OAuth.",
    "",
    `Example: \`curl ${base}/keys -H "Authorization: Bot <api-key>"\``,
  ];
  let tag = null;
  for (const t of [...tools].sort((a, b) => a.tag.localeCompare(b.tag))) {
    if (t.tag !== tag) {
      tag = t.tag;
      lines.push("", `## ${tag}`);
    }
    lines.push(
      "",
      `### ${t.method} ${t.path.replace(/^\/server/, "")}`,
      "",
      t.description,
    );
    for (const [part, title] of [
      ["path", "Path"],
      ["query", "Query string"],
      ["body", "JSON body"],
      ["raw", "JSON body"],
    ]) {
      const params = Object.entries(t.inputSchema.properties).filter(
        ([k]) => t.where[k] === part,
      );
      if (!params.length) continue;
      lines.push("", `${title}:`, "");
      for (const [k, s] of params)
        lines.push(
          `- \`${k}\` ${typeOf(s)}${t.inputSchema.required.includes(k) ? ", required" : ""}${s.description ? `. ${s.description}` : ""}`,
        );
    }
  }
  return `${lines.join("\n")}\n`;
}

const INSTRUCTIONS =
  "These tools manage this capd server: site keys, their settings and secrets, analytics, events, rules, shared lists, webhooks, API keys and instance settings. Site keys are short hex IDs, so call list_site_keys first. Ask before deleting anything or rotating secrets. If you need to know how a setting, rule field, signal or error code behaves and the tool descriptions don't say, clone the source with `git clone --depth 1 https://github.com/tiagozip/cap` and search capd/src and core/src with rg instead of guessing. The code is always current.";

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

export function mcpServer(getApp) {
  let used = false;
  let tools = null;
  const toolMap = () => {
    tools ??= new Map(buildTools(getApp()).map((t) => [t.name, t]));
    return tools;
  };

  const callApi = async (authorization, method, path, body) => {
    const res = await getApp().handle(
      new Request(`http://capd.internal${path}`, {
        method,
        headers: {
          authorization,
          ...(body !== undefined && { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  };

  const handle = async (msg, { authorization, scope }) => {
    if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string")
      return fail(msg?.id, -32600, "Invalid request");
    const { id, method, params } = msg;
    if (id === undefined) return null;
    if (method === "initialize") {
      const asked = params?.protocolVersion;
      return ok(id, {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "capd", version: pkg.version },
        instructions: INSTRUCTIONS,
      });
    }
    if (method === "ping") return ok(id, {});
    if (method === "tools/list")
      return ok(id, {
        tools: [...toolMap().values()]
          .filter((t) => !(scope?.readonly && t.write))
          .map(({ name, description, inputSchema, write, method: m }) => ({
            name,
            description,
            inputSchema,
            title: name[0].toUpperCase() + name.slice(1).replaceAll("_", " "),
            annotations: {
              readOnlyHint: !write,
              destructiveHint: m === "DELETE",
              idempotentHint: m !== "POST",
            },
          })),
      });
    if (method === "tools/call") {
      const tool = toolMap().get(params?.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`);
      const args = params.arguments ?? {};
      const missing = tool.inputSchema.required.find(
        (k) => args[k] === undefined || args[k] === null || args[k] === "",
      );
      if (missing)
        return ok(id, {
          content: [{ type: "text", text: `Missing argument: ${missing}` }],
          isError: true,
        });
      if (!used) {
        used = true;
        db.send("SET", ["usage:mcp", "1", "EX", "2592000"]).catch(() => {});
      }
      const r = await callApi(authorization, ...tool.call(args));
      if (scope?.grant)
        logToolCall(scope.grant, {
          t: Date.now(),
          tool: tool.name,
          status: r.status,
          ...(typeof args.siteKey === "string" && {
            siteKey: args.siteKey.slice(0, 64),
          }),
        }).catch(() => {});
      const text = r.text || `HTTP ${r.status}`;
      return ok(id, {
        content: [
          {
            type: "text",
            text:
              text.length > MAX_TEXT
                ? `${text.slice(0, MAX_TEXT)}\n\nThe response was cut at ${MAX_TEXT.toLocaleString("en")} characters. Ask for less with filters, a shorter range or a lower limit.`
                : text,
          },
        ],
        isError: !r.ok,
      });
    }
    return fail(id, -32601, `Method not found: ${method}`);
  };

  const challenge = async (ctx) => {
    const res = await authBeforeHandle(ctx);
    if (res)
      ctx.set.headers["www-authenticate"] =
        `Bearer resource_metadata="${publicOrigin(ctx.request)}/.well-known/oauth-protected-resource/mcp"`;
    return res;
  };

  return new Elysia({ detail: { hide: true } })
    .use(valkeyRateLimit({ max: 60, duration: 10_000 }))
    .onBeforeHandle(({ headers }) => {
      const token = headers.authorization?.match(
        /^Bearer\s+(?!capo_)([^\s_]+_[^\s_]+)$/,
      )?.[1];
      if (token) headers.authorization = `Bot ${token}`;
    })
    .onBeforeHandle(challenge)
    .get("/server/api-docs", ({ request, set }) => {
      set.headers["content-type"] = "text/markdown; charset=utf-8";
      return apiDocs(getApp(), `${publicOrigin(request)}/server`);
    })
    .post("/mcp", async ({ body, headers, scope, set }) => {
      const ctx = { authorization: headers.authorization, scope };
      if (Array.isArray(body)) {
        const out = (await Promise.all(body.map((m) => handle(m, ctx)))).filter(
          Boolean,
        );
        if (!out.length) {
          set.status = 202;
          return "";
        }
        return out;
      }
      const res = await handle(body, ctx);
      if (!res) {
        set.status = 202;
        return "";
      }
      return res;
    })
    .get("/mcp", ({ set }) => {
      set.status = 405;
      set.headers.allow = "POST";
      return {
        success: false,
        error: "This MCP server answers POST requests only.",
      };
    });
}
