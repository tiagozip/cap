<script>
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import {
  Button,
  Checkbox,
  Group,
  Icon,
  PageHeader,
  Row,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Switch,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  Card,
  CardContent,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  RadioGroup,
  RadioGroupItem,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tip,
} from "../../components/ui/index.js";
import { api, qs } from "../../lib/api.js";
import { catalog, loadCatalog } from "../../lib/catalog.svelte.js";
import { compact } from "../../lib/format.js";
import { app, navigate, openEvents } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import BlockRules from "../config/BlockRules.svelte";
import { PRESETS, presetOf } from "../config/presets.js";
import Rules from "../rules/Rules.svelte";

const key = app.key;

const fromConfig = (c) => ({
  protocol:
    c.protocol === "sha256-pow" || (!c.protocol && !c.rsw)
      ? "sha256-pow"
      : "hashwx",
  hashwxDifficulty: c.hashwxDifficulty ?? 1_000_000,
  sha256Fallback: !!c.sha256Fallback,
  automation: c.blockAutomatedBrowsers ? "block" : "report",
  scripted: c.blockAutomatedInteractions
    ? "block"
    : c.detectAutomatedInteractions
      ? "report"
      : "off",
  behavior: c.behavior ?? "off",
  agents: c.blockAgents ?? "off",
  signedAgents: !!c.allowVerifiedAgents,
  signals: { ...(c.signalActions ?? {}) },
  agentActions: { ...(c.agentActions ?? {}) },
  threshold: c.behaviorThreshold ?? 0.75,
  strict: !!c.behaviorStrict,
  requireInteraction: c.requireInteraction === true,
});

const toPatch = (f) => ({
  instrumentation: true,
  blockAutomatedBrowsers: f.automation === "block",
  detectAutomatedInteractions: f.scripted === "report",
  blockAutomatedInteractions: f.scripted === "block",
  behavior: f.behavior,
  blockAgents: f.agents,
  allowVerifiedAgents: f.signedAgents,
  signalActions: f.signals,
  agentActions: f.agentActions,
  behaviorThreshold: Number(f.threshold) === 0.75 ? null : Number(f.threshold),
  behaviorStrict: f.strict,
  requireInteraction: f.requireInteraction,
  ...(f.protocol === "hashwx" && {
    protocol: f.protocol,
    hashwxDifficulty: Number(f.hashwxDifficulty),
    sha256Fallback: f.sha256Fallback,
  }),
});

let saved = $state(fromConfig(key.config ?? {}));
let form = $state(fromConfig(key.config ?? {}));
let saving = $state(false);
let checkQuery = $state("");
let focusRing = $state(null);
let collapsed = $state(new Set());
const sectionOpen = (label) => !!checkQuery.trim() || !collapsed.has(label);
const toggleSection = (label) => {
  const next = new Set(collapsed);
  if (next.has(label)) next.delete(label);
  else next.add(label);
  collapsed = next;
};
let narrow = $state(false);
$effect(() => {
  const mq = matchMedia("(width < 40rem)");
  const sync = () => (narrow = mq.matches);
  sync();
  mq.addEventListener("change", sync);
  return () => mq.removeEventListener("change", sync);
});
let seen = $state(null);
let agentSeen = $state({});
Promise.all([
  loadCatalog(),
  api(
    "GET",
    `/keys/${key.siteKey}/analytics/top${qs({ range: "7d", dims: "flag,agent", limit: 100 })}`,
  ),
]).then(([, top]) => {
  seen = Object.fromEntries((top?.flag ?? []).map((r) => [r.value, r.n]));
  agentSeen = Object.fromEntries((top?.agent ?? []).map((r) => [r.value, r.n]));
});

const level = $derived(
  presetOf({
    protocol: form.protocol,
    hashwxDifficulty: Number(form.hashwxDifficulty),
    instrumentation: true,
    blockAutomatedBrowsers: form.automation === "block",
    blockAutomatedInteractions: form.scripted === "block",
    behavior: form.behavior,
  }),
);

const applyPreset = (p) => {
  const c = p.config;
  form.protocol = c.protocol;
  form.hashwxDifficulty = c.hashwxDifficulty;
  form.sha256Fallback = c.sha256Fallback;
  form.automation = c.blockAutomatedBrowsers ? "block" : "report";
  form.scripted = c.blockAutomatedInteractions
    ? "block"
    : form.scripted === "block"
      ? "report"
      : form.scripted;
  form.behavior = c.behavior;
};

const dirty = $derived(
  JSON.stringify(toPatch(form)) !== JSON.stringify(toPatch(saved)),
);

const signals = $derived(
  catalog.signals.flatMap((g) =>
    g.signals.map(([id, text, strength]) => ({
      id,
      text,
      strength,
      group: g.label,
      requires: g.requires,
    })),
  ),
);
const matches = (...texts) => {
  const q = checkQuery.trim().toLowerCase();
  return !q || texts.some((t) => t?.toLowerCase().includes(q));
};
const shownSignals = $derived(
  signals.filter((s) => matches(s.text, s.group, s.id)),
);
const shownAgents = $derived(
  catalog.agents.filter(([id, name, about]) =>
    matches(id, name, about, "AI agents"),
  ),
);

const seenCount = $derived(
  seen ? Object.values(seen).filter(Boolean).length : null,
);

const ROWS = [
  {
    id: "automation",
    title: "Automation tools",
    text: "Headless and remote-controlled browsers, like Puppeteer, Playwright or Selenium.",
    options: [
      ["report", "Flag"],
      ["block", "Block"],
    ],
    blockNote: "This also stops your own test scripts.",
  },
  {
    id: "scripted",
    title: "Scripted clicks",
    text: "Clicks and key presses that a script sent instead of a person.",
    options: [
      ["off", "Allow"],
      ["report", "Flag"],
      ["block", "Block"],
    ],
  },
  {
    id: "behavior",
    title: "Robotic movement",
    text: "Mouse paths and typing rhythm that don't look like a person.",
    options: [
      ["off", "Allow"],
      ["report", "Flag"],
      ["block", "Block"],
    ],
  },
  {
    id: "agents",
    title: "AI agents",
    text: "Browsers that ChatGPT, Claude, Comet and similar tools drive for someone.",
    options: [
      ["off", "Flag"],
      ["identified", "Block known"],
      ["all", "Block all"],
    ],
  },
];

async function save() {
  saving = true;
  const patch = $state.snapshot(toPatch(form));
  const res = await api("PUT", `/keys/${key.siteKey}/config`, patch);
  saving = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't save protection settings", "error");
    return;
  }
  if (app.key?.siteKey === key.siteKey)
    app.key.config = { ...app.key.config, ...patch };
  saved = fromConfig({ ...(key.config ?? {}), ...patch });
  form = fromConfig({ ...(key.config ?? {}), ...patch });
  toast("Protection settings saved");
}
</script>

{#snippet sectionHead(label, count)}
  {@const shown = sectionOpen(label)}
  <TableRow class="bg-muted/50 hover:bg-muted/50">
    <TableCell colspan={narrow ? 2 : 3} class="h-9 p-0!">
      <button
        type="button"
        class="flex h-9 w-full cursor-pointer items-center gap-1.5 ps-6 pe-6 text-left text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:ps-10 [.cap-card_&]:ps-5"
        aria-expanded={shown}
        onclick={() => toggleSection(label)}
      >
        <Icon name="right" size={12} class="transition-[rotate] duration-150 motion-reduce:transition-none {shown ? 'rotate-90' : ''}" />
        {label}
        <span class="text-faint-foreground tabular-nums">{count}</span>
      </button>
    </TableCell>
  </TableRow>
{/snippet}

{#snippet seenLink(n, filter)}
  {#if n}
    <button
      type="button"
      class="cursor-pointer rounded-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
      onclick={() => openEvents([filter])}
    >
      {compact(n)}
    </button>
  {:else}
    <span class="text-faint-foreground">0</span>
  {/if}
{/snippet}

<PageHeader title="Protection" />

<div class="flex max-w-4xl flex-col gap-6 px-4 pt-5 pb-12 md:px-5">
  <Group
    id="protLevel"
    title="Defaults"
  >
    <RadioGroup
      aria-labelledby="protLevel"
      class="gap-2 py-5 sm:grid-cols-3"
      bind:value={
        () => level,
        (id) => {
          const p = PRESETS.find((x) => x.id === id);
          if (p) applyPreset(p);
        }
      }
    >
      {#each PRESETS as p (p.id)}
        <label
          data-checked={level === p.id || undefined}
          data-focus-ring={focusRing === p.id || undefined}
          class="flex cursor-pointer flex-col gap-1 rounded-xl bg-card p-3.5 shadow-control transition-[scale] duration-150 ease-out active:scale-[0.98] data-focus-ring:ring-2 data-focus-ring:ring-ring data-checked:bg-primary/[0.06] data-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] motion-reduce:transition-none [@media(hover:hover)]:hover:bg-muted/60 [@media(hover:hover)]:data-checked:hover:bg-primary/[0.06]"
          onfocusin={(e) => (focusRing = e.target.matches(":focus-visible") ? p.id : null)}
          onfocusout={() => (focusRing = null)}
        >
          <span class="flex items-center justify-between gap-2 text-sm font-medium">
            {p.name}
            <RadioGroupItem value={p.id} class="focus-visible:ring-0" />
          </span>
          <span class="text-sm text-pretty text-muted-foreground">{p.text}</span>
        </label>
      {/each}
    </RadioGroup>
    {#if form.protocol === "hashwx"}
      <Row label="HashWX difficulty" help="How many hashes a solve takes on average. Higher means a longer wait on slow devices.">
        <div class="flex w-full max-w-72 items-center gap-3">
          <Slider
            bind:value={() => Number(form.hashwxDifficulty), (v) => (form.hashwxDifficulty = v)}
            min={50000}
            max={5000000}
            step={50000}
            size="sm"
            thumbLabel="HashWX difficulty"
          />
          <output class="w-20 shrink-0 text-right text-sm tabular-nums">{Number(form.hashwxDifficulty).toLocaleString()}</output>
        </div>
      </Row>
    {:else}
      <Row label="Puzzle difficulty" help="This key uses SHA-256 puzzles. Picking a default above switches it to HashWX.">
        <Button size="sm" onclick={() => navigate({ view: "key", siteKey: key.siteKey, tab: "configuration" })}>Open puzzle settings</Button>
      </Row>
    {/if}
    {#each ROWS as row (row.id)}
      <Row label={row.title} help={row.text}>
        <Segmented
          size="sm"
          label={row.title}
          options={row.options}
          danger={["block", "identified", "all"]}
          bind:value={form[row.id]}
        />
        {#snippet below()}
          {#if row.blockNote && form[row.id] === "block"}
            <p class="text-sm text-pretty text-warning md:text-right">{row.blockNote}</p>
          {/if}
          {#if row.id === "agents"}
            <label class="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
              <Checkbox bind:checked={form.signedAgents} label="Always let in agents that sign their requests" />
              Always let in agents that sign their requests
            </label>
          {/if}
        {/snippet}
      </Row>
    {/each}
    {#if form.behavior !== "off"}
      <Row label="{form.behavior === 'block' ? 'Block' : 'Flag'} when Cap is this sure" help="For robotic movement. Lower catches more bots and more false alarms.">
        <div class="flex w-full max-w-64 items-center gap-3">
          <Slider bind:value={form.threshold} min={0.4} max={1} step={0.05} size="sm" thumbLabel="{form.behavior === 'block' ? 'Block' : 'Flag'} when Cap is this sure" />
          <output class="w-10 text-right text-sm tabular-nums">{Math.round(form.threshold * 100)}%</output>
        </div>
      </Row>
      <Row label="Count weak signals" for="protStrict" help="Catches more bots, and some people using voice control.">
        <Switch id="protStrict" bind:checked={form.strict} />
      </Row>
      {#if form.behavior === "block"}
        <Row
          label="Require a click or key press"
          for="protRequire"
          help="Block solves where nobody touched the widget. Leave it off for invisible widgets."
        >
          <Switch id="protRequire" bind:checked={form.requireInteraction} />
        </Row>
      {/if}
    {/if}
  </Group>

  <Rules />

  <BlockRules />

  <Card variant="layered" class="cap-card">
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-2.5 pb-3">
      <span class="flex min-w-0 items-center gap-1.5 text-sm">
        <span class="font-semibold">Single checks</span>
        {#if seenCount}<span class="text-muted-foreground tabular-nums">{seenCount} fired this week</span>{/if}
      </span>
      <InputGroup class="w-full sm:w-64">
        <InputGroupAddon><Icon name="search" size={15} /></InputGroupAddon>
        <InputGroupInput bind:value={checkQuery} placeholder="Search checks" aria-label="Search checks" />
      </InputGroup>
    </div>
    <Skeleton data={seen} sample={{}} label="Loading checks">
      {#snippet children(counts)}
        <CardContent class="max-h-[36rem] overflow-y-auto px-0">
        <Table flush class="max-sm:[&>table]:table-fixed">
          <TableHeader class="sticky top-0 z-10 bg-background!">
            <TableRow>
              <TableHead>Check</TableHead>
              <TableHead class="w-px text-right! whitespace-nowrap max-sm:hidden">This week</TableHead>
              <TableHead class="w-px max-sm:w-[8.25rem]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each shownSignals as s, i (s.id)}
              {#if s.group !== shownSignals[i - 1]?.group}
                {@render sectionHead(s.group, shownSignals.filter((x) => x.group === s.group).length)}
              {/if}
              {#if sectionOpen(s.group)}
              <TableRow>
                <TableCell class="whitespace-normal">
                  <span class="flex min-w-0 flex-col">
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span class="text-pretty">{s.text}</span>
                      {#if s.strength === "strong"}<Tag tone="warning">Strong</Tag>{/if}
                    </span>
                    {#if s.requires === "behavior" && form.behavior === "off"}
                      <span class="text-xs text-muted-foreground">Runs once robotic movement is set to Flag or Block</span>
                    {/if}
                    <span class="text-xs text-muted-foreground tabular-nums sm:hidden">{compact(counts[s.id] ?? 0)} this week</span>
                  </span>
                </TableCell>
                <TableCell class="text-right whitespace-nowrap max-sm:hidden">{@render seenLink(counts[s.id], `flag:${s.id}`)}</TableCell>
                <TableCell>
                  <Select
                    size="sm"
                    class="w-24 sm:w-28"
                    aria-label="What to do with: {s.text}"
                    options={[
                      ["off", "Allow"],
                      ["report", "Flag"],
                      ["block", "Block"],
                    ]}
                    bind:value={() => form.signals[s.id] ?? "report", (v) => {
                      if (v === "report") delete form.signals[s.id];
                      else form.signals[s.id] = v;
                    }}
                  />
                </TableCell>
              </TableRow>
              {/if}
            {/each}
            {#if shownAgents.length}{@render sectionHead("AI agents", shownAgents.length)}{/if}
            {#each sectionOpen("AI agents") ? shownAgents : [] as [id, name, about] (id)}
              <TableRow>
                <TableCell class="whitespace-normal">
                  <span class="flex min-w-0 flex-col">
                    <span class="flex min-w-0 items-center gap-2.5"><AgentIcon {id} /><span class="truncate">{name}</span>{#if catalog.signedAgents.includes(id)}
                      <Tip label="Signs requests">
                        {#snippet children(props)}
                          <span {...props} tabindex="0" class="-ms-1 flex shrink-0 rounded-full text-info outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                              <path fill="currentColor" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                              <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                            <span class="sr-only">Signs requests</span>
                          </span>
                        {/snippet}
                      </Tip>
                    {/if}</span>
                    {#if about}<span class="ps-[26px] text-xs text-pretty text-muted-foreground">{about}</span>{/if}
                    <span class="text-xs text-muted-foreground tabular-nums sm:hidden">{compact(agentSeen[id] ?? 0)} this week</span>
                  </span>
                </TableCell>
                <TableCell class="text-right whitespace-nowrap max-sm:hidden">{@render seenLink(agentSeen[id], `agent:${id}`)}</TableCell>
                <TableCell>
                  <Select
                    size="sm"
                    class="w-24 sm:w-28"
                    aria-label="What to do with {name}"
                    options={[
                      ["default", "Default"],
                      ["allow", "Allow"],
                      ["report", "Flag"],
                      ["block", "Block"],
                    ]}
                    bind:value={() => form.agentActions[id] ?? "default", (v) => {
                      if (v === "default") delete form.agentActions[id];
                      else form.agentActions[id] = v;
                    }}
                  />
                </TableCell>
              </TableRow>
            {/each}
            {#if !shownSignals.length && !shownAgents.length}
              <TableRow><TableCell colspan="3" class="text-muted-foreground">No checks match "{checkQuery.trim()}".</TableCell></TableRow>
            {/if}
          </TableBody>
        </Table>
        </CardContent>
      {/snippet}
    </Skeleton>
  </Card>
</div>

{#if dirty}
  <div
    class="sticky bottom-5 z-40 mx-auto mt-6 flex w-[calc(100%-1.5rem)] max-w-md items-center gap-2 rounded-xl bg-popover py-2 ps-4 pe-2 text-sm text-popover-foreground shadow-overlay transition-[translate,opacity] duration-200 ease-(--ease-out) starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none"
    role="status"
  >
    <span class="me-auto">You have unsaved changes</span>
    <Button variant="ghost" size="sm" onclick={() => (form = fromConfig({ ...(key.config ?? {}) }))}>Discard</Button>
    <Button variant="primary" size="sm" disabled={saving} onclick={save}>{saving ? "Saving" : "Save changes"}</Button>
  </div>
{/if}
