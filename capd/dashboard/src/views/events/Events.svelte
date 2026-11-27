<script>
import { onMount, tick, untrack } from "svelte";
import { cubicOut } from "svelte/easing";
import {
  Button,
  Checkbox,
  Empty,
  Icon,
  Menu,
  MenuItem,
  PageHeader,
  RangePicker,
  Skeleton,
  Table,
  Tabs,
} from "../../components/cap/index.js";
import {
  Kbd,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  SlidingTabs,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toggle,
} from "../../components/ui/index.js";
import { api, authHeader, liveEvents, qs, url } from "../../lib/api.js";
import {
  agentName,
  loadCatalog,
  reasonLabel,
  signalInfo,
} from "../../lib/catalog.svelte.js";
import { compact, fullFmt, latency } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { provideCommands, toast } from "../../lib/ui.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import TopView, {
  TOP_DIMS,
  TOP_SAMPLE,
} from "../../polish/events/TopView.svelte";
import AsnIcon from "../activity/AsnIcon.svelte";
import WorldMap from "../activity/WorldMap.svelte";
import AddToListModal from "./AddToListModal.svelte";
import EventDrawer from "./EventDrawer.svelte";
import Histogram from "./Histogram.svelte";
import { CHALLENGE_TTL, failKind, groupSolves, isFlagged } from "./labels.js";
import SearchBar from "./SearchBar.svelte";

const RANGES = [
  { id: "1h", short: "1h", label: "Past hour", long: "the last hour" },
  { id: "24h", short: "1d", label: "Past day", long: "the last 24 hours" },
  { id: "7d", short: "7d", label: "Past 7 days", long: "the last 7 days" },
  { id: "30d", short: "30d", label: "Past 30 days", long: "the last 30 days" },
  { id: "90d", short: "90d", label: "Past 90 days", long: "the last 90 days" },
];
const DECISIONS = {
  issued: ["Issued", "text-muted-foreground"],
  timeout: ["Not solved", "text-muted-foreground"],
  pass: ["Allowed", "text-foreground"],
  flagged: ["Flagged", "font-medium text-warning"],
  fail: ["Failed", "font-medium text-muted-foreground"],
  failBad: ["Failed", "font-medium text-destructive"],
  block: ["Blocked", "font-medium text-destructive"],
  limit: ["Rate limited", "font-medium text-violet"],
};
const KINDS = {
  challenge: ["Challenge issued", "radar", "bg-info/12 text-info"],
  redeem: ["Challenge solved", "check", "bg-primary/12 text-primary"],
  siteverify: ["Token verified", "key", "bg-success/12 text-success"],
};
const clock = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const sliceFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const sliceTime = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayOf = (ts) => new Date(ts).toDateString();
const decisionNote = (e) => {
  if (e.rule) return "Matched a rule";
  if (e.agent) return agentName(e.agent);
  if (e.reason && e.reason !== "rate_limited") return reasonLabel(e.reason);
  if (e.flags?.length)
    return e.flags.length === 1
      ? signalInfo(e.flags[0]).text
      : `${e.flags.length} risk signals`;
  return "";
};
const issued = (x) => x.type === "challenge" && x.outcome === "pass";
const failedKind = (x) =>
  x.outcome === "fail" && x.type === "redeem"
    ? ["Solve failed", "ban", "bg-muted text-muted-foreground"]
    : x.outcome === "fail" && x.type === "siteverify"
      ? ["Verify failed", "ban", "bg-muted text-muted-foreground"]
      : null;
const childNote = (e) =>
  e.type === "challenge"
    ? (e.origin ?? "")
    : e.type === "redeem" && e.outcome === "pass" && e.solve_ms
      ? `in ${latency(e.solve_ms)}`
      : e.outcome !== "pass" && e.reason
        ? reasonLabel(e.reason)
        : "";
const kindNote = (e) => {
  if (e.type === "redeem" && e.outcome === "pass" && e.solve_ms)
    return `Solved in ${latency(e.solve_ms)}`;
  if (e.outcome === "fail") return e.origin ? `on ${e.origin}` : "";
  if (e.type === "siteverify") return "From your server";
  return e.origin ?? "";
};
const PAGE = 60;
const STEP = {
  challenge: (e) => (e.outcome === "pass" ? "Issued" : "Not issued"),
  redeem: (e) =>
    e.outcome === "pass"
      ? e.solve_ms
        ? `Solved in ${latency(e.solve_ms)}`
        : "Solved"
      : "Solve failed",
  siteverify: (e) => (e.outcome === "pass" ? "Verified" : "Verify failed"),
};

const sk = app.key.siteKey;
const nf = new Intl.NumberFormat();
const n = (v) => nf.format(v ?? 0);

const splitPreset = (all) => {
  const span = all.find((f) => f.startsWith("range:"));
  const range = RANGES.some((r) => `range:${r.id}` === span)
    ? span.slice(6)
    : null;
  const win = all
    .find((f) => f.startsWith("window:"))
    ?.slice(7)
    .match(/^(\d+)-(\d+)$/);
  const slice =
    win && +win[2] > +win[1] ? { from: +win[1], to: +win[2] } : null;
  const list = all.filter(
    (f) => !f.startsWith("range:") && !f.startsWith("window:"),
  );
  const pos = list.filter((f) => f.startsWith("outcome:"));
  if (pos.length !== 1) return { outcome: "all", rest: list, range, slice };
  return {
    outcome: pos[0].slice(8),
    rest: list.filter((f) => f !== pos[0]),
    range,
    slice,
  };
};

const initial = splitPreset(app.eventsPreset ?? []);
app.eventsPreset = null;

let range = $state(initial.range ?? "24h");
let outcome = $state(initial.outcome);
let filters = $state(initial.rest);
let q = $state("");
let expanded = $state(new Set());
let rows = $state([]);
let cursor = $state(null);
let trail = $state([null]);
let page = $state(0);
let before = $state([]);
let loading = $state(true);
let loadingMore = $state(false);
let overview = $state(null);
let custom = $state(null);
let live = $state(false);
let drawerId = $state(null);
let drawerGroup = $state(null);
let drawerOpen = $state(false);
let seq = 0;
let pending = $state([]);
let chosen = $state(new Map());
let anchor = null;
let shifted = false;
let listing = $state(null);
let rate = $state(null);
let beats = [];
const rateText = (r) =>
  r >= 1000 ? compact(r) : r >= 10 ? String(Math.round(r)) : r.toFixed(1);

const choose = (id, who, on) => {
  const next = new Map(chosen);
  const ids = mainIds();
  const from = ids.indexOf(anchor);
  const to = ids.indexOf(id);
  const span =
    shifted && from >= 0 && to >= 0
      ? ids.slice(Math.min(from, to), Math.max(from, to) + 1)
      : [id];
  for (const x of span) {
    if (!on) next.delete(x);
    else if (!next.has(x)) next.set(x, x === id ? who : clientOf(x));
  }
  anchor = id;
  shifted = false;
  chosen = next;
};

const chosenIps = $derived([
  ...new Set(
    [...chosen.values()]
      .map((w) => (w.type === "siteverify" ? null : w.ip))
      .filter(Boolean),
  ),
]);

async function copyIps() {
  try {
    await navigator.clipboard.writeText(chosenIps.join("\n"));
    toast(
      `Copied ${chosenIps.length} ${chosenIps.length === 1 ? "IP" : "IPs"}`,
    );
  } catch {
    toast("Couldn't copy to the clipboard", "error");
  }
}

const addChosen = () => {
  const seen = new Set();
  const items = [];
  for (const w of chosen.values()) {
    if (w.ip && w.type !== "siteverify" && !seen.has(`ip:${w.ip}`)) {
      seen.add(`ip:${w.ip}`);
      items.push({ kind: "ip", value: w.ip });
    }
  }
  if (items.length) listing = items;
};

const held = () => {
  const first = document.querySelector("#evTable tbody tr");
  const bar = document.getElementById("evSticky")?.getBoundingClientRect();
  return !!first && !!bar && first.getBoundingClientRect().top < bar.bottom - 1;
};

const flush = () => {
  if (!pending.length) return;
  const now = performance.now();
  rows = [...pending.map((e) => ({ ...e, fresh: now })), ...rows].slice(0, 500);
  pending = [];
};

const rise = () =>
  matchMedia("(prefers-reduced-motion: no-preference)").matches
    ? {
        duration: 220,
        easing: cubicOut,
        css: (t) =>
          `opacity:${t};transform:translateY(${(1 - t) * -6}px) scale(${0.96 + t * 0.04})`,
      }
    : { duration: 120, css: (t) => `opacity:${t}` };
let view = $state(
  (() => {
    try {
      const v = localStorage.getItem("cap_events_view");
      return v === "map" || v === "top" ? v : "list";
    } catch {
      return "list";
    }
  })(),
);
let where = $state(null);
let dense = $state(
  (() => {
    try {
      return localStorage.getItem("cap_events_dense") === "1";
    } catch {
      return false;
    }
  })(),
);
$effect(() => {
  const v = dense ? "1" : "0";
  try {
    localStorage.setItem("cap_events_dense", v);
  } catch {}
});
let whereSeq = 0;

let tops = $state(null);

async function loadWhere() {
  const my = ++whereSeq;
  const top = view === "top";
  const res = await api(
    "GET",
    `/keys/${sk}/analytics/top${qs({ ...(custom ? { from: custom.from, to: custom.to } : { range }), f: queryFilters, q, dims: top ? TOP_DIMS.map(([d]) => d).join(",") : "country,asn_org", limit: top ? 8 : 100 })}`,
  );
  if (my !== whereSeq) return;
  if (top) tops = res?.error ? {} : res;
  else where = res?.error ? { country: [], asn_org: [] } : res;
}

let valuesFor = "";
let values = null;
const SUGGEST_DIMS =
  "country,asn_org,browser,os,platform,origin,lang,reason,verdict,agent,flag,ip,rule";
const suggestValues = () => {
  const at = qs({
    ...(custom ? { from: custom.from, to: custom.to } : { range }),
    f: queryFilters,
    q,
    dims: SUGGEST_DIMS,
    limit: 40,
  });
  if (at !== valuesFor || !values) {
    valuesFor = at;
    values = api("GET", `/keys/${sk}/analytics/top${at}`).then((res) =>
      res?.error ? null : res,
    );
    values.then((res) => {
      if (!res && valuesFor === at) values = null;
    });
  }
  return values;
};

const setView = (v) => {
  view = v;
  try {
    localStorage.setItem("cap_events_view", v);
  } catch {}
  if (v !== "list") loadWhere();
};

const pickCountry = (code) => {
  setView("list");
  addFilter(`country:${code}`);
};

const rangeInfo = $derived(RANGES.find((r) => r.id === range));
const flaggedOnly = $derived(outcome === "flagged");
const queryFilters = $derived(
  outcome === "all"
    ? filters
    : flaggedOnly
      ? [...filters, "outcome:pass", "type:redeem"]
      : [...filters, `outcome:${outcome}`],
);
const narrowed = $derived(outcome !== "all" || filters.length > 0 || !!q);
const summary = $derived(overview?.summary);
const COUNTS = {
  all: (x) => x.total,
  pass: (x) => x.challenges + x.solved + x.verified,
  flagged: (x) => x.flagged,
  fail: (x) => x.failed,
  block: (x) => x.blocked,
  limit: (x) => x.limited,
};
const bucketAll = (x) =>
  x.challenges + x.solved + x.verified + x.failed + x.blocked + x.limited;
const total = $derived.by(() => {
  if (!custom) return summary ? (COUNTS[outcome]?.(summary) ?? 0) : 0;
  const count = outcome === "all" ? bucketAll : COUNTS[outcome];
  return (overview?.series ?? [])
    .filter((x) => x.b >= custom.from && x.b < custom.to)
    .reduce((a, x) => a + (count?.(x) ?? 0), 0);
});
const keep = (list) => (flaggedOnly ? list.filter(isFlagged) : list);

const solves = $derived(groupSolves(rows, Date.now() - CHALLENGE_TTL, before));
const mainIds = () => solves.map((g) => g.main.id);
const clientOf = (id) => {
  const g = solves.find((x) => x.main.id === id);
  return g ? g.client : {};
};
const pageAll = $derived(
  solves.length > 0 && solves.every((g) => chosen.has(g.main.id)),
);
const sampleSolves = groupSolves(samples.events);

async function fetchPage(params, limit) {
  let res = await api(
    "GET",
    `/keys/${sk}/events${qs({ ...params, f: queryFilters, q, limit })}`,
  );
  let found = keep(res.events ?? []);
  let pages = 1;
  while (flaggedOnly && found.length < 20 && res.next && pages < 5) {
    res = await api(
      "GET",
      `/keys/${sk}/events${qs({ ...params, f: queryFilters, q, cursor: res.next, limit: 200 })}`,
    );
    found = [...found, ...keep(res.events ?? [])];
    pages++;
  }
  return { events: found, next: res.next ?? null };
}

const totalsOnly = $derived(
  overview?.storage === "redis" || overview?.storage === "off",
);

async function load() {
  const my = ++seq;
  custom = null;
  zoomed = false;
  loading = true;
  pending = [];
  chosen = new Map();
  await loadCatalog();
  const params = { range, f: filters, q };
  const [res, o] = await Promise.all([
    fetchPage({ range }, flaggedOnly ? 200 : PAGE),
    api("GET", `/keys/${sk}/analytics${qs(params)}`),
  ]);
  if (my !== seq) return;
  rows = res.events;
  cursor = res.next;
  trail = [null];
  page = 0;
  before = [];
  overview = o?.series ? o : null;
  loading = false;
  if (view !== "list") loadWhere();
}

async function goPage(i) {
  const my = seq;
  const at = i > page ? cursor : trail[i];
  loadingMore = true;
  const where = custom ? { from: custom.from, to: custom.to } : { range };
  const res = await fetchPage(
    at ? { ...where, cursor: at } : where,
    flaggedOnly ? 200 : PAGE,
  );
  const top = res.events?.[0]?.ts;
  const near =
    i && top
      ? await api(
          "GET",
          `/keys/${sk}/events${qs({ from: top + 1, to: top + CHALLENGE_TTL, f: ["type:redeem"], limit: 200 })}`,
        )
      : null;
  loadingMore = false;
  if (my !== seq) return;
  before = near?.events ?? [];
  if (i > page) trail = [...trail.slice(0, i), at];
  rows = res.events;
  cursor = res.next;
  page = i;
  expanded = new Set();
  scrollToTop(document.getElementById("evTable"));
}

const STEPS = [
  60_000, 300_000, 900_000, 3_600_000, 10_800_000, 21_600_000, 86_400_000,
];
let zoomed = $state(false);

async function pickBucket(from, to) {
  const my = ++seq;
  loading = true;
  custom = { from, to };
  chosen = new Map();
  const fine = STEPS.find((b) => (to - from) / b <= 200) ?? 86_400_000;
  const zoom = (to - from) / fine >= 8;
  const [res, o] = await Promise.all([
    fetchPage({ from, to }, flaggedOnly ? 200 : PAGE),
    api(
      "GET",
      `/keys/${sk}/analytics${qs({ ...(zoom ? { from, to } : { range }), f: filters, q })}`,
    ),
  ]);
  if (my !== seq) return;
  rows = res.events;
  cursor = res.next;
  trail = [null];
  page = 0;
  before = [];
  expanded = new Set();
  if (o?.series) overview = o;
  zoomed = zoom && !!o?.series;
  loading = false;
  if (view !== "list") loadWhere();
}

let exporting = $state(false);

async function exportEvents(format) {
  if (exporting) return;
  exporting = true;
  try {
    const res = await fetch(
      url(
        `server/keys/${sk}/events/export${qs({ ...(custom ? { from: custom.from, to: custom.to } : { range }), f: queryFilters, q, format })}`,
      ),
      { headers: { Authorization: authHeader() } },
    );
    if (res.headers.get("content-type")?.includes("text/html")) {
      toast("Export isn't available on this server", "error");
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast(body?.error || "Couldn't export these events", "error");
      return;
    }
    const blob = await res.blob();
    const name =
      /filename="([^"]+)"/.exec(
        res.headers.get("content-disposition") ?? "",
      )?.[1] ?? `cap-events.${format}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  } catch {
    toast("Couldn't export these events", "error");
  } finally {
    exporting = false;
  }
}

const refresh = () => (custom ? pickBucket(custom.from, custom.to) : load());

const setFilters = (next) => {
  filters = next;
  refresh();
};

const addFilter = (f) => {
  const { outcome: o, rest } = splitPreset([f]);
  if (o !== "all" && !rest.length) {
    outcome = o;
    refresh();
    return;
  }
  if (!filters.includes(f)) setFilters([...filters, f]);
};

const resetAll = () => {
  outcome = "all";
  q = "";
  setFilters([]);
};

onMount(async () => {
  if (!initial.slice) return load();
  await load();
  pickBucket(initial.slice.from, initial.slice.to);
});

$effect(() =>
  untrack(() =>
    provideCommands(() => [
      {
        id: "live",
        label: live ? "Pause live updates" : "Follow live events",
        icon: "activity",
        run: () => {
          live = !live;
        },
      },
      {
        id: "view",
        label: view === "map" ? "Show as list" : "Show on map",
        icon: view === "map" ? "list" : "globe",
        run: () => setView(view === "map" ? "list" : "map"),
      },
      {
        id: "top",
        label:
          view === "top"
            ? "Show as list"
            : "Show top IPs, visitors and networks",
        icon: view === "top" ? "list" : "bars",
        run: () => setView(view === "top" ? "list" : "top"),
      },
      {
        id: "dense",
        label: dense ? "Show two lines per event" : "Show one line per event",
        icon: "menu",
        run: () => {
          dense = !dense;
        },
      },
      {
        id: "export",
        label: "Export these events as CSV",
        icon: "list",
        run: () => exportEvents("csv"),
      },
      { id: "reset", label: "Clear filters", icon: "x", run: resetAll },
    ]),
  ),
);

$effect(() => {
  const preset = app.eventsPreset;
  if (!preset) return;
  app.eventsPreset = null;
  untrack(() => {
    const next = splitPreset(preset);
    outcome = next.outcome;
    filters = next.rest;
    range = next.range ?? range;
    q = "";
    if (next.slice)
      load().then(() => pickBucket(next.slice.from, next.slice.to));
    else load();
  });
});

const tallyKey = (e) =>
  e.outcome === "block"
    ? "blocked"
    : e.outcome === "limit"
      ? "limited"
      : e.outcome === "pass"
        ? { challenge: "challenges", redeem: "solved", siteverify: "verified" }[
            e.type
          ]
        : e.type === "redeem" && e.outcome === "fail"
          ? "failed"
          : null;

function absorb(list) {
  if (outcome !== "all" || custom || !overview?.series?.length) return;
  const { bucket } = overview.range;
  const series = overview.series.map((b) => ({ ...b }));
  const sum = { ...overview.summary };
  for (const e of list) {
    while (e.ts >= series.at(-1).b + bucket) {
      const b = series.at(-1).b + bucket;
      series.push({
        b,
        challenges: 0,
        solved: 0,
        failed: 0,
        blocked: 0,
        limited: 0,
        verified: 0,
        flagged: 0,
      });
      series.shift();
    }
    const at = series.findLast((b) => b.b <= e.ts);
    if (!at) continue;
    const key = tallyKey(e);
    if (key) {
      at[key]++;
      sum[key] = (sum[key] ?? 0) + 1;
    }
    if (isFlagged(e)) {
      at.flagged++;
      sum.flagged = (sum.flagged ?? 0) + 1;
    }
    sum.total = (sum.total ?? 0) + 1;
  }
  overview = { ...overview, series, summary: sum };
}

$effect(() => {
  if (!live) return;
  let busy = false;
  let again = false;
  const pull = async () => {
    if (custom || loading || page) return;
    if (document.hidden) {
      again = true;
      return;
    }
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    again = false;
    const my = seq;
    const newest = pending[0]?.ts ?? rows[0]?.ts ?? Date.now() - 60_000;
    const res = await api(
      "GET",
      `/keys/${sk}/events${qs({ from: newest, to: Date.now() + 60_000, f: queryFilters, q, limit: 100 })}`,
    );
    busy = false;
    if (my === seq) {
      const known = new Set([...pending, ...rows].map((r) => r.id));
      const now = performance.now();
      const fresh = keep(res.events ?? [])
        .filter((e) => !known.has(e.id))
        .map((e) => ({ ...e, fresh: now }));
      if (fresh.length && (pending.length || held())) {
        pending = [...fresh, ...pending].slice(0, 500);
        absorb(fresh);
        beats.push([Date.now(), fresh.length]);
      } else if (fresh.length) {
        const body = document.querySelector("#evTable tbody");
        const box = body?.getBoundingClientRect();
        const glide =
          fresh.length <= 4 &&
          box &&
          box.top < innerHeight &&
          box.bottom > 0 &&
          matchMedia("(prefers-reduced-motion: no-preference)").matches;
        const was = glide
          ? new Map(
              [...body.rows]
                .slice(0, 40)
                .map((row) => [row, row.getBoundingClientRect().top]),
            )
          : null;
        rows = [...fresh, ...rows].slice(0, 500);
        absorb(fresh);
        beats.push([Date.now(), fresh.length]);
        if (was) {
          await tick();
          for (const [row, y] of was) {
            const dy = y - row.getBoundingClientRect().top;
            if (!row.isConnected || Math.abs(dy) < 1) continue;
            row.animate(
              [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
              { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
            );
          }
        }
      }
    }
    if (again) pull();
  };
  const visible = () => {
    if (!document.hidden && again) pull();
  };
  const scrolled = () => {
    if (pending.length && !held()) flush();
  };
  document.addEventListener("visibilitychange", visible);
  document.addEventListener("scroll", scrolled, {
    capture: true,
    passive: true,
  });
  const stop = liveEvents(sk, pull);
  beats = [];
  const started = Date.now();
  const tally = setInterval(() => {
    const now = Date.now();
    beats = beats.filter(([t]) => now - t < 15_000);
    const span = Math.min(15_000, now - started);
    rate =
      span < 4000 ? null : beats.reduce((a, [, c]) => a + c, 0) / (span / 1000);
  }, 2000);
  return () => {
    clearInterval(tally);
    rate = null;
    stop();
    flush();
    document.removeEventListener("visibilitychange", visible);
    document.removeEventListener("scroll", scrolled, { capture: true });
  };
});

let stepped = false;

const mainButtons = (groups) => [
  ...document.querySelectorAll(
    groups ? "#evTable tr:not(.ev-child) .ev-main" : "#evTable .ev-main",
  ),
];

async function land(i) {
  await tick();
  const list = mainButtons(drawerOpen);
  const b = list.at(i);
  if (!b) return;
  b.closest("tr").scrollIntoView({ block: "nearest" });
  if (drawerOpen) {
    stepped = true;
    openDrawer(b.dataset.id);
  } else b.focus({ preventScroll: true });
}

async function step(d) {
  const list = mainButtons(drawerOpen);
  if (!list.length) return;
  let at = drawerOpen
    ? list.findIndex((b) => b.dataset.id === drawerId)
    : list.indexOf(document.activeElement);
  if (at === -1 && !drawerOpen) {
    const top =
      document.getElementById("evTable")?.getBoundingClientRect().top ?? 0;
    const seen = list.findIndex(
      (b) => b.getBoundingClientRect().top > Math.max(top, 160),
    );
    return land(Math.max(0, seen));
  }
  at += d;
  if (at >= list.length) {
    if (!cursor || loadingMore) return;
    await goPage(page + 1);
    return land(0);
  }
  if (at < 0) {
    if (!page || loadingMore) return;
    await goPage(page - 1);
    return land(-1);
  }
  land(at);
}

const keys = (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (view !== "list" || loading || listing) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  const k = e.key;
  if (k === "j" || k === "k") {
    e.preventDefault();
    step(k === "j" ? 1 : -1);
    return;
  }
  if (drawerOpen || e.target.closest?.("[role=dialog]")) return;
  if (k === "Escape" && chosen.size) {
    e.preventDefault();
    chosen = new Map();
    return;
  }
  if (k === "Escape" && custom) {
    e.preventDefault();
    load();
    return;
  }
  if (k === "/") {
    e.preventDefault();
    document.getElementById("evSearch")?.focus();
    return;
  }
  const row = document.activeElement?.closest?.("#evTable tr");
  const id =
    row?.querySelector(".ev-pick") && row.querySelector(".ev-main")?.dataset.id;
  if ((k === "f" || k === "F") && id) {
    const ip = clientOf(id).ip ?? rows.find((r) => r.id === id)?.ip;
    if (!ip) return;
    e.preventDefault();
    addFilter(`${k === "F" ? "-" : ""}ip:${ip}`);
    return;
  }
  if ((k === "x" || k === "X") && id) {
    e.preventDefault();
    shifted = e.shiftKey;
    choose(id, clientOf(id), !chosen.has(id));
    return;
  }
  const group = row?.dataset.group;
  if (!group || !["h", "l", "ArrowLeft", "ArrowRight"].includes(k)) return;
  const want = k === "l" || k === "ArrowRight";
  if (expanded.has(group) === want) return;
  e.preventDefault();
  const next = new Set(expanded);
  if (want) next.add(group);
  else next.delete(group);
  expanded = next;
};

$effect(() => {
  if (drawerOpen || !stepped) return;
  stepped = false;
  const id = drawerId;
  setTimeout(() => {
    const b = mainButtons(true).find((x) => x.dataset.id === id);
    b?.focus({ preventScroll: true });
    b?.closest("tr").scrollIntoView({ block: "nearest" });
  }, 60);
});

function openDrawer(id, found) {
  const g = found ?? solves.find((x) => x.events.some((y) => y.id === id));
  drawerGroup = g ?? null;
  drawerId = g && g.events.length > 1 ? g.main.id : id;
  drawerOpen = true;
}

const rowClick = (id) => (node) => {
  const handler = (ev) => {
    if (ev.target.closest("button, a") || getSelection()?.toString()) return;
    openDrawer(id);
  };
  node.addEventListener("click", handler);
  return () => node.removeEventListener("click", handler);
};
</script>

{#snippet ring(score)}
  {@const tone = score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-muted-foreground/60"}
  <span class="relative inline-flex size-7 items-center justify-center" title="Risk {score} of 100">
    <svg viewBox="0 0 28 28" class="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="none" stroke="var(--border)" stroke-width="2.5" />
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="{Math.max(score, 1)} 100" class={tone} />
    </svg>
    <span class="relative text-[10px] font-medium tabular-nums">{score}</span>
  </span>
{/snippet}

{#snippet steps(g)}
  {@const r = g.events.find((x) => x.type === "redeem")}
  {@const c = g.events.find((x) => x.type === "challenge")}
  {@const note = [r?.outcome === "pass" && r.solve_ms && `in ${latency(r.solve_ms)}`, (c ?? r)?.origin && `on ${(c ?? r).origin}`].filter(Boolean).join(" ")}
  {#if note}<span class="ev-sub truncate text-xs text-muted-foreground max-sm:hidden">{note}</span>{/if}
{/snippet}

{#snippet line(e, g, child, open)}
  {@const selected = drawerOpen && drawerId === e.id}
  {@const d0 = g?.timedOut ? "timeout" : (g ? g.events.every(issued) : issued(e)) ? "issued" : g ? g.decision : isFlagged(e) ? "flagged" : e.outcome}
  {@const d = d0 === "fail" ? failKind((g?.events ?? [e]).find((x) => x.outcome === "fail") ?? e) : d0}
  {@const decision = DECISIONS[d] ?? [d, "text-foreground"]}
  {@const kind = g?.timedOut ? ["Challenge expired", "clock", "bg-muted text-faint-foreground"] : e.outcome === "block" ? ["Request blocked", "ban", "bg-destructive/12 text-destructive"] : e.outcome === "limit" ? ["Too many requests", "clock", "bg-violet/12 text-violet"] : failedKind(e) ?? (KINDS[e.type] ?? [e.type, "events", "bg-muted text-muted-foreground"])}
  {@const score = e.score == null ? null : Math.round(e.score * 100)}
  {@const note = g?.timedOut ? "Expired after 15 minutes" : decisionNote(e)}
  {@const who = g ? g.client : e}
  {@const born = child ? null : (g?.events ?? [e]).find((x) => x.fresh && performance.now() - x.fresh < 1500)}
  <TableRow
    data-clickable
    data-state={selected ? "selected" : undefined}
    data-group={!child && g && g.events.length > 1 ? g.id : undefined}
    class="ev-row cursor-pointer {child ? 'ev-child bg-muted/40' : ''} {born ? 'ev-fresh' : ''}"
    {@attach rowClick(e.id)}
  >
    <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums max-sm:hidden" title={fullFmt.format(new Date(e.ts))}>
      <span class="flex items-center gap-1.5">
        {#if g && g.events.length > 1}
          <button
            type="button"
            class="-ms-[22px] flex size-6 shrink-0 cursor-pointer md:-ms-[30px] items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
            aria-expanded={open}
            aria-label="{open ? 'Hide' : 'Show'} the {g.events.length} events in this solve"
            onclick={() => {
              const next = new Set(expanded);
              if (open) next.delete(g.id);
              else next.add(g.id);
              expanded = next;
            }}
          >
            <Icon name="right" size={12} class="transition-transform duration-150 {open ? 'rotate-90' : ''}" />
          </button>
        {:else}
          <span class="-ms-[22px] size-6 shrink-0 md:-ms-[30px]" aria-hidden="true"></span>
        {/if}
        {clock.format(new Date(g ? g.ts : e.ts))}
      </span>
    </TableCell>
    <TableCell class="whitespace-nowrap max-sm:hidden">
      {#if !child}
        <span class="block {decision[1]}">{decision[0]}</span>
        {#if note}<span class="ev-sub block max-w-44 truncate text-xs text-muted-foreground" title={note}>{note}</span>{/if}
      {/if}
    </TableCell>
    <TableCell class="py-1.5! max-md:hidden">{#if score != null && !child}{@render ring(score)}{/if}</TableCell>
    <TableCell class="w-full max-w-0 max-sm:ps-6">
      <button
        type="button"
        class="ev-main flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-sm text-left outline-none {child ? 'ps-[38px]' : ''}"
        data-id={e.id}
        onclick={() => openDrawer(e.id)}
      >
        <span class="flex size-7 {child ? 'hidden' : ''} shrink-0 items-center justify-center rounded-md {kind[2]}" aria-hidden="true">
          <Icon name={kind[1]} size={14} stroke={2.25} />
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate">{g && g.events.length > 1 && !g.timedOut ? g.title : kind[0]}</span>
          {#if g && g.events.length > 1}
            {@render steps(g)}
          {:else if child}
            {#if childNote(e)}<span class="ev-sub truncate text-xs text-muted-foreground max-sm:hidden">{childNote(e)}</span>{/if}
          {:else if kindNote(e)}
            <span class="ev-sub truncate text-xs text-muted-foreground max-sm:hidden">{kindNote(e)}</span>
          {/if}
          <span class="truncate text-xs sm:hidden"><span class={decision[1]}>{decision[0]}</span><span class="text-muted-foreground">, {clock.format(new Date(g ? g.ts : e.ts))}</span></span>
        </span>
      </button>
    </TableCell>
    <TableCell class="whitespace-nowrap max-md:hidden">
      {#if !child}
      {#if who.ip && who.type !== "siteverify"}
        <span class="flex min-w-0 flex-col">
          <button
            type="button"
            class="cursor-pointer self-start rounded-sm font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
            title="Show only events from {who.ip}"
            onclick={() => addFilter(`ip:${who.ip}`)}
          >{who.ip}</button>
          {#if who.browser}<span class="ev-sub text-xs text-muted-foreground">{who.browser}{who.os ? ` on ${who.os}` : ""}</span>{/if}
        </span>
      {:else}
        <span class="text-muted-foreground">{who.type === "siteverify" ? "Your server" : "No IP"}</span>
      {/if}
      {/if}
    </TableCell>
    <TableCell class="whitespace-nowrap max-lg:hidden">
      {#if !child}
      {#if who.country}
        <span class="flex items-center gap-2.5">
          {#if flagUrl(who.country)}
            <img
              src={flagUrl(who.country)}
              alt=""
              class="size-5 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              width="20"
              height="20"
              onerror={(ev) => (ev.currentTarget.style.visibility = "hidden")}
            />
          {/if}
          <span class="flex min-w-0 flex-col">
            <button
              type="button"
              class="cursor-pointer self-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
              title="Show only events from {countryName(who.country)}"
              onclick={() => addFilter(`country:${who.country}`)}
            >{countryName(who.country)}</button>
            {#if who.asn_org}
              <button
                type="button"
                class="ev-sub max-w-48 cursor-pointer self-start truncate rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
                title="Show only events from {who.asn_org}"
                onclick={() => addFilter(`asn_org:${who.asn_org}`)}
              >{who.asn_org}</button>
            {/if}
          </span>
        </span>
      {:else}
        <span class="text-faint-foreground">Unknown</span>
      {/if}
      {/if}
    </TableCell>
    <TableCell class="w-px ps-0 pe-4 md:pe-5">
      {#if !child}
        <span
          class="ev-pick flex items-center justify-end"
          role="presentation"
          onclickcapture={(ev) => {
            shifted = ev.shiftKey;
          }}
        >
          <Checkbox
            checked={chosen.has(e.id)}
            label="Select this event"
            onchange={(v) => choose(e.id, who, v)}
          />
        </span>
      {/if}
    </TableCell>
  </TableRow>
{/snippet}

<svelte:window onkeydown={keys} />

<PageHeader title="Events">
  {#snippet actions()}
  <div class="flex items-center" role="group" aria-label="Live updates and time range">
      <Toggle variant="outline" size="lg" class="-me-px rounded-s-[calc(var(--radius)-4px)] rounded-e-none focus-visible:z-10" bind:pressed={live} title={live ? "Stop following new events" : "Show new events as they come in"}>
        <span class="relative flex size-2">
          {#if live}<span class="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:hidden"></span>{/if}
          <span class="relative size-2 rounded-full {live ? 'bg-success' : 'bg-faint-foreground'}"></span>
        </span>
        Live
        {#if live && rate != null}
          <span class="min-w-11 text-start text-muted-foreground tabular-nums max-sm:hidden" title="Events per second over the last 15 seconds">{rateText(rate)}/s</span>
        {/if}
      </Toggle>
      <RangePicker
        class="rounded-s-none rounded-e-[calc(var(--radius)-4px)]"
        value={range}
        ranges={RANGES}
        onchange={(id) => {
          range = id;
          load();
        }}
      />
    </div>
  {/snippet}
</PageHeader>

<div id="evSticky" class="sticky top-12 z-10 bg-background md:top-0 md:-mt-11 md:pt-11">
{#if pending.length && view === "list"}
  <div class="pointer-events-none absolute inset-x-0 top-full flex justify-center pt-3">
    <button
      type="button"
      transition:rise
      class="pointer-events-auto flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-foreground ps-2.5 pe-3 text-sm font-medium text-background tabular-nums shadow-overlay outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onclick={() => {
        flush();
        scrollToTop(document.getElementById("evTable"), true);
      }}
    >
      <Icon name="up" size={13} stroke={2.25} />
      {pending.length >= 500 ? "500+" : n(pending.length)} new {pending.length === 1 ? "event" : "events"}
    </button>
  </div>
{/if}
<div class="px-4 pt-4 pb-2 md:px-5">
  <div>
    <label for="evSearch" class="sr-only">Search events</label>
    <SearchBar
      {filters}
      query={q}
      busy={loading}
      suggest={suggestValues}
      storeKey={sk}
      onreplace={(next, v) => {
        q = v;
        setFilters([...next]);
      }}
      onadd={addFilter}
      onremove={(f) => setFilters(filters.filter((x) => x !== f))}
      ontoggle={(f) => {
        const neg = f.startsWith("-");
        setFilters(filters.map((x) => (x === f ? (neg ? f.slice(1) : `-${f}`) : x)));
      }}
      onquery={(v) => {
        if (v === q) return;
        q = v;
        refresh();
      }}
    />
  </div>
</div>

<Tabs
  class="px-4 md:px-8"
  label="Outcome"
  bind:value={outcome}
  onchange={refresh}
  items={[
    { id: "all", label: "All events", count: summary && compact(COUNTS.all(summary)) },
    { id: "pass", label: "Allowed", count: summary && compact(COUNTS.pass(summary)) },
    { id: "flagged", label: "Flagged", count: summary && compact(COUNTS.flagged(summary)) },
    { id: "fail", label: "Failed", count: summary && compact(COUNTS.fail(summary)) },
    { id: "block", label: "Blocked", count: summary && compact(COUNTS.block(summary)) },
    { id: "limit", label: "Rate limited", count: summary && compact(COUNTS.limit(summary)) },
  ]}
>
  {#snippet aside()}
    <Menu width="w-52">
      {#snippet trigger(props)}
        <Button {...props} variant="ghost" size="sm" icon class="size-7! max-sm:hidden" aria-label="Export events" title="Export what's shown" disabled={exporting || totalsOnly}>
          {#if exporting}
            <Icon name="loader" size={15} />
          {:else}
            <svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 2.75v7.5M4.75 7 8 10.25 11.25 7M3 13.25h10" />
            </svg>
          {/if}
        </Button>
      {/snippet}
      <MenuItem onselect={() => exportEvents("csv")} hint="CSV">For spreadsheets</MenuItem>
      <MenuItem onselect={() => exportEvents("ndjson")} hint="NDJSON">One event per line</MenuItem>
    </Menu>
    <Toggle
      size="sm"
      class="me-2 max-sm:hidden"
      bind:pressed={dense}
      aria-label="Compact rows"
      title={dense ? "Show two lines per event" : "Show one line per event"}
    >
      <svg viewBox="0 0 16 16" class="size-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
        <path d="M2.75 3.25h10.5M2.75 6.42h10.5M2.75 9.58h10.5M2.75 12.75h10.5" />
      </svg>
    </Toggle>
    <span class="me-2 text-sm text-muted-foreground max-sm:sr-only">View by</span>
    <SlidingTabs
      tabs={[{ id: "list", label: "List" }, { id: "map", label: "Map" }, { id: "top", label: "Top" }]}
      bind:value={() => view, setView}
      flat
      class="rounded-lg bg-foreground/6 p-0.5"
      pillClass="rounded-md bg-background shadow-[0_0_0_1px_var(--border)]"
      activeTabClass="text-foreground"
      tabClass="rounded-md px-2.5 py-1 text-sm"
    />
  {/snippet}
</Tabs>
</div>

<div class="px-4 pt-5 pb-4 md:px-5">
  <Skeleton data={overview} sample={samples.overview} label="Loading chart">
    {#snippet children(o)}
      <Histogram
        height={110}
        series={o.series}
        bucket={o.range.bucket}
        active={flaggedOnly ? "flagged" : null}
        picked={zoomed ? null : custom?.from}
        pickedTo={zoomed ? null : custom?.to}
        onpick={pickBucket}
      />
    {/snippet}
  </Skeleton>
</div>

{#if custom}
  <div class="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2 md:px-5" role="status">
    <p class="me-auto text-sm tabular-nums">
      <span class="font-semibold">{loading ? "Loading" : `${n(total)} ${total === 1 ? "event" : "events"}`}</span>
      <span class="text-muted-foreground">from {sliceFmt.format(new Date(custom.from))} to {(dayOf(custom.from) === dayOf(custom.to - 1) ? sliceTime : sliceFmt).format(new Date(custom.to))}</span>
    </p>
    <Button size="sm" onclick={load}>
      <Icon name="left" size={13} />
      Back to {rangeInfo.long}
    </Button>
  </div>
{/if}

{#if view === "top"}
  <Skeleton class="border-t border-border" data={tops} sample={TOP_SAMPLE} label="Loading top values">
    {#snippet children(t)}
      <div class="px-4 pt-5 pb-10 md:px-5">
        {#if TOP_DIMS.some(([d]) => t[d]?.length)}
          <TopView
            data={t}
            onpick={(f) => {
              setView("list");
              addFilter(f);
            }}
          />
        {:else}
          <Empty title="Nothing to rank">No events match in {rangeInfo.long}. Remove a filter or pick a longer range.</Empty>
        {/if}
      </div>
    {/snippet}
  </Skeleton>
{:else if view === "map"}
  <Skeleton class="border-t border-border" data={where} sample={samples.where} label="Loading map">
    {#snippet children(w)}
      {@const countries = w.country ?? []}
      <div class="flex flex-col gap-5 px-4 pt-5 pb-10 md:px-5">
        {#if !countries.length}
          <Empty title="No locations">Nothing that matches has a country. Turn on visitor location in instance settings, or widen the search.</Empty>
        {:else}
          <WorldMap
            values={Object.fromEntries(countries.map((r) => [r.value, r.n]))}
            describe={(code) => {
              const r = countries.find((x) => x.value === code);
              return r ? `${n(r.n)} events` : "";
            }}
            onpick={pickCountry}
          />
          <div class="grid gap-6 md:grid-cols-2">
            {#each [["Countries", countries, "country"], ["Networks", w.asn_org ?? [], "asn_org"]] as [title, list, field] (field)}
              {@const top = Math.max(1, ...list.map((r) => r.n))}
              <section aria-label={title}>
                <h2 class="mb-1.5 flex px-2 text-xs font-medium text-muted-foreground">
                  <span class="me-auto">{title}</span><span>Events</span>
                </h2>
                <ul class="flex flex-col gap-0.5">
                  {#each list.slice(0, 10) as r (r.value)}
                    <li>
                      <button
                        type="button"
                        class="relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
                        onclick={() => (field === "country" ? pickCountry(r.value) : (setView("list"), addFilter(`asn_org:${r.value}`)))}
                      >
                        <span class="absolute inset-y-0 start-0 rounded-md bg-foreground/[0.06]" style:width="{Math.max(1.5, (r.n / top) * 100)}%"></span>
                        {#if field === "country"}
                          {#if flagUrl(r.value)}<img src={flagUrl(r.value)} alt="" class="relative h-3.5 w-[18px] rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" width="18" height="14" />{/if}
                          <span class="relative truncate">{countryName(r.value) || r.value}</span>
                        {:else}
                          <span class="relative flex size-4 shrink-0 items-center justify-center"><AsnIcon asn={r.label} /></span>
                          <span class="relative truncate">{r.value}</span>
                        {/if}
                        <span class="relative ms-auto font-medium tabular-nums">{compact(r.n)}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              </section>
            {/each}
          </div>
        {/if}
      </div>
    {/snippet}
  </Skeleton>
{:else}
  <Skeleton data={loading && !rows.length ? null : solves} sample={sampleSolves} empty={!loading && !rows.length} preload={[...new Set(rows.map((r) => flagUrl(r.country)))]} label="Loading events">
    {#snippet emptyMessage()}
      <div class="border-t border-border px-4 md:px-5">
        <Empty title={totalsOnly ? "Cap isn't keeping single events" : custom ? "Nothing in this slice" : narrowed ? "No events match" : "No events yet"}>
          {#if totalsOnly}
            {overview?.storage === "off" ? "Cap was started with ANALYTICS=off, so it doesn't store events." : "Cap was started with ANALYTICS=redis, so it only counts totals for the overview."} Start it with ANALYTICS=duckdb or CLICKHOUSE_URL to see each event here.
          {:else if custom}
            Go back to the full range to see the rest.
          {:else if narrowed}
            Nothing in {rangeInfo.long} matches this search. Remove a filter or pick a longer range.
          {:else}
            Events show up here as soon as the widget on your site asks for a challenge.
          {/if}
          {#snippet action()}
            {#if totalsOnly}
              <Button size="sm" onclick={() => navigate({ view: "settings", section: "analytics" })}>Open storage settings</Button>
            {:else if custom}
              <Button size="sm" onclick={load}>Back to {rangeInfo.long}</Button>
            {:else if narrowed}
              <Button size="sm" onclick={resetAll}>Clear search and filters</Button>
            {:else}
              <Button size="sm" onclick={() => navigate({ view: "key", siteKey: sk, tab: "configuration" })}>Set up the widget</Button>
            {/if}
          {/snippet}
        </Empty>
      </div>
    {/snippet}
    {#snippet children(list)}
      <Table flush id="evTable" class="{dense ? 'ev-dense' : ''} {chosen.size ? 'ev-picking' : ''} scroll-mt-40 border-t md:scroll-mt-28 border-border transition-opacity duration-200 {loading && rows.length ? 'opacity-60' : ''}">
        <TableHeader class="max-sm:hidden">
          <TableRow>
            <TableHead class="w-px max-sm:hidden">Time</TableHead>
            <TableHead class="w-px max-sm:hidden">Decision</TableHead>
            <TableHead class="w-px max-md:hidden" title="Risk score from 0 to 100">Risk</TableHead>
            <TableHead>Event</TableHead>
            <TableHead class="max-md:hidden">Visitor</TableHead>
            <TableHead class="max-lg:hidden">Location</TableHead>
            <TableHead class="w-px ps-0 pe-4 md:pe-5">
              <span class="ev-pick flex items-center justify-end">
                <Checkbox
                  checked={pageAll}
                  label={pageAll ? "Clear the selection" : "Select every event on this page"}
                  onchange={(v) => {
                    const next = new Map(chosen);
                    for (const g of solves) {
                      if (v) next.set(g.main.id, g.client);
                      else next.delete(g.main.id);
                    }
                    chosen = next;
                  }}
                />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={loading}>
          {#each list as g, i (g.id)}
            {@const open = expanded.has(g.id)}
            {#if !i || dayOf(list[i - 1].ts) !== dayOf(g.ts)}
              <TableRow class="bg-muted/50 hover:bg-muted/50"><TableCell colspan="7" class="h-8! py-0! text-xs font-medium text-muted-foreground">{dayFmt.format(new Date(g.ts))}</TableCell></TableRow>
            {/if}
            {@render line(g.main, g, false, open)}
            {#if open}
              {#each g.events as e (e.id)}{@render line(e, null, true, false)}{/each}
            {/if}
          {/each}
        </TableBody>
      </Table>

      {#if chosen.size}
        <div class="pointer-events-none sticky bottom-4 z-20 flex justify-center px-4" transition:rise>
          <div class="pointer-events-auto flex items-center gap-1 rounded-xl bg-popover p-1.5 ps-3.5 text-sm text-popover-foreground shadow-overlay" role="toolbar" aria-label="Selected events">
            <span class="me-2 font-medium tabular-nums">{n(chosen.size)} selected</span>
            <Button size="sm" variant="ghost" onclick={copyIps} disabled={!chosenIps.length}>Copy IPs</Button>
            <Button size="sm" variant="ghost" onclick={addChosen} disabled={!chosenIps.length}>Add IPs to list</Button>
            <Button size="sm" variant="ghost" icon aria-label="Clear the selection" title="Clear the selection" onclick={() => (chosen = new Map())}>
              <Icon name="x" size={14} />
            </Button>
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-3 border-t border-border px-4 py-3 text-sm md:px-5">
        <span class="me-auto text-muted-foreground tabular-nums">
          {#if flaggedOnly}Page {page + 1}{:else}{n(page * PAGE + 1)} to {n(page * PAGE + rows.length)} of {n(Math.max(total, page * PAGE + rows.length))}{/if}
        </span>
        <span class="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex" aria-hidden="true">
          <Kbd>j</Kbd><Kbd>k</Kbd> to move, <Kbd>x</Kbd> to select, <Kbd>/</Kbd> to search
        </span>
        <Pagination class="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious disabled={!page || loadingMore} onclick={() => goPage(page - 1)} />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext disabled={!cursor || loadingMore} onclick={() => goPage(page + 1)} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    {/snippet}
  </Skeleton>
{/if}

{#if listing}
  <AddToListModal candidates={listing} checkAll onclose={() => (listing = null)} />
{/if}

<EventDrawer
  bind:open={drawerOpen}
  id={drawerId}
  solve={drawerGroup?.events.length > 1 ? drawerGroup : null}
  timedOut={drawerGroup?.timedOut}
  siteKey={sk}
  onopen={openDrawer}
  onstep={step}
  onfilter={(f) => {
    drawerOpen = false;
    addFilter(f);
  }}
/>

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(tr.ev-fresh) {
      animation: ev-in 240ms var(--ease-out) backwards;
    }

    :global(tr.ev-child) {
      animation: ev-in 180ms var(--ease-out) backwards;
    }
  }

  :global(#evTable tr.ev-row:has(.ev-main:focus-visible)) {
    background-color: var(--muted);
  }

  :global(#evTable tr.ev-row:has(.ev-main:focus-visible) > td:first-child) {
    box-shadow: inset 2px 0 0 var(--primary);
  }

  :global(#evTable tr.ev-row) {
    scroll-margin-block: 11rem 1rem;
  }

  @media (width >= 40rem) {
    :global(.ev-dense .ev-sub) {
      display: none;
    }

    :global(.ev-dense tr.ev-row > td) {
      height: 2.5rem;
      padding-block: 0.25rem;
    }
  }

  @media (hover: hover) {
    :global(.ev-pick) {
      opacity: 0;
    }

    :global(
      #evTable tr:hover .ev-pick,
      #evTable .ev-pick:focus-within,
      .ev-picking .ev-pick,
      #evTable tr:has(.ev-main:focus-visible) .ev-pick
    ) {
      opacity: 1;
    }
  }

  @media (hover: hover) and (prefers-reduced-motion: no-preference) {
    :global(.ev-pick) {
      transition: opacity 120ms var(--ease-out);
    }
  }

  :global(tr.ev-fresh > td) {
    animation: ev-tint 1800ms ease-out backwards;
  }

  @keyframes ev-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  @keyframes ev-tint {
    from {
      background-color: color-mix(in oklab, var(--primary) 9%, transparent);
    }
  }
</style>
