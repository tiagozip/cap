import { describe, expect, test } from "bun:test";
import {
  buildRequests,
  cleanServiceConfig,
  formatMessage,
  publicServiceConfig,
  SERVICE_IDS,
  serviceLabel,
  WEBHOOK_SERVICES,
} from "../src/policy/webhook-services.js";

const SAMPLE = {
  discord: { url: "https://discord.com/api/webhooks/123456/abc-DEF_1" },
  slack: { url: "https://hooks.slack.com/services/T0/B0/xyz" },
  teams: {
    url: "https://prod-01.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=1",
  },
  googlechat: {
    url: "https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t",
  },
  telegram: {
    token: "123456:ABCDEFGHIJKLMNOPQRSTUV",
    chats: "-100123, @alerts",
  },
  ntfy: { topic: "cap-alerts" },
  pushover: { token: "a".repeat(30), user: "u".repeat(30) },
  gotify: { server: "https://gotify.example.com/", token: "AbC" },
  matrix: {
    server: "https://matrix.org",
    token: "syt_x",
    room: "!abc:matrix.org",
  },
  mattermost: { url: "https://chat.example.com/hooks/abc123" },
  rocketchat: { url: "https://chat.example.com/hooks/abc/def" },
  zulip: {
    server: "https://example.zulipchat.com",
    email: "bot@example.zulipchat.com",
    key: "k",
    stream: "alerts",
  },
  lark: {
    url: "https://open.larksuite.com/open-apis/bot/v2/hook/abc-123",
    sign: "s",
  },
  pushbullet: { token: "o.abc", target: "#cap" },
  bark: { device: "dev" },
  join: { key: "k" },
  ifttt: { key: "k", event: "cap_alert" },
  opsgenie: { key: "k", region: "eu" },
  pagerduty: { key: "a".repeat(32) },
  twilio: {
    sid: `AC${"0".repeat(32)}`,
    token: "t",
    from: "+15551234567",
    to: "+15557654321, +15550000000",
  },
  notifiarr: { key: "k", channel: "735481457153277994" },
};

const event = {
  type: "cap.event",
  site_key: "sk",
  event: {
    id: "e1",
    ts: 1_700_000_000_000,
    type: "redeem",
    outcome: "block",
    reason: "rule:test",
    rule: "no-firefox",
    ip: "198.51.100.4",
    country: "PT",
    city: "Lisbon",
    asn_org: "Example Net",
    origin: "shop.example",
    flags: ["bh_linear_path"],
  },
};

describe("webhook services", () => {
  test("every service validates its sample and builds requests", async () => {
    const message = formatMessage(event, { keyName: "Shop" });
    for (const id of SERVICE_IDS.filter((s) => s !== "generic")) {
      const { config, error } = cleanServiceConfig(id, SAMPLE[id]);
      expect({ id, error }).toEqual({ id, error: undefined });
      const requests = await buildRequests(id, config, message);
      expect(requests.length).toBeGreaterThan(0);
      for (const r of requests) {
        expect(r.url).toMatch(/^https:\/\//);
        if (r.body && r.headers["content-type"] === "application/json")
          expect(() => JSON.parse(r.body)).not.toThrow();
      }
      expect(serviceLabel(id, config)).toBeTruthy();
    }
  });

  test("message text carries the event details", () => {
    const m = formatMessage(event, { keyName: "Shop" });
    expect(m.title).toBe("Blocked solve");
    expect(m.fields).toContainEqual(["Reason", "Rule no-firefox"]);
    expect(m.fields).toContainEqual(["IP", "198.51.100.4 (Lisbon, PT)"]);
    const digest = formatMessage({
      type: "cap.digest",
      site_key: "sk",
      from: 0,
      to: 300_000,
      count: 3,
      events: [event.event, event.event, { ...event.event, country: "US" }],
    });
    expect(digest.title).toBe("3 events in the last 5 minutes");
    expect(digest.fields).toContainEqual(["Countries", "PT (2), US (1)"]);
    const security = formatMessage({
      type: "cap.security",
      current: "4.0.0",
      latest: { version: "4.0.1", url: "https://github.com/x" },
      advisories: [{ id: "a", summary: "Bad thing.", severity: "high" }],
    });
    expect(security.title).toBe("A security advisory affects capd 4.0.0");
    expect(security.plain).toBe("High: Bad thing.");
  });

  test("telegram sends one request per chat with escaped html", async () => {
    const { config } = cleanServiceConfig("telegram", SAMPLE.telegram);
    const m = formatMessage({
      ...event,
      event: { ...event.event, origin: "<b>x</b>" },
    });
    const requests = await buildRequests("telegram", config, m);
    expect(requests.map((r) => JSON.parse(r.body).chat_id)).toEqual([
      "-100123",
      "@alerts",
    ]);
    expect(requests[0].body).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(requests[0].url).toBe(
      "https://api.telegram.org/bot123456:ABCDEFGHIJKLMNOPQRSTUV/sendMessage",
    );
  });

  test("notifiarr keeps the full channel id", async () => {
    const { config } = cleanServiceConfig("notifiarr", SAMPLE.notifiarr);
    const [r] = await buildRequests("notifiarr", config, formatMessage(event));
    expect(r.body).toContain('"channel":735481457153277994');
  });

  test("rejects other hosts and fills defaults", () => {
    expect(
      cleanServiceConfig("discord", {
        url: "https://evil.example/api/webhooks/1/a",
      }).error,
    ).toBe("That doesn't look like a Discord webhook url");
    expect(cleanServiceConfig("telegram", { chats: "1" }).field).toBe("token");
    expect(cleanServiceConfig("ntfy", { topic: "t" }).config).toEqual({
      server: "https://ntfy.sh",
      topic: "t",
      priority: "default",
    });
    expect(cleanServiceConfig("nope", {}).error).toBe("Pick a service");
  });

  test("hides secrets and keeps them when left blank", () => {
    const { config } = cleanServiceConfig("pushover", SAMPLE.pushover);
    const shown = publicServiceConfig("pushover", config);
    expect(shown.config.token).toBeUndefined();
    expect(shown.secrets.token).toBe("••••aaaa");
    const kept = cleanServiceConfig(
      "pushover",
      { ...shown.config, token: "", user: "" },
      config,
    );
    expect(kept.config.token).toBe(config.token);
  });

  test("every field has a label and known kind", () => {
    for (const s of Object.values(WEBHOOK_SERVICES))
      for (const f of s.fields) {
        expect(f.label).toBeTruthy();
        expect(["text", "secret", "url", "select"]).toContain(f.kind);
      }
  });
});
