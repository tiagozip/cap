<script>
import { Button, Dialog, Row } from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { refreshSettings } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";

let { onapplied } = $props();

const onOff = (v) => (v ? "On" : "Off");
const orNone = (v) => v || "Not set";
const IP_MODES = { full: "Full", truncate: "Shortened", none: "Don't keep" };
const INTERVALS = {
  daily: "Every day",
  "4d": "Every 4 days",
  weekly: "Every week",
  monthly: "Every month",
};

const GROUPS = {
  ratelimit: "/settings/ratelimit",
  cors: "/settings/cors",
  filtering: "/settings/filtering",
  headers: "/settings/headers",
  analytics: "/settings/analytics",
  assets: "/settings/assets",
  updateCheck: "/settings/update-check",
};

const FIELDS = [
  ["ratelimit", "max", "Challenges per visitor", String],
  ["ratelimit", "duration", "Rate limit window", (v) => `${v / 1000} seconds`],
  [
    "cors",
    "origins",
    "Only allow my websites",
    (v) => (v?.length ? v.join("\n") : "Off"),
  ],
  [
    "filtering",
    "blockNonBrowserUA",
    "Block curl, scripts and other non-browsers",
    onOff,
  ],
  [
    "filtering",
    "requiredHeaders",
    "Required browser headers",
    (v) => (v?.length ? v.join("\n") : "None"),
  ],
  ["headers", "ipHeader", "Visitor IP header", orNone],
  ["headers", "countryHeader", "Country header", orNone],
  ["headers", "asnHeader", "Network header", orNone],
  [
    "analytics",
    "retentionDays",
    "Keep events for",
    (v) => (v ? `${v} day${v === 1 ? "" : "s"}` : "Forever"),
  ],
  ["analytics", "ipMode", "Visitor IP addresses", (v) => IP_MODES[v] ?? v],
  [
    "analytics",
    "anonymizeDays",
    "Anonymize IP addresses after",
    (v) => (v ? `${v} day${v === 1 ? "" : "s"}` : "Never"),
  ],
  ["analytics", "logChallenges", "Record every challenge shown", onOff],
  ["assets", "enabled", "Serve widget files from this server", onOff],
  ["assets", "widget", "Widget version", String],
  ["assets", "wasm", "WebAssembly version", String],
  ["updateCheck", "enabled", "Check for updates", onOff],
  ["updateCheck", "sidebar", "Show update notices in the sidebar", onOff],
  ["updateCheck", "interval", "How often", (v) => INTERVALS[v] ?? v],
];

let busy = $state("");
let file = $state(null);
let plan = $state(null);
let applying = $state(false);
let open = $state(false);
let picker = $state(null);

const pick = (source, keys) =>
  source && Object.fromEntries(keys.map((k) => [k, source[k]]));

const fieldsOf = (group) =>
  FIELDS.filter(([g]) => g === group).map(([, k]) => k);

const current = async () => {
  const [ratelimit, cors, filtering, headers, analytics, assets, updateCheck] =
    await Promise.all(Object.values(GROUPS).map((p) => api("GET", p)));
  const ok = (r) => (r && !r.error ? r : null);
  return {
    ratelimit: pick(ok(ratelimit), fieldsOf("ratelimit")),
    cors: pick(ok(cors), fieldsOf("cors")),
    filtering: pick(ok(filtering), fieldsOf("filtering")),
    headers: pick(ok(headers), fieldsOf("headers")),
    analytics: pick(ok(analytics)?.settings, fieldsOf("analytics")),
    assets: pick(ok(assets)?.builtWith && assets, fieldsOf("assets")),
    updateCheck: ok(updateCheck)?.lockedByEnv
      ? null
      : pick(ok(updateCheck)?.report && updateCheck, fieldsOf("updateCheck")),
  };
};

const exportFile = async () => {
  busy = "export";
  const settings = Object.fromEntries(
    Object.entries(await current()).filter(([, v]) => v),
  );
  busy = "";
  const blob = new Blob(
    [
      `${JSON.stringify({ cap: "settings", version: 1, exported: new Date().toISOString(), settings }, null, 2)}\n`,
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `cap-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const sameType = (a, b) =>
  Array.isArray(a)
    ? Array.isArray(b) && b.every((x) => typeof x === "string")
    : a === null
      ? b === null || Array.isArray(b)
      : typeof a === typeof b;

const readFile = async (e) => {
  const f = e.currentTarget.files?.[0];
  e.currentTarget.value = "";
  if (!f) return;
  let parsed;
  try {
    parsed = JSON.parse(await f.text());
  } catch {
    toast("That file isn't valid JSON", "error");
    return;
  }
  if (parsed?.cap !== "settings" || typeof parsed.settings !== "object") {
    toast("That isn't a Cap settings file", "error");
    return;
  }
  busy = "import";
  const now = await current();
  busy = "";
  const changes = [];
  const groups = {};
  for (const [group, key, label, fmt] of FIELDS) {
    const from = now[group];
    const next = parsed.settings[group]?.[key];
    if (!from || next === undefined || !sameType(from[key], next)) continue;
    if (JSON.stringify(from[key]) === JSON.stringify(next)) continue;
    changes.push({ group, key, label, now: fmt(from[key]), next: fmt(next) });
    groups[group] = { ...(groups[group] ?? from), [key]: next };
  }
  if (!changes.length) {
    toast("This server already matches that file");
    return;
  }
  file = f.name;
  plan = { changes, groups };
  open = true;
};

const apply = async () => {
  applying = true;
  const failed = [];
  for (const [group, body] of Object.entries(plan.groups)) {
    const payload =
      group === "cors"
        ? { origins: body.origins?.length ? body.origins : null }
        : body;
    const r = await api("PUT", GROUPS[group], payload);
    if (!r?.success) failed.push(r?.error || group);
  }
  applying = false;
  await refreshSettings();
  const count = plan.changes.length;
  open = false;
  onapplied?.();
  if (failed.length) {
    toast(`Some settings didn't import: ${failed[0]}`, "error");
    return;
  }
  toast(count === 1 ? "Imported 1 setting" : `Imported ${count} settings`);
};
</script>

<Row label="Settings file" help="Secrets won't get exported.">
  <div class="flex flex-wrap items-center gap-2">
    <Button disabled={busy === "export"} onclick={exportFile}>{busy === "export" ? "Exporting" : "Export"}</Button>
    <Button disabled={busy === "import"} onclick={() => picker?.click()}>{busy === "import" ? "Reading" : "Import"}</Button>
    <input bind:this={picker} type="file" accept="application/json,.json" class="hidden" tabindex="-1" aria-hidden="true" onchange={readFile} />
  </div>
</Row>

{#if plan}
  <Dialog
    bind:open
    title="Import settings"
    description="{plan.changes.length === 1 ? '1 setting' : `${plan.changes.length} settings`} in {file} differ from this server."
    size="md"
    onclose={() => {
      plan = null;
      open = false;
    }}
  >
    <div class="overflow-hidden rounded-lg border border-border">
      <table class="w-full table-fixed text-sm">
        <thead class="bg-muted/50 text-start text-muted-foreground">
          <tr>
            <th class="w-[38%] px-3 py-2 text-start font-medium">Setting</th>
            <th class="px-3 py-2 text-start font-medium">Now</th>
            <th class="px-3 py-2 text-start font-medium">From file</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each plan.changes as c (`${c.group}.${c.key}`)}
            <tr>
              <td class="px-3 py-2 align-top">{c.label}</td>
              <td class="px-3 py-2 align-top text-muted-foreground tabular-nums whitespace-pre-line [overflow-wrap:anywhere]">{c.now}</td>
              <td class="px-3 py-2 align-top font-medium tabular-nums whitespace-pre-line [overflow-wrap:anywhere]">{c.next}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#snippet footer()}
      <Button onclick={() => (open = false)}>Cancel</Button>
      <Button variant="primary" disabled={applying} onclick={apply}>
        {applying ? "Importing" : plan.changes.length === 1 ? "Import 1 setting" : `Import ${plan.changes.length} settings`}
      </Button>
    {/snippet}
  </Dialog>
{/if}
