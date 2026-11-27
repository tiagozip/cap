import { signOut } from "../../lib/api.js";
import { compact } from "../../lib/format.js";
import { countryNames } from "../../lib/geo.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { copy, pageCommands, setTheme, theme } from "../../lib/ui.svelte.js";

export { pushRecent, readRecent } from "../../lib/ui.svelte.js";

import { FILTER_LABELS, filterValueLabel } from "../../views/events/labels.js";
import { KEY_TABS, keyTab } from "../../views/keyTabs.js";

const TAB_ICONS = {
  activity: "dashboard",
  events: "activity",
  protection: "shield",
  configuration: "settings",
};

const SECTIONS = [
  ["security", "Default protection", "shield", "rules difficulty"],
  ["ipdata", "Visitor location", "globe", "geoip country asn database"],
  ["analytics", "Data and storage", "server", "retention storage"],
  ["widget", "Widget files", "code", "assets cdn"],
  ["lists", "Shared lists", "list", "blocklist allowlist ip"],
  ["proxy", "Proxy sign-in", "key", "sso oidc auth"],
  ["sessions", "Sign-in sessions", "monitor", "devices logout"],
  ["appearance", "Appearance", "sun", "theme dark light"],
  ["about", "About", "info", "version update"],
];

const OUTCOMES = [
  ["fail", "Failed solves", "x"],
  ["block", "Blocked visitors", "ban"],
  ["flagged", "Flagged visitors", "flag"],
  ["limit", "Rate limited visitors", "clock"],
];

const IP = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7})$/i;
const TOKEN = /^-?([a-z_]+):("[^"]*"|\S+)$/i;

const currentKey = () =>
  app.keys.find((k) => k.siteKey === app.key?.siteKey) ?? app.keys[0];

const toEvents = (siteKey, filters) => {
  app.eventsPreset = filters;
  navigate({ view: "key", siteKey, tab: "events" });
};

export function buildCommands() {
  const key = currentKey();
  const onKey = app.route.view === "key";
  const tab = onKey ? app.route.tab : null;
  const list = pageCommands();

  if (key)
    for (const t of KEY_TABS)
      list.push({
        id: `tab:${t.id}`,
        group: "Go to",
        label: t.label,
        hint: key.name,
        icon: TAB_ICONS[t.id],
        current:
          onKey && keyTab(tab) === t.id && app.key?.siteKey === key.siteKey,
        run: () => navigate({ view: "key", siteKey: key.siteKey, tab: t.id }),
      });
  list.push(
    {
      id: "view:settings",
      group: "Go to",
      label: "Instance settings",
      icon: "sliders",
      current: app.route.view === "settings",
      run: () => navigate({ view: "settings" }),
    },
    {
      id: "view:api",
      group: "Go to",
      label: "API and MCP",
      icon: "code",
      current: app.route.view === "api",
      run: () => navigate({ view: "api" }),
    },
  );

  for (const k of app.keys) {
    list.push({
      id: `key:${k.siteKey}`,
      group: "Site keys",
      label: k.name,
      hint: k.solvesLast24h
        ? `${compact(k.solvesLast24h)} solves in 24h`
        : "No solves in 24h",
      icon: "key",
      keywords: k.siteKey,
      current: onKey && app.key?.siteKey === k.siteKey,
      run: () =>
        navigate({
          view: "key",
          siteKey: k.siteKey,
          tab: onKey ? tab : "activity",
        }),
    });
    for (const t of KEY_TABS)
      list.push({
        id: `key:${k.siteKey}:${t.id}`,
        group: "Site keys",
        label: `${k.name} ${t.label.toLowerCase()}`,
        icon: TAB_ICONS[t.id],
        deep: true,
        current:
          onKey && app.key?.siteKey === k.siteKey && keyTab(tab) === t.id,
        run: () => navigate({ view: "key", siteKey: k.siteKey, tab: t.id }),
      });
  }

  for (const [id, title, icon, words] of SECTIONS)
    list.push({
      id: `settings:${id}`,
      group: "Instance settings",
      label: title,
      hint: "Instance settings",
      icon,
      keywords: words,
      deep: true,
      current:
        app.route.view === "settings" &&
        (app.route.section ?? "security") === id,
      run: () => {
        const el =
          app.route.view === "settings" &&
          document.getElementById(`settings-${id}`);
        if (!el) return navigate({ view: "settings", section: id });
        history.replaceState(null, "", `#/settings/${id}`);
        app.route = { view: "settings", section: id };
        el.scrollIntoView({
          block: "start",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      },
    });

  if (key)
    for (const [id, label, icon] of OUTCOMES)
      list.push({
        id: `events:${id}`,
        group: "Events",
        label,
        hint: key.name,
        icon,
        keywords: `events outcome ${id}`,
        run: () => toEvents(key.siteKey, [`outcome:${id}`]),
      });

  list.push({
    id: "action:create-key",
    group: "Actions",
    label: "Create site key",
    icon: "plus",
    keywords: "new add",
    shortcut: ["C"],
    run: () => {
      app.createKeyOpen = true;
    },
  });
  if (key)
    list.push({
      id: "action:copy-key",
      group: "Actions",
      label: "Copy site key",
      hint: key.name,
      icon: "copy",
      keywords: key.siteKey,
      run: () => copy(key.siteKey),
    });
  for (const [value, label, icon] of [
    ["dark", "Use dark theme", "moon"],
    ["light", "Use light theme", "sun"],
    ["system", "Match system theme", "monitor"],
  ])
    if (theme.value !== value)
      list.push({
        id: `theme:${value}`,
        group: "Actions",
        label,
        icon,
        keywords: "appearance mode",
        run: () => setTheme(value),
      });
  list.push(
    {
      id: "action:docs",
      group: "Actions",
      label: "Open documentation",
      icon: "book",
      keywords: "help guide",
      external: true,
      run: () => open("https://trycap.dev/guide/capd/", "_blank", "noopener"),
    },
    {
      id: "action:signout",
      group: "Actions",
      label: "Sign out",
      icon: "logout",
      keywords: "log out logout",
      deep: true,
      run: () => signOut({ revoke: true }),
    },
  );
  return list;
}

const countryMatches = (q) => {
  const s = q.toLowerCase();
  if (s.length < 3) return [];
  return Object.entries(countryNames)
    .filter(([, name]) => name.toLowerCase().startsWith(s))
    .slice(0, 2);
};

export function eventCommands(query) {
  const key = currentKey();
  const q = query.trim();
  if (!key || !q) return [];
  const out = [];
  const tokens = q.split(/\s+/);
  if (tokens.every((t) => TOKEN.test(t) && FILTER_LABELS[t.match(TOKEN)[1]])) {
    out.push({
      id: `search:${q}`,
      group: "Search events",
      label: tokens
        .map((t) => {
          const [, field, raw] = t.match(TOKEN);
          const value = raw.replace(/^"|"$/g, "");
          return `${t.startsWith("-") ? "Not " : ""}${FILTER_LABELS[field]} ${filterValueLabel(field, value)}`;
        })
        .join(", "),
      hint: key.name,
      icon: "search",
      dynamic: true,
      siteKey: key.siteKey,
      filters: tokens,
      run: () => toEvents(key.siteKey, tokens),
    });
    return out;
  }
  if (IP.test(q) && q.includes(q.includes(":") ? ":" : "."))
    out.push({
      id: `search:ip:${q}`,
      group: "Search events",
      label: `Events from ${q}`,
      hint: key.name,
      icon: "search",
      dynamic: true,
      siteKey: key.siteKey,
      filters: [`ip:${q}`],
      run: () => toEvents(key.siteKey, [`ip:${q}`]),
    });
  if (/^as\d+$/i.test(q))
    out.push({
      id: `search:asn:${q}`,
      group: "Search events",
      label: `Events from ${q.toUpperCase()}`,
      hint: key.name,
      icon: "search",
      dynamic: true,
      siteKey: key.siteKey,
      filters: [`asn:${q.slice(2)}`],
      run: () => toEvents(key.siteKey, [`asn:${q.slice(2)}`]),
    });
  for (const [code, name] of countryMatches(q))
    out.push({
      id: `search:country:${code}`,
      group: "Search events",
      label: `Events from ${name}`,
      hint: key.name,
      icon: "globe",
      dynamic: true,
      siteKey: key.siteKey,
      filters: [`country:${code}`],
      run: () => toEvents(key.siteKey, [`country:${code}`]),
    });
  return out;
}

const isBoundary = (text, i) =>
  i === 0 || /[\s\-_./:]/.test(text[i - 1]) || /[A-Z]/.test(text[i]);

export function fuzzy(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return { score: 0, hits: [] };
  const direct = t.indexOf(q);
  if (direct !== -1) {
    const hits = Array.from({ length: q.length }, (_, i) => direct + i);
    const start = isBoundary(text, direct) ? 40 : 10;
    return { score: 100 + start - direct * 0.5 - t.length * 0.1, hits };
  }
  const hits = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === " ") continue;
    let found = -1;
    for (let i = ti; i < t.length; i++) {
      if (t[i] !== ch) continue;
      if (isBoundary(text, i) || i === prev + 1) {
        found = i;
        break;
      }
      if (found === -1) found = i;
    }
    if (found === -1) return null;
    score += found === prev + 1 ? 6 : isBoundary(text, found) ? 8 : 1;
    score -= Math.min(found - ti, 6) * 0.5;
    hits.push(found);
    prev = found;
    ti = found + 1;
  }
  return { score: score - t.length * 0.05, hits };
}

export function rank(query, commands) {
  const out = [];
  for (const c of commands) {
    const label = fuzzy(query, c.label);
    const extra = c.keywords ? fuzzy(query, c.keywords) : null;
    const group = fuzzy(query, `${c.group} ${c.label}`);
    let best = null;
    if (label) best = { score: label.score + 20, hits: label.hits };
    if (extra && (!best || extra.score > best.score))
      best = { score: extra.score, hits: [] };
    if (group && (!best || group.score - 10 > best.score))
      best = { score: group.score - 10, hits: [] };
    if (!best) continue;
    out.push({ ...c, score: best.score - (c.deep ? 4 : 0), hits: best.hits });
  }
  return out.sort((a, b) => b.score - a.score);
}
