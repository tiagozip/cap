import * as session from "../../lib/api.js";

const ACRONYMS = new Set([
  "ip",
  "url",
  "api",
  "id",
  "asn",
  "mcp",
  "os",
  "cors",
]);

export const toolName = (name) => {
  const text = name
    .split("_")
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w === "ips" ? "IPs" : w))
    .join(" ");
  return text[0].toUpperCase() + text.slice(1);
};

let pending = null;

export const loadTools = () => {
  pending ??= fetch(session.url("mcp"), {
    method: "POST",
    headers: {
      Authorization: session.authHeader?.() ?? "",
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((r) =>
      Array.isArray(r?.result?.tools)
        ? r.result.tools.map((t) => ({
            name: t.name,
            title: toolName(t.name),
            description: t.description ?? "",
            write: t.annotations?.readOnlyHint === false,
            destructive: !!t.annotations?.destructiveHint,
          }))
        : [],
    )
    .catch(() => [])
    .then((tools) => {
      if (!tools.length) pending = null;
      return tools;
    });
  return pending;
};
