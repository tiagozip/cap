<script>
import { flip } from "svelte/animate";
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import Bone from "../../components/cap/Bone.svelte";
import {
  Button,
  Drawer,
  Icon,
  Segmented,
  Tag,
} from "../../components/cap/index.js";
import { agentIconId } from "../../lib/agents.js";
import { api } from "../../lib/api.js";
import { ago } from "../../lib/format.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { undoable } from "../../lib/ui.svelte.js";
import { toolName } from "./tools.js";

let grants = $state(null);
let error = $state("");

api("GET", "/oauth/grants").then((r) => {
  if (!Array.isArray(r)) {
    error = r?.error || "Couldn't load connected apps";
    return;
  }
  grants = r;
});

const revoke = (g) => {
  const at = grants.indexOf(g);
  grants = grants.filter((x) => x.id !== g.id);
  undoable({
    message: `${g.clientName} disconnected`,
    commit: async () => {
      const res = await api("DELETE", `/oauth/grants/${g.id}`);
      return res?.success ? null : res?.error || "Couldn't disconnect the app";
    },
    undo: () => {
      grants = grants.toSpliced(at, 0, g);
    },
  });
};

let viewing = $state(null);
let open = $state(false);
let calls = $state(null);
let logError = $state("");

const openKey = (siteKey) => {
  open = false;
  navigate({ view: "key", siteKey, tab: "activity" });
};

const showLog = async (g) => {
  viewing = g;
  fresh = new Set();
  calls = null;
  only = "all";
  hour = null;
  logError = "";
  open = true;
  const res = await api("GET", `/oauth/grants/${g.id}/log`);
  if (viewing !== g) return;
  if (!Array.isArray(res?.calls)) {
    logError = res?.error || "Couldn't load this app's activity";
    return;
  }
  calls = normalize(res.calls);
};

const normalize = (list) => {
  const seen = new Map();
  return list.map((c) => {
    const k = `${c.t}:${c.tool}:${c.status}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return { ...c, id: `${k}:${n}` };
  });
};

let fresh = $state(new Set());
const loaded = $derived(!!calls);
$effect(() => {
  if (!open || !loaded) return;
  const g = viewing;
  const timer = setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await api("GET", `/oauth/grants/${g.id}/log`);
    if (viewing !== g || !open || !Array.isArray(res?.calls)) return;
    const next = normalize(res.calls);
    const known = new Set(calls.map((c) => c.id));
    const added = next.filter((c) => !known.has(c.id)).map((c) => c.id);
    if (!added.length) return;
    fresh = new Set(added);
    calls = next;
  }, 8000);
  return () => clearInterval(timer);
});

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const rowOut = () =>
  still()
    ? { duration: 0 }
    : {
        duration: 150,
        easing: (t) => t * t,
        css: (t) =>
          `opacity:${t};filter:blur(${(1 - t) * 4}px);transform:translateX(${(1 - t) * -6}px)`,
      };
const rowIn = () =>
  still()
    ? { duration: 0 }
    : {
        duration: 260,
        easing: (t) => 1 - (1 - t) ** 3,
        css: (t) =>
          `opacity:${t};filter:blur(${(1 - t) * 4}px);transform:translateY(${(1 - t) * 4}px)`,
      };
const live = (t) => t && Date.now() - t < 10 * 60_000;
const failed = $derived(calls?.filter((c) => c.status >= 400).length ?? 0);
const summary = $derived.by(() => {
  if (!calls?.length) return "Tool calls";
  const n = calls.length === 100 ? "Last 100" : calls.length;
  const base = `${n} tool call${calls.length === 1 ? "" : "s"}`;
  return failed ? `${base}, ${failed} failed` : base;
});

let only = $state("all");
let hour = $state(null);
const HOUR = 3_600_000;
const hours = $derived.by(() => {
  if (!calls?.length) return null;
  const end = Math.floor(Date.now() / HOUR) * HOUR;
  const start = end - 23 * HOUR;
  const out = Array.from({ length: 24 }, (_, i) => ({
    t: start + i * HOUR,
    ok: 0,
    failed: 0,
  }));
  let any = false;
  for (const c of calls) {
    const i = Math.floor((c.t - start) / HOUR);
    if (i < 0 || i > 23) continue;
    any = true;
    if (c.status < 400) out[i].ok++;
    else out[i].failed++;
  }
  return any ? out : null;
});
const peak = $derived(
  hours ? Math.max(...hours.map((h) => h.ok + h.failed)) : 0,
);
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const hourLabel = (h) =>
  `${hourFmt.format(h.t)}, ${h.ok + h.failed} call${h.ok + h.failed === 1 ? "" : "s"}${h.failed ? `, ${h.failed} failed` : ""}`;
const shown = $derived(
  (calls ?? []).filter(
    (c) =>
      (only === "all" || c.status >= 400) &&
      (hour === null || (c.t >= hour && c.t < hour + HOUR)),
  ),
);
const keyName = (sk) => app.keys.find((k) => k.siteKey === sk)?.name ?? sk;
const time = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric",
});
const dayOf = (t) => new Date(t).toDateString();
const dayLabel = (t) => {
  const d = dayOf(t);
  if (d === dayOf(Date.now())) return "Today";
  if (d === dayOf(Date.now() - 86_400_000)) return "Yesterday";
  return dayFmt.format(t);
};
const days = $derived.by(() => {
  const out = [];
  for (const c of shown) {
    const label = dayLabel(c.t);
    if (out.at(-1)?.label !== label) out.push({ label, calls: [] });
    out.at(-1).calls.push(c);
  }
  return out;
});
const failure = (status) =>
  ({
    400: "Bad request",
    401: "Not signed in",
    403: "Not allowed",
    404: "Not found",
    429: "Rate limited",
  })[status] ?? (status >= 500 ? "Server error" : `HTTP ${status}`);
</script>

{#if error}
  <p class="py-5 text-sm text-destructive" role="alert">{error}</p>
{:else if !grants}
  <div class="flex flex-col pb-3" role="status">
    <span class="sr-only">Loading connected apps</span>
    {#each [6, 4.5] as w, i (i)}
      <div class="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
        <Bone height="2.25rem" width="2.25rem" radius="10px" />
        <div class="flex flex-col gap-1.5">
          <Bone height="0.875rem" width="{w}rem" />
          <Bone height="0.75rem" width="7rem" />
        </div>
      </div>
    {/each}
  </div>
{:else if !grants.length}
  <p class="pb-5 text-sm text-pretty text-muted-foreground">No apps yet. Add the server to your agent with the setup above and it will ask you to approve it here.</p>
{:else}
  <ul class="flex flex-col pb-3">
    {#each grants as g (g.id)}
      <li class="app-row relative flex items-center gap-3 border-b border-border py-3 last:border-b-0" animate:flip={{ delay: still() ? 0 : 110, duration: still() ? 0 : 220, easing: (t) => 1 - (1 - t) ** 3 }} in:rowIn out:rowOut>
        <span class="relative grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted ring-1 ring-foreground/10">
          <AgentIcon id={agentIconId(g.clientName)} size={18} />
          {#if live(g.lastUsed)}<span class="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-background" title="Active in the last 10 minutes"><span class="sr-only">Active in the last 10 minutes</span></span>{/if}
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex min-w-0 items-center gap-2">
            <button type="button" class="app-open truncate text-start text-sm font-medium outline-none" title={g.clientName} aria-label="Show what {g.clientName} did" onclick={() => showLog(g)}>{g.clientName}</button>
            <Tag tone={g.access === "read" ? "neutral" : "warning"}>{g.access === "read" ? "Read-only" : "Full access"}</Tag>
          </span>
          <span class="flex min-w-0 flex-wrap items-center gap-x-3 text-xs text-muted-foreground tabular-nums">
            <span title={g.siteKeys?.map(keyName).join(", ")}>{g.siteKeys ? (g.siteKeys.length === 1 ? keyName(g.siteKeys[0]) : `${g.siteKeys.length} site keys`) : "All site keys"}</span>
            <span class={live(g.lastUsed) ? "text-foreground" : ""}>{g.lastUsed ? `Used ${ago(g.lastUsed)}` : "Not used yet"}</span>
          </span>
        </div>
        <Icon name="right" size={14} class="app-chevron hidden shrink-0 text-faint-foreground sm:block" />
        <Button variant="ghost" size="sm" class="relative z-10 shrink-0" aria-label="Disconnect {g.clientName}" onclick={() => revoke(g)}>Disconnect</Button>
      </li>
    {/each}
  </ul>
{/if}

<Drawer
  bind:open
  title={viewing?.clientName ?? ""}
  description={summary}
>
  {#snippet actions()}
    {#if viewing && grants?.some((x) => x.id === viewing.id)}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Disconnect {viewing.clientName}"
        onclick={() => {
          open = false;
          revoke(viewing);
        }}>Disconnect</Button>
    {/if}
  {/snippet}
  {#snippet lead()}
    {#if viewing}
      <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-foreground/10"><AgentIcon id={agentIconId(viewing.clientName)} size={18} /></span>
    {/if}
  {/snippet}
  {#if logError}
    <p class="text-sm text-destructive" role="alert">{logError}</p>
  {:else if !calls}
    <div class="flex flex-col gap-1" role="status">
      <span class="sr-only">Loading activity</span>
      <Bone height="0.75rem" width="3.5rem" class="mb-2" />
      {#each [7, 5, 6, 8] as w, i (i)}
        <div class="flex items-center gap-3 py-2.5">
          <Bone height="1.25rem" width="1.25rem" radius="999px" />
          <Bone height="0.875rem" width="{w}rem" />
          <Bone height="0.75rem" width="3rem" class="ms-auto" />
        </div>
      {/each}
    </div>
  {:else if !calls.length}
    <p class="text-sm text-pretty text-muted-foreground">No tool calls yet.</p>
  {:else}
    <div class="flex flex-col gap-5">
      {#if hours || failed}
        <div class="flex flex-col gap-3">
          {#if hours}
            <div class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span>Last 24 hours</span>
                {#if hour !== null}
                  <button type="button" class="rounded-[4px] text-foreground underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline" onclick={() => (hour = null)}>Show all hours</button>
                {/if}
              </div>
              <div class="hours flex h-14 items-end gap-[3px]" role="group" aria-label="Tool calls per hour">
                {#each hours as h (h.t)}
                  {@const n = h.ok + h.failed}
                  <button
                    type="button"
                    class="hour-bar group relative flex h-full flex-1 flex-col justify-end rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                    data-dim={hour !== null && hour !== h.t}
                    disabled={!n}
                    aria-label={hourLabel(h)}
                    aria-pressed={hour === h.t}
                    title={n ? hourLabel(h) : undefined}
                    onclick={() => (hour = hour === h.t ? null : h.t)}
                  >
                    {#if n}
                      <span class="flex w-full flex-col overflow-hidden rounded-[3px]" style:height="{Math.max(12, (n / peak) * 100)}%">
                        {#if h.failed}<span class="w-full bg-destructive/75" style:flex-grow={h.failed}></span>{/if}
                        {#if h.ok}<span class="w-full bg-foreground/35" style:flex-grow={h.ok}></span>{/if}
                      </span>
                    {:else}
                      <span class="h-[2px] w-full rounded-full bg-foreground/10"></span>
                    {/if}
                  </button>
                {/each}
              </div>
              <div class="flex justify-between text-[11px] text-faint-foreground tabular-nums" aria-hidden="true">
                <span>{hourFmt.format(hours[0].t)}</span>
                <span>Now</span>
              </div>
            </div>
          {/if}
          {#if failed}
            <Segmented
              size="sm"
              class="self-start"
              label="Show"
              bind:value={only}
              options={[
                ["all", "All"],
                ["failed", `Failed ${failed}`],
              ]}
            />
          {/if}
        </div>
      {/if}
      {#if !shown.length}
        <p class="text-sm text-muted-foreground">No calls match.</p>
      {/if}
      {#each days as day, d (day.label)}
        <section class="calls-day flex flex-col gap-1" style:--d={Math.min(d, 4)} aria-labelledby="calls-day-{d}">
          <h3 id="calls-day-{d}" class="text-xs font-medium text-muted-foreground">{day.label}</h3>
          <ol class="flex flex-col">
            {#each day.calls as c (c.id)}
              {@const ok = c.status < 400}
              <li class="flex items-start gap-3 py-2" class:call-new={fresh.has(c.id)}>
                <span class="flex h-lh items-center" aria-hidden="true">
                  <span class="grid size-5 place-items-center rounded-full {ok ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive'}">
                    <Icon name={ok ? "check" : "x"} size={12} />
                  </span>
                </span>
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="text-sm font-medium">{toolName(c.tool)}<span class="sr-only">{ok ? ", succeeded" : `, failed: ${failure(c.status)}`}</span></span>
                  {#if !ok || c.siteKey}
                    <span class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                      {#if !ok}<span class="shrink-0 font-medium text-destructive" aria-hidden="true">{failure(c.status)}</span>{/if}
                      {#if c.siteKey && app.keys.some((k) => k.siteKey === c.siteKey)}
                        <button type="button" class="truncate rounded-[4px] underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline" onclick={() => openKey(c.siteKey)}>{keyName(c.siteKey)}</button>
                      {:else if c.siteKey}
                        <span class="truncate">{c.siteKey}</span>
                      {/if}
                    </span>
                  {/if}
                </div>
                <time class="text-xs whitespace-nowrap text-muted-foreground tabular-nums" datetime={new Date(c.t).toISOString()} title={time.format(c.t)}>{ago(c.t)}</time>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  {/if}
</Drawer>

<style>
  .app-open::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 10px;
  }

  .app-open:focus-visible::after {
    box-shadow: inset 0 0 0 2px var(--color-ring);
  }

  .hour-bar[data-dim="true"] {
    opacity: 0.35;
  }

  .hour-bar {
    transition-property: opacity;
    transition-duration: 150ms;
  }

  @media (hover: hover) {
    .app-row:has(.app-open:hover) {
      background: color-mix(in oklab, var(--color-muted) 50%, transparent);
    }

    .hour-bar:not(:disabled):hover {
      opacity: 0.8;
    }
  }

</style>
