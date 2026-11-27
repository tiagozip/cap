---
description: "Send capd events, summaries and update notices to a signed webhook, Discord, Slack, Telegram, ntfy and 17 other services."
---

# Webhooks

capd has two kinds of webhooks:

- **Key webhooks** post about traffic on one site key. Add one under the key's **Configuration** tab, in the **Webhooks** section.
- **Server webhooks** post about the server itself: sign-ins, changes and updates. Add one under **Instance settings > Webhooks**.

The add dialog shows a live preview of the message for the service and conditions you pick.

## Key webhook conditions

**Send when** takes any number of conditions. A webhook sends when an event matches at least one of them.

| Condition | Sends when |
| --- | --- |
| Every event | Any challenge, solve or token check |
| Every challenge | A visitor's browser asks for a puzzle |
| Every passed solve | A visitor solves the puzzle and gets a token |
| Every token check | Your backend calls siteverify |
| Blocked requests | Rules, lists or detection block a request |
| Failed solves | A wrong answer, or an expired or reused challenge |
| Rate-limited requests | A visitor goes over the rate limit |
| Failed token checks | Your backend sends a token that doesn't verify |
| Solves with risk flags | A solve passes, but a detection signal fired |
| Risk score over a value | Behavior scoring rates the solve at or above the score you set |
| AI agents | A known AI agent or browser solves |
| Specific reasons | A block or failure has one of the reasons you pick |
| Rule matches | Any rule matches, or only the rules you pick |

Some conditions narrow down further. **Solves with risk flags** and **AI agents** take a list of flags or agents, and leave it empty to match any. **Risk score over a value** takes a score from 0.05 to 1.

**From** limits every condition to visitors from, or not from, a list of countries.

## Server webhook conditions

| Condition | Sends when |
| --- | --- |
| Dashboard sign-ins | Someone signs in with the admin key or the sign-in proxy |
| Failed sign-in attempts | Someone tries a wrong admin key |
| API keys, MCP apps and share links | One is created, revoked or reset |
| Site key, rule and list changes | Keys are created, deleted or reconfigured, or rules, lists and blocks change |
| Server setting changes | Rate limits, CORS, the IP database, analytics and other instance settings change |
| Anything MCP apps or API keys change | Any of the changes above, when an MCP app or API key made it |
| New capd versions | A newer release is out |
| Security advisories | A published advisory affects the capd you run |

Each message names who made the change: the dashboard, the API key by name, or the MCP app by its client name. Use the MCP condition to watch what agents do without hearing about your own clicks.

The last two come from [update checks](./update-checks.md), so they need update checks switched on. **Instance settings > About > Manage** links to server webhooks and adds one with both ticked when you have none.

## Services

The **Service** menu has a normal signed webhook and these services, which capd formats natively:

Discord, Slack, Microsoft Teams, Google Chat, Telegram, ntfy, Pushover, Gotify, Matrix, Mattermost, Rocket.Chat, Zulip, Lark, Pushbullet, Bark, Join, IFTTT, Opsgenie, PagerDuty, Twilio and Notifiarr.

They cover the HTTP services that Shoutrrr supports. Email, MQTT and XMPP aren't in the list.

Each service asks for its own fields, like a bot token and chat ids for Telegram. capd checks the values when you save and sends a test message right after you add one. Tokens and keys are hidden once saved, and the dashboard shows only their last 4 characters. Leave a secret field blank when editing to keep the saved value.

## Normal webhooks

A normal webhook gets a JSON `POST` with these headers:

| Header | Value |
| --- | --- |
| `cap-webhook-id` | The webhook's id |
| `cap-signature` | `t=<unix seconds>,v1=<hex HMAC-SHA256>` |

The signature is an HMAC-SHA256 of `<t>.<raw body>` with the webhook's secret. capd shows the secret once, when you create the webhook. **Rotate secret** makes a new one and shows it once more.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(secret, header, body) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}
```

You can add custom headers, for example an `Authorization` header for a gateway in front of your endpoint. capd keeps their values hidden the same way it hides service secrets. It refuses headers it sets itself, like `Host`, `Content-Type` and the two above.

The body's `type` tells you what it carries: `cap.event`, `cap.digest`, `cap.test`, `cap.update`, `cap.security` or `cap.instance`.

A `cap.instance` body looks like this:

```json
{
  "type": "cap.instance",
  "at": 1795810155027,
  "trigger": "keys",
  "summary": "Changed the rules of \"Account login\"",
  "actor": { "type": "mcp", "name": "Claude" },
  "siteKey": "c4f1a9e27b",
  "keyName": "Account login"
}
```

`actor.type` is `dashboard`, `api` or `mcp`. Sign-in messages carry `ip`, `ua` and `country` instead of a site key.

## Summaries

On key webhooks, **How often** sends every matching event on its own by default. Pick 1, 5, 15 or 60 minutes and capd groups events into one `cap.digest` message per window instead, with the count, the top countries and up to 50 events. This keeps a busy key from flooding a chat channel.

**Send the summary** skips a window that has fewer events than the number you pick, so a quiet hour doesn't post a summary of 2 events.

Server webhooks always send each message on its own.

## API

Key webhooks live under `/server/keys/:siteKey/webhooks` and server webhooks under `/server/settings/webhooks`. Both take the same body. Server webhooks ignore `digest` and `filters`. Your server shows the full API reference at `/swagger`.

## Retries and pausing

capd waits 5 seconds for an answer. When the request times out, can't connect, or gets a `429` or `5xx`, capd retries after 1, 5 and 30 seconds. On [Workers](./workers.md) the 30 second retry usually doesn't run.

After 20 failed deliveries in a row, capd pauses the webhook and the dashboard says so. Turning it back on resets the count.

The delivery log under each webhook lists recent attempts with their status. Failed event deliveries have a **Resend** button.

## Private addresses

capd refuses to post to private and loopback addresses, so a webhook can't reach services inside your network. To post to something on your LAN, like an n8n instance, set `WEBHOOK_ALLOW_PRIVATE=true`. See [configuration](./options.md).
