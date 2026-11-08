const ORIGINS = new Set(["https://trycap.dev", "http://localhost:5173", "http://localhost:4173"]);
const MAX_BODY = 96 * 1024;
const WEBHOOKS = [
  ["DISCORD_WEBHOOK_REPORTS", 60],
  ["DISCORD_WEBHOOK", 12],
];

const cors = (origin) => ({
  "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://trycap.dev",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const notify = async (env, now, embed) => {
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE created_at > ?")
    .bind(now - 3_600_000)
    .first("n");
  await Promise.all(
    WEBHOOKS.map(([name, perHour]) => {
      const url = env[name];
      if (!url || recent > perHour) return null;
      const footer = recent === perHour ? "Hourly cap reached for this channel, the rest are only in D1" : "cap-troubleshoot-reports";
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [{ ...embed, footer: { text: footer }, timestamp: new Date(now).toISOString() }] }),
      }).catch(() => null);
    }),
  );
};

const readJson = async (request, origin) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return { error: json({ error: "too_large" }, 413, origin) };
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object") return { error: json({ error: "invalid_body" }, 400, origin) };
    return { body, raw };
  } catch {
    return { error: json({ error: "invalid_json" }, 400, origin) };
  }
};

const handleReport = async (request, env, ctx, origin, ip) => {
  const { body, raw, error } = await readJson(request, origin);
  if (error) return error;
  if (typeof body.reason !== "string") return json({ error: "invalid_body" }, 400, origin);

  const cf = request.cf ?? {};
  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();
  const row = {
    reason: clip(body.reason, 80),
    blockedBy: Array.isArray(body.blockedBy) ? body.blockedBy.slice(0, 30).map((s) => clip(String(s), 60)) : [],
    agent: clip(body.agent, 80),
    userAgent: clip(request.headers.get("User-Agent"), 400),
    referrer: clip(body.referrer, 300),
    country: clip(cf.country, 4),
    asn: Number.isInteger(cf.asn) ? cf.asn : null,
    asOrg: clip(cf.asOrganization, 120),
    colo: clip(cf.colo, 8),
  };

  await env.DB.prepare(
    "INSERT INTO reports (id, created_at, reason, blocked_by, agent, user_agent, referrer, country, asn, as_org, colo, ip_hash, ip, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      now,
      row.reason,
      row.blockedBy.join(","),
      row.agent,
      row.userAgent,
      row.referrer,
      row.country,
      row.asn,
      row.asOrg,
      row.colo,
      ip ? await sha256(`${env.IP_SALT ?? ""}${ip}`) : null,
      clip(ip, 64),
      raw,
    )
    .run();

  ctx.waitUntil(
    notify(env, now, {
      title: `Troubleshooting report ${id}`,
      color: 0xf5b14c,
      fields: [
        { name: "Reason", value: row.reason, inline: true },
        row.agent && { name: "Agent", value: row.agent, inline: true },
        row.blockedBy.length && { name: "Checks", value: row.blockedBy.join(", ").slice(0, 1000) },
        { name: "Browser", value: row.userAgent || "unknown" },
        { name: "Network", value: `${ip || "?"} · ${row.country ?? "?"} · AS${row.asn ?? "?"} ${row.asOrg ?? ""}`.trim(), inline: true },
        row.referrer && { name: "Came from", value: row.referrer.slice(0, 1000), inline: true },
        Array.isArray(body.extensions) &&
          body.extensions.length && {
            name: "Extensions",
            value: body.extensions
              .slice(0, 200)
              .map((e) => clip(e?.name, 80))
              .filter(Boolean)
              .join(", ")
              .slice(0, 1000),
          },
      ].filter((f) => f?.value),
    }).catch(() => {}),
  );

  return json({ id }, 200, origin);
};

const handleDetails = async (request, env, ctx, origin) => {
  const { body, error } = await readJson(request, origin);
  if (error) return error;
  const id = clip(body.id, 16);
  if (!id || !/^[0-9a-f]{8}$/.test(id)) return json({ error: "invalid_id" }, 400, origin);
  const info = {
    browser: clip(body.browser, 120),
    device: clip(body.device, 120),
    deviceType: clip(body.deviceType, 20),
    os: clip(body.os, 120),
    extensions: Array.isArray(body.extensions)
      ? body.extensions
          .slice(0, 200)
          .map((e) => ({ id: clip(e?.id, 40), name: clip(e?.name, 80), via: clip(e?.via, 10) }))
          .filter((e) => e.name)
      : [],
    domUnknown: Array.isArray(body.domUnknown) ? body.domUnknown.slice(0, 20).map((n) => clip(n, 48)).filter(Boolean) : [],
    network: clip(body.network, 40),
    note: clip(body.note, 2000),
    contact: clip(body.contact, 200),
  };
  const now = Date.now();
  const res = await env.DB.prepare("UPDATE reports SET user_info = ? WHERE id = ? AND user_info IS NULL AND created_at > ?")
    .bind(JSON.stringify(info), id, now - 86_400_000)
    .run();
  if (!res.meta?.changes) return json({ error: "not_found" }, 404, origin);

  ctx.waitUntil(
    notify(env, now, {
      title: `Details for report ${id}`,
      color: 0x89b4fa,
      fields: [
        info.browser && { name: "Browser", value: info.browser, inline: true },
        info.device && { name: "Device", value: info.device, inline: true },
        info.os && { name: "System", value: info.os, inline: true },
        info.network && { name: "Network", value: info.network, inline: true },
        info.extensions.length && { name: "Extensions", value: info.extensions.map((e) => e.name).join(", ").slice(0, 1000) },
        info.domUnknown.length && { name: "Unknown page changes", value: info.domUnknown.join(", ").slice(0, 1000) },
        info.note && { name: "What happened", value: info.note.slice(0, 1000) },
        info.contact && { name: "Contact", value: info.contact },
      ].filter((f) => f?.value),
    }).catch(() => {}),
  );
  return json({ ok: true }, 200, origin);
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") ?? "";
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const route = { "/report": handleReport, "/details": handleDetails }[url.pathname];
    if (!route || request.method !== "POST") return json({ error: "not_found" }, 404, origin);
    if (!ORIGINS.has(origin)) return json({ error: "forbidden" }, 403, origin);

    const ip = request.headers.get("CF-Connecting-IP") ?? "";
    const { success } = await env.LIMIT.limit({ key: ip || "unknown" });
    if (!success) return json({ error: "rate_limited" }, 429, origin);

    return route(request, env, ctx, origin, ip);
  },
};
