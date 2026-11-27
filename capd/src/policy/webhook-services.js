import { reasonLabel } from "./reasons.js";
import { KNOWN_AGENTS, SIGNAL_GROUPS } from "./signals.js";

const text = (key, label, extra) => ({ key, label, kind: "text", ...extra });
const secret = (key, label, extra) => ({
  key,
  label,
  kind: "secret",
  ...extra,
});
const link = (key, label, extra) => ({ key, label, kind: "url", ...extra });
const choice = (key, label, options, extra) => ({
  key,
  label,
  kind: "select",
  options,
  value: options[0][0],
  ...extra,
});

const hookUrl = (label, placeholder, pattern, hint) =>
  secret("url", label, { placeholder, pattern, hint, wide: true });

const host = (raw) => {
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
};
const base = (raw) => String(raw ?? "").replace(/\/+$/, "");
const list = (raw) =>
  String(raw ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const json = (url, body, headers = {}, method = "POST") => ({
  url,
  method,
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});
const form = (url, fields, headers = {}) => ({
  url,
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    ...headers,
  },
  body: new URLSearchParams(fields).toString(),
});
const basic = (user, pass) => `Basic ${btoa(`${user}:${pass}`)}`;
const escapeHtml = (s) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
export const MESSAGE_COLORS = {
  danger: 0xe5484d,
  warning: 0xf5a524,
  info: 0x3e8bff,
};
const COLORS = MESSAGE_COLORS;
const hex = (n) => n.toString(16).padStart(6, "0");

const PRIORITY = [
  ["default", "Default"],
  ["high", "High"],
  ["low", "Low"],
];

export const WEBHOOK_SERVICES = {
  generic: {
    name: "Webhook",
    blurb: "Signed JSON to your own endpoint",
    fields: [],
  },
  discord: {
    name: "Discord",
    blurb: "A channel webhook",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://discord.com/api/webhooks/…",
        "^https://(?:(?:ptb|canary)\\.)?discord(?:app)?\\.com/api/webhooks/\\d+/[\\w-]+",
        "Channel settings > Integrations > Webhooks > Copy webhook URL",
      ),
      text("mention", "Mention", {
        optional: true,
        placeholder: "<@&role id> or @here",
        maxLength: 80,
      }),
    ],
    label: () => "Discord channel",
    build: (c, m) => [
      json(c.url, {
        username: "Cap",
        content: c.mention || undefined,
        allowed_mentions: { parse: ["roles", "users", "everyone"] },
        embeds: [
          {
            title: clip(m.title, 256),
            description: clip(m.text, 4000),
            color: COLORS[m.level],
            fields: m.fields.slice(0, 25).map(([name, value]) => ({
              name: clip(name, 256),
              value: clip(value, 1024),
              inline: value.length < 40,
            })),
            timestamp: new Date(m.at).toISOString(),
            footer: { text: m.footer },
          },
        ],
      }),
    ],
  },
  slack: {
    name: "Slack",
    blurb: "An incoming webhook",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://hooks.slack.com/services/…",
        "^https://hooks\\.slack\\.com/(?:services|workflows|triggers)/",
        "Slack app settings > Incoming webhooks",
      ),
    ],
    label: () => "Slack channel",
    build: (c, m) => [
      json(c.url, {
        text: `${m.title}\n${m.plain}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: clip(`*${m.title}*\n${m.text}`, 3000),
            },
          },
          ...(m.fields.length
            ? [
                {
                  type: "section",
                  fields: m.fields.slice(0, 10).map(([k, v]) => ({
                    type: "mrkdwn",
                    text: clip(`*${k}*\n${v}`, 2000),
                  })),
                },
              ]
            : []),
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: m.footer }],
          },
        ],
      }),
    ],
  },
  teams: {
    name: "Microsoft Teams",
    blurb: "A Workflows webhook",
    fields: [
      hookUrl(
        "Workflow URL",
        "https://….logic.azure.com/workflows/…",
        "^https://[\\w.-]+\\.(?:logic\\.azure\\.com|webhook\\.office\\.com|powerplatform\\.com|powerautomate\\.com)(?::443)?/",
        "Channel > Workflows > Post to a channel when a webhook request is received",
      ),
    ],
    label: () => "Teams channel",
    build: (c, m) => [
      json(c.url, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                {
                  type: "TextBlock",
                  text: m.title,
                  weight: "Bolder",
                  size: "Medium",
                  wrap: true,
                },
                { type: "TextBlock", text: m.plain, wrap: true },
                {
                  type: "FactSet",
                  facts: m.fields.map(([title, value]) => ({ title, value })),
                },
              ],
            },
          },
        ],
      }),
    ],
  },
  googlechat: {
    name: "Google Chat",
    blurb: "A space webhook",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://chat.googleapis.com/v1/spaces/…",
        "^https://chat\\.googleapis\\.com/v1/spaces/",
        "Space > Apps and integrations > Webhooks",
      ),
    ],
    label: () => "Google Chat space",
    build: (c, m) => [json(c.url, { text: `*${m.title}*\n${m.text}` })],
  },
  telegram: {
    name: "Telegram",
    blurb: "A bot that posts to chats",
    fields: [
      secret("token", "Bot token", {
        placeholder: "123456:ABC-DEF…",
        pattern: "^\\d+:[\\w-]{20,}$",
        hint: "From @BotFather",
      }),
      text("chats", "Chat IDs", {
        placeholder: "-1001234567890, @channel",
        hint: "Separate several with commas. Add the bot to each chat first.",
        pattern: "^[\\s,@\\w-]+$",
      }),
      text("thread", "Topic ID", {
        optional: true,
        placeholder: "42",
        pattern: "^\\d+$",
      }),
    ],
    label: (c) => list(c.chats).join(", "),
    build: (c, m) =>
      list(c.chats).map((chat) =>
        json(`https://api.telegram.org/bot${c.token}/sendMessage`, {
          chat_id: chat,
          message_thread_id: c.thread ? Number(c.thread) : undefined,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          text: clip(
            `<b>${escapeHtml(m.title)}</b>\n${escapeHtml(m.plain)}\n\n${m.fields
              .map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`)
              .join("\n")}`,
            4096,
          ),
        }),
      ),
  },
  ntfy: {
    name: "ntfy",
    blurb: "Push to a topic",
    fields: [
      link("server", "Server", { value: "https://ntfy.sh" }),
      text("topic", "Topic", {
        placeholder: "cap-alerts",
        pattern: "^[\\w-]{1,64}$",
      }),
      secret("token", "Access token", { optional: true, placeholder: "tk_…" }),
      choice("priority", "Priority", PRIORITY),
    ],
    label: (c) => `${host(c.server)}/${c.topic}`,
    build: (c, m) => [
      json(
        `${base(c.server)}/`,
        {
          topic: c.topic,
          title: m.title,
          message: `${m.plain}\n${m.fields.map(([k, v]) => `${k}: ${v}`).join("\n")}`,
          priority: { low: 2, default: 3, high: 4 }[c.priority] ?? 3,
          tags: [m.level === "danger" ? "no_entry" : "warning"],
        },
        c.token ? { authorization: `Bearer ${c.token}` } : {},
      ),
    ],
  },
  pushover: {
    name: "Pushover",
    blurb: "Push to your devices",
    fields: [
      secret("token", "Application token", { pattern: "^\\w{30}$" }),
      secret("user", "User or group key", { pattern: "^\\w{30}$" }),
      text("device", "Devices", {
        optional: true,
        placeholder: "All devices",
        hint: "Device names, separated by commas",
      }),
      choice("priority", "Priority", PRIORITY),
    ],
    label: (c) => (c.device ? `Pushover, ${c.device}` : "Pushover"),
    build: (c, m) => [
      json("https://api.pushover.net/1/messages.json", {
        token: c.token,
        user: c.user,
        device: c.device || undefined,
        title: clip(m.title, 250),
        message: clip(m.body, 1024),
        priority: { low: -1, default: 0, high: 1 }[c.priority] ?? 0,
        timestamp: Math.floor(m.at / 1000),
      }),
    ],
  },
  gotify: {
    name: "Gotify",
    blurb: "Push to your Gotify server",
    fields: [
      link("server", "Server", { placeholder: "https://gotify.example.com" }),
      secret("token", "Application token"),
      choice("priority", "Priority", PRIORITY),
    ],
    label: (c) => host(c.server),
    build: (c, m) => [
      json(
        `${base(c.server)}/message`,
        {
          title: m.title,
          message: m.body,
          priority: { low: 2, default: 5, high: 8 }[c.priority] ?? 5,
        },
        { "x-gotify-key": c.token },
      ),
    ],
  },
  matrix: {
    name: "Matrix",
    blurb: "Post to a room",
    fields: [
      link("server", "Homeserver", { placeholder: "https://matrix.org" }),
      secret("token", "Access token"),
      text("room", "Room ID", {
        placeholder: "!abcdef:matrix.org",
        pattern: "^![\\w.=-]+:[\\w.:-]+$",
        hint: "Room settings > Advanced. Invite the account first.",
      }),
    ],
    label: (c) => c.room,
    build: (c, m) => [
      json(
        `${base(c.server)}/_matrix/client/v3/rooms/${encodeURIComponent(c.room)}/send/m.room.message/cap${m.at}${Math.random().toString(36).slice(2, 8)}`,
        {
          msgtype: "m.notice",
          body: `${m.title}\n${m.body}`,
          format: "org.matrix.custom.html",
          formatted_body: `<b>${escapeHtml(m.title)}</b><br>${escapeHtml(m.body).replace(/\n/g, "<br>")}`,
        },
        { authorization: `Bearer ${c.token}` },
        "PUT",
      ),
    ],
  },
  mattermost: {
    name: "Mattermost",
    blurb: "An incoming webhook",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://chat.example.com/hooks/…",
        "^https?://[^/]+/hooks/\\w+",
      ),
      text("channel", "Channel", {
        optional: true,
        placeholder: "town-square",
      }),
    ],
    label: (c) => (c.channel ? `${host(c.url)} #${c.channel}` : host(c.url)),
    build: (c, m) => [
      json(c.url, {
        username: "Cap",
        channel: c.channel || undefined,
        text: `#### ${m.title}\n${m.text}\n${m.fields.map(([k, v]) => `**${k}:** ${v}`).join("\n")}`,
      }),
    ],
  },
  rocketchat: {
    name: "Rocket.Chat",
    blurb: "An incoming webhook",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://chat.example.com/hooks/…",
        "^https?://[^/]+/hooks/[\\w/-]+",
      ),
      text("channel", "Channel", { optional: true, placeholder: "#general" }),
    ],
    label: (c) => host(c.url),
    build: (c, m) => [
      json(c.url, {
        alias: "Cap",
        channel: c.channel || undefined,
        text: `*${m.title}*\n${m.text}`,
        attachments: m.fields.length
          ? [
              {
                color: `#${hex(COLORS[m.level])}`,
                fields: m.fields.map(([title, value]) => ({
                  title,
                  value,
                  short: value.length < 40,
                })),
              },
            ]
          : undefined,
      }),
    ],
  },
  zulip: {
    name: "Zulip",
    blurb: "Post to a channel topic",
    fields: [
      link("server", "Server", {
        placeholder: "https://example.zulipchat.com",
      }),
      text("email", "Bot email", {
        placeholder: "cap-bot@example.zulipchat.com",
      }),
      secret("key", "Bot API key"),
      text("stream", "Channel", { placeholder: "alerts" }),
      text("topic", "Topic", { value: "Cap" }),
    ],
    label: (c) => `#${c.stream} > ${c.topic || "Cap"}`,
    build: (c, m) => [
      form(
        `${base(c.server)}/api/v1/messages`,
        {
          type: "stream",
          to: c.stream,
          topic: c.topic || "Cap",
          content: `**${m.title}**\n${m.text}\n${m.fields.map(([k, v]) => `**${k}:** ${v}`).join("\n")}`,
        },
        { authorization: basic(c.email, c.key) },
      ),
    ],
  },
  lark: {
    name: "Lark",
    blurb: "A Lark or Feishu bot",
    fields: [
      hookUrl(
        "Webhook URL",
        "https://open.larksuite.com/open-apis/bot/v2/hook/…",
        "^https://open\\.(?:larksuite\\.com|feishu\\.cn)/open-apis/bot/v2/hook/[\\w-]+",
      ),
      secret("sign", "Signing secret", {
        optional: true,
        hint: "Only if signature verification is on for the bot",
      }),
    ],
    label: () => "Lark group",
    build: async (c, m) => {
      const timestamp = String(Math.floor(m.at / 1000));
      let sign;
      if (c.sign) {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(`${timestamp}\n${c.sign}`),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const mac = await crypto.subtle.sign("HMAC", key, new Uint8Array());
        sign = btoa(String.fromCharCode(...new Uint8Array(mac)));
      }
      return [
        json(c.url, {
          ...(sign && { timestamp, sign }),
          msg_type: "text",
          content: { text: `${m.title}\n${m.body}` },
        }),
      ];
    },
  },
  pushbullet: {
    name: "Pushbullet",
    blurb: "Push to devices or a channel",
    fields: [
      secret("token", "Access token", { placeholder: "o.…" }),
      text("target", "Send to", {
        optional: true,
        placeholder: "All devices",
        hint: "A device ID, an email address or #channel",
      }),
    ],
    label: (c) => c.target || "All devices",
    build: (c, m) => {
      const t = c.target ?? "";
      const to = t.startsWith("#")
        ? { channel_tag: t.slice(1) }
        : t.includes("@")
          ? { email: t }
          : t
            ? { device_iden: t }
            : {};
      return [
        json(
          "https://api.pushbullet.com/v2/pushes",
          { type: "note", title: m.title, body: m.body, ...to },
          { "access-token": c.token },
        ),
      ];
    },
  },
  bark: {
    name: "Bark",
    blurb: "Push to an iPhone",
    fields: [
      link("server", "Server", { value: "https://api.day.app" }),
      secret("device", "Device key"),
    ],
    label: (c) => host(c.server),
    build: (c, m) => [
      json(`${base(c.server)}/push`, {
        device_key: c.device,
        title: m.title,
        body: m.body,
        group: "Cap",
      }),
    ],
  },
  join: {
    name: "Join",
    blurb: "Push to Android devices",
    fields: [
      secret("key", "API key"),
      text("devices", "Device IDs", {
        value: "group.all",
        hint: "Separate several with commas",
      }),
    ],
    label: (c) => c.devices,
    build: (c, m) => [
      {
        url: `https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush?${new URLSearchParams(
          {
            apikey: c.key,
            deviceIds: list(c.devices).join(","),
            title: m.title,
            text: m.body,
          },
        )}`,
        method: "GET",
        headers: {},
      },
    ],
  },
  ifttt: {
    name: "IFTTT",
    blurb: "Trigger an applet",
    fields: [
      secret("key", "Webhooks key", {
        hint: "From the Webhooks service settings",
      }),
      text("event", "Event name", {
        placeholder: "cap_alert",
        pattern: "^[\\w-]+$",
      }),
    ],
    label: (c) => c.event,
    build: (c, m) => [
      json(
        `https://maker.ifttt.com/trigger/${encodeURIComponent(c.event)}/with/key/${encodeURIComponent(c.key)}`,
        { value1: m.title, value2: m.plain, value3: m.footer },
      ),
    ],
  },
  opsgenie: {
    name: "Opsgenie",
    blurb: "Open an alert",
    fields: [
      secret("key", "API key", { hint: "From an API integration" }),
      choice("region", "Region", [
        ["us", "US"],
        ["eu", "EU"],
      ]),
      choice("priority", "Priority", [
        ["P3", "P3, moderate"],
        ["P1", "P1, critical"],
        ["P2", "P2, high"],
        ["P4", "P4, low"],
        ["P5", "P5, informational"],
      ]),
    ],
    label: (c) => `Opsgenie ${c.region === "eu" ? "EU" : "US"}`,
    build: (c, m) => [
      json(
        `https://api.${c.region === "eu" ? "eu." : ""}opsgenie.com/v2/alerts`,
        {
          message: clip(m.title, 130),
          description: clip(m.body, 15000),
          alias: m.alias,
          source: "Cap",
          tags: ["cap"],
          priority: c.priority || "P3",
          details: Object.fromEntries(m.fields),
        },
        { authorization: `GenieKey ${c.key}` },
      ),
    ],
  },
  pagerduty: {
    name: "PagerDuty",
    blurb: "Trigger an incident",
    fields: [
      secret("key", "Integration key", {
        hint: "From an Events API v2 integration",
        pattern: "^\\w{32}$",
      }),
      choice("severity", "Severity", [
        ["warning", "Warning"],
        ["critical", "Critical"],
        ["error", "Error"],
        ["info", "Info"],
      ]),
    ],
    label: () => "PagerDuty service",
    build: (c, m) => [
      json("https://events.pagerduty.com/v2/enqueue", {
        routing_key: c.key,
        event_action: "trigger",
        dedup_key: m.alias,
        payload: {
          summary: clip(`${m.title}: ${m.plain}`, 1024),
          source: m.source,
          severity: c.severity || "warning",
          timestamp: new Date(m.at).toISOString(),
          component: "cap",
          custom_details: Object.fromEntries(m.fields),
        },
      }),
    ],
  },
  twilio: {
    name: "Twilio",
    blurb: "Text message",
    fields: [
      text("sid", "Account SID", { pattern: "^AC[0-9a-fA-F]{32}$" }),
      secret("token", "Auth token"),
      text("from", "From number", {
        placeholder: "+15551234567",
        pattern: "^\\+?[\\d\\s-]{6,}$|^MG[0-9a-fA-F]{32}$",
      }),
      text("to", "To numbers", {
        placeholder: "+15557654321",
        hint: "Separate several with commas. Group events so you don't pay for one text each.",
        pattern: "^[\\d\\s,+-]+$",
      }),
    ],
    label: (c) => list(c.to).join(", "),
    build: (c, m) =>
      list(c.to).map((to) =>
        form(
          `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`,
          {
            To: to,
            ...(c.from.startsWith("MG")
              ? { MessagingServiceSid: c.from }
              : { From: c.from }),
            Body: clip(`${m.title}\n${m.plain}`, 1600),
          },
          { authorization: basic(c.sid, c.token) },
        ),
      ),
  },
  notifiarr: {
    name: "Notifiarr",
    blurb: "Relay to Discord",
    fields: [
      secret("key", "API key"),
      text("channel", "Discord channel ID", { pattern: "^\\d{15,21}$" }),
    ],
    label: (c) => `Channel ${c.channel}`,
    build: (c, m) => {
      const body = JSON.stringify({
        notification: { update: false, name: "Cap", event: "" },
        discord: {
          color: hex(COLORS[m.level]),
          text: {
            title: m.title,
            description: m.plain,
            fields: m.fields
              .slice(0, 25)
              .map(([title, value]) => ({ title, text: value, inline: true })),
            footer: m.footer,
          },
          ids: { channel: "@@channel@@" },
        },
      }).replace('"@@channel@@"', c.channel);
      return [
        {
          url: `https://notifiarr.com/api/v1/notification/passthrough/${encodeURIComponent(c.key)}`,
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
      ];
    },
  },
};

export const SERVICE_IDS = Object.keys(WEBHOOK_SERVICES);

const OUTCOME_TITLES = {
  block: "Blocked",
  fail: "Failed",
  limit: "Rate limited",
  pass: "Passed",
};
const TYPE_NAMES = {
  challenge: "challenge",
  redeem: "solve",
  siteverify: "token check",
};

const place = (e) => [e.city, e.country].filter(Boolean).join(", ");

const FLAG_TEXT = Object.fromEntries(
  SIGNAL_GROUPS.flatMap((g) => g.signals.map(([id, text]) => [id, text])),
);
const AGENT_TEXT = Object.fromEntries(KNOWN_AGENTS);
const agentText = (id) => AGENT_TEXT[id] ?? id;
const flagText = (id) => FLAG_TEXT[id] ?? id;
const reasonText = (r) =>
  r?.startsWith("signal:") ? flagText(r.slice(7)) : reasonLabel(r);

function eventTitle(e) {
  if (e.agent) return `AI agent: ${agentText(e.agent)}`;
  if (e.type === "redeem" && e.outcome === "pass" && e.flags?.length)
    return "Solve with risk flags";
  return `${OUTCOME_TITLES[e.outcome] ?? e.outcome} ${TYPE_NAMES[e.type] ?? e.type ?? "event"}`;
}

const ruleText = (id, names) =>
  names?.[id] ? `Rule "${names[id]}"` : `Rule ${id}`;

function eventFields(e, names) {
  return [
    ["Reason", e.rule ? ruleText(e.rule, names) : reasonText(e.reason)],
    ["IP", e.ip && (place(e) ? `${e.ip} (${place(e)})` : e.ip)],
    ["Network", e.asn_org],
    ["Site", e.origin],
    ["Browser", [e.browser, e.os].filter(Boolean).join(" on ")],
    ["Flags", e.flags?.length ? e.flags.map(flagText).join("; ") : ""],
    ["Score", e.score == null ? "" : Number(e.score).toFixed(2)],
  ].filter(([, v]) => v);
}

const counts = (rows, pick) => {
  const m = new Map();
  for (const r of rows) {
    const k = pick(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => `${k} (${n})`)
    .join(", ");
};

export function formatMessage(payload, { keyName, dashboard, ruleNames } = {}) {
  if (payload.type === "cap.update" || payload.type === "cap.security") {
    const advisories = payload.advisories ?? [];
    const security = payload.type === "cap.security";
    const prefix = payload.test ? "Test: " : "";
    const latest = payload.latest?.version;
    return finish({
      title: security
        ? `${prefix}${advisories.length === 1 ? "A security advisory affects" : `${advisories.length} security advisories affect`} capd ${payload.current}`
        : `${prefix}capd ${latest} is out`,
      plain: security
        ? advisories
            .slice(0, 5)
            .map(
              (a) =>
                `${a.severity ? `${a.severity[0].toUpperCase()}${a.severity.slice(1)}: ` : ""}${a.summary}${a.fixedIn ? ` Fixed in ${a.fixedIn}.` : ""}`,
            )
            .join("\n")
        : `This server runs capd ${payload.current}.`,
      fields: [
        ["Installed", payload.current],
        ["Latest", latest],
        ["Release notes", payload.latest?.url],
        ...advisories.slice(0, 5).map((a) => ["Advisory", a.url]),
      ].filter(([, v]) => v),
      level: security ? "danger" : "info",
      at: Date.now(),
      footer: "Cap update check",
      source: "capd",
      alias: `capd-${payload.type}-${latest ?? advisories.map((a) => a.id).join("-")}`,
      dashboard,
    });
  }
  if (payload.type === "cap.instance") {
    const a = payload.actor;
    const who = !a
      ? ""
      : a.type === "mcp"
        ? `MCP app ${a.name || "unnamed"}`
        : a.type === "api"
          ? `API key ${a.name || a.id || ""}`.trim()
          : a.name || "Dashboard";
    const failed = payload.trigger === "login_failed";
    return finish({
      title: `${payload.test ? "Test: " : ""}${payload.summary}`,
      plain: failed
        ? "Someone tried to sign in with a wrong admin key."
        : who
          ? `Done by ${who}.`
          : "",
      fields: [
        ["By", who],
        ["Site key", payload.keyName || payload.siteKey],
        ["IP", payload.ip],
        ["Browser", payload.ua],
      ].filter(([, v]) => v),
      level: failed || payload.trigger === "access" ? "warning" : "info",
      at: payload.at ?? Date.now(),
      footer: "Cap, this server",
      source: "capd",
      alias: `capd-${payload.trigger}-${payload.at ?? Date.now()}`,
      dashboard,
    });
  }
  const key = keyName || payload.site_key;
  const footer = `Cap, ${key}`;
  const source = key;
  if (payload.type === "cap.digest") {
    const rows = payload.events ?? [];
    const n = payload.count ?? rows.length;
    const minutes = Math.max(
      1,
      Math.round((payload.to - payload.from) / 60000),
    );
    const title = `${n} ${n === 1 ? "event" : "events"} in the last ${minutes === 1 ? "minute" : `${minutes} minutes`}`;
    const fields = [
      ["What", counts(rows, eventTitle)],
      [
        "Reasons",
        counts(rows, (e) =>
          e.rule ? ruleText(e.rule, ruleNames) : reasonText(e.reason),
        ),
      ],
      ["Countries", counts(rows, (e) => e.country)],
      ["Networks", counts(rows, (e) => e.asn_org)],
      ["Sites", counts(rows, (e) => e.origin)],
    ].filter(([, v]) => v);
    const plain = `Cap matched ${n} ${n === 1 ? "event" : "events"} on ${key}.`;
    return finish({
      title,
      plain,
      fields,
      level: rows.some((e) => e.outcome === "block") ? "danger" : "warning",
      at: payload.to,
      footer,
      source,
      alias: `cap-${payload.site_key}-digest-${payload.to}`,
      dashboard,
    });
  }
  const e = payload.event ?? {};
  const test = payload.type === "cap.test";
  return finish({
    title: `${test ? "Test: " : ""}${eventTitle(e)}`,
    plain: test
      ? `This is a test from Cap for ${key}. Real alerts look like this.`
      : `On ${key}${e.origin ? ` from ${e.origin}` : ""}.`,
    fields: eventFields(e, ruleNames),
    level: e.outcome === "block" ? "danger" : "warning",
    at: e.ts ?? Date.now(),
    footer,
    source,
    alias: `cap-${e.id ?? "test"}`,
    dashboard,
  });
}

function finish(m) {
  const link = m.dashboard ? `\n${m.dashboard}` : "";
  return {
    ...m,
    text: `${m.plain}${link}`,
    body: `${m.plain}\n${m.fields.map(([k, v]) => `${k}: ${v}`).join("\n")}${link}`,
  };
}

const MAX_FIELD = 2000;

export function cleanServiceConfig(service, input, previous = {}) {
  const def = WEBHOOK_SERVICES[service];
  if (!def) return { error: "Pick a service" };
  const config = {};
  for (const f of def.fields) {
    let v = String(input?.[f.key] ?? "").trim();
    if (!v && f.kind === "secret" && previous[f.key]) v = previous[f.key];
    if (!v && f.value) v = f.value;
    if (!v) {
      if (f.optional) continue;
      return { error: `Enter the ${f.label.toLowerCase()}`, field: f.key };
    }
    if (v.length > MAX_FIELD)
      return {
        error: `The ${f.label.toLowerCase()} is too long`,
        field: f.key,
      };
    if (f.kind === "select" && !f.options.some(([o]) => o === v))
      return { error: `Pick a ${f.label.toLowerCase()}`, field: f.key };
    if (f.kind === "url" || f.key === "url") {
      let u;
      try {
        u = new URL(v);
      } catch {
        return {
          error: `Enter a valid ${f.label.toLowerCase()}`,
          field: f.key,
        };
      }
      if (u.protocol !== "https:" && u.protocol !== "http:")
        return {
          error: `The ${f.label.toLowerCase()} must use http or https`,
          field: f.key,
        };
      if (u.username || u.password)
        return {
          error: `Leave credentials out of the ${f.label.toLowerCase()}`,
          field: f.key,
        };
      v = f.kind === "url" ? base(u.toString()) : u.toString();
    }
    if (f.pattern && !new RegExp(f.pattern).test(v))
      return {
        error:
          f.key === "url"
            ? `That doesn't look like a ${def.name} ${f.label.toLowerCase()}`
            : `Check the ${f.label.toLowerCase()}`,
        field: f.key,
      };
    config[f.key] = v;
  }
  return { config };
}

export function serviceUrls(service, config) {
  const def = WEBHOOK_SERVICES[service];
  return (def?.fields ?? [])
    .filter((f) => f.kind === "url" || f.key === "url")
    .map((f) => config[f.key])
    .filter(Boolean);
}

export function publicServiceConfig(service, config = {}) {
  const def = WEBHOOK_SERVICES[service];
  const out = {};
  const secrets = {};
  for (const f of def?.fields ?? []) {
    const v = config[f.key];
    if (v == null) continue;
    if (f.kind === "secret") secrets[f.key] = `${"•".repeat(4)}${v.slice(-4)}`;
    else out[f.key] = v;
  }
  return { config: out, secrets };
}

export const serviceLabel = (service, config = {}) => {
  const def = WEBHOOK_SERVICES[service];
  try {
    return def?.label?.(config) || def?.name || "";
  } catch {
    return def?.name ?? "";
  }
};

export const buildRequests = async (service, config, message) =>
  WEBHOOK_SERVICES[service].build(config, message);
