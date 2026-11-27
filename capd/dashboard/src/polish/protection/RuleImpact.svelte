<script>
import Odometer from "../../components/cap/Odometer.svelte";
import { catalog } from "../../lib/catalog.svelte.js";
import { compact } from "../../lib/format.js";
import {
  compileRule,
  estimate,
  listIdsOf,
  loadLists,
  loadSample,
  stageOf,
} from "./impact.js";

let { rule, siteKey, ready = true, ahead = [] } = $props();

const VERBS = {
  block: "Would have blocked",
  allow: "Would have let in",
  flag: "Would have flagged",
  harder: "Would have slowed down",
};
const TONES = {
  block: "var(--destructive)",
  allow: "var(--success)",
  flag: "var(--warning)",
  harder: "var(--info)",
};

const stage = $derived(stageOf(rule));
const listIds = $derived(
  [...new Set([rule, ...ahead].flatMap(listIdsOf))].join("\n"),
);

let samples = $state({});
let lists = $state({});
let failed = $state(false);

$effect(() => {
  const type = stage;
  if (samples[type]) return;
  failed = false;
  loadSample(siteKey, type).then(
    (s) => {
      samples = { ...samples, [type]: s };
    },
    () => {
      failed = true;
    },
  );
});

$effect(() => {
  const ids = listIds ? listIds.split("\n") : [];
  const missing = ids.filter((id) => !(id in lists));
  if (!missing.length) return;
  loadLists(missing).then((got) => {
    lists = { ...lists, ...got };
  });
});

const sample = $derived(samples[stage]);
const listsReady = $derived(
  !listIds || listIds.split("\n").every((id) => id in lists),
);
const compiled = $derived(
  ready && listsReady ? compileRule(rule, lists) : null,
);
const blockers = $derived(
  listsReady
    ? ahead
        .filter(
          (r) =>
            r.enabled &&
            (r.action === "allow" || r.action === "block") &&
            (stage === "redeem" || stageOf(r) === "challenge"),
        )
        .map((r) => ({ name: r.name, test: compileRule(r, lists).test }))
        .filter((r) => r.test)
    : [],
);
const caught = $derived.by(() => {
  if (!result?.hits || !blockers.length) return null;
  const by = new Map();
  let n = 0;
  for (const e of result.events) {
    const first = blockers.find((b) => b.test(e));
    if (!first) continue;
    n++;
    by.set(first.name, (by.get(first.name) ?? 0) + 1);
  }
  if (!n) return null;
  const [name] = [...by].sort((a, b) => b[1] - a[1])[0];
  return { share: n / result.hits, name, more: by.size - 1 };
});
const result = $derived(
  sample && compiled?.test ? estimate(sample, compiled.test) : null,
);
const peak = $derived(
  Math.max(0, ...(result?.bars ?? []).map((b) => b.matched)),
);
const pinned = $derived(
  new Set(
    rule.match === "all"
      ? rule.conditions
          .filter((c) => c.op === "eq" || c.op === "in")
          .map((c) => c.field)
      : [],
  ),
);
const risky = $derived(
  (rule.action === "block" || rule.action === "allow") &&
    (result?.share ?? 0) >= 0.1,
);
const unit = $derived(stage === "challenge" ? "challenges" : "solves");
const skippedText = $derived(
  [
    ...new Set(
      (compiled?.skipped ?? []).map((c) =>
        c.field === "header"
          ? `the ${c.header || "request"} header`
          : c.field === "list"
            ? "the list"
            : (catalog.fields[c.field]?.label ?? c.field).toLowerCase(),
      ),
    ),
  ].join(" and "),
);
const pct = (share) =>
  share >= 0.995
    ? "100%"
    : share < 0.001 && share > 0
      ? "<0.1%"
      : `${share >= 0.1 ? Math.round(share * 100) : (share * 100).toFixed(1)}%`;
const shortHour = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "numeric" });
</script>

<section class="flex flex-col gap-2.5 rounded-xl bg-muted/60 p-3.5 shadow-[inset_0_0_0_1px_var(--border)]" aria-labelledby="ruleImpactTitle" aria-live="polite" aria-busy={!sample && !failed}>
  <div class="flex items-baseline justify-between gap-3">
    <h3 id="ruleImpactTitle" class="text-xs text-muted-foreground">Last 24 hours</h3>
    {#if result && !result.exact && result.total}
      <span class="text-xs text-faint-foreground tabular-nums">Estimated from {compact(result.sampled)} events</span>
    {/if}
  </div>

  {#if failed}
    <p class="text-sm text-muted-foreground">Couldn't load recent traffic.</p>
  {:else if !ready}
    <p class="text-sm text-muted-foreground">Finish the conditions to see what this rule would have matched.</p>
  {:else if compiled && !compiled.test}
    <p class="text-sm text-pretty text-muted-foreground">Events don't record {skippedText}, so there's nothing to preview.</p>
  {:else}
    <p class="min-h-5 text-sm text-pretty">
      {#if result}
        {#if !result.total}
          <span class="text-muted-foreground">No {unit} in the last 24 hours.</span>
        {:else}
          {VERBS[rule.action]}
          <Odometer class="font-medium" value={result.matched} format={(v) => (result.exact ? v.toLocaleString() : compact(v))} />
          of {compact(result.total)} {unit}
          <span class="tabular-nums {risky ? 'text-warning' : 'text-muted-foreground'}">({pct(result.share)})</span>
        {/if}
      {:else}
        <span class="text-muted-foreground">Checking recent traffic</span>
      {/if}
    </p>

    <div class="flex h-10 items-end gap-[3px]" aria-hidden="true">
      {#each sample?.windows ?? Array(12).fill(null) as _, i (i)}
        {@const bar = result?.bars[i]}
        <span class="relative h-full flex-1 overflow-hidden rounded-[3px] bg-muted-foreground/10">
          <span
            class="absolute inset-0 origin-bottom motion-safe:transition-[scale] motion-safe:duration-300 motion-safe:ease-(--ease-out)"
            style:background={TONES[rule.action]}
            style:scale="1 {bar?.matched && peak ? Math.max(0.06, bar.matched / peak) : 0}"
          ></span>
        </span>
      {/each}
    </div>
    {#if sample}
      <div class="-mt-1 flex justify-between text-[11px] text-faint-foreground tabular-nums" aria-hidden="true">
        <span>{shortHour(sample.from)}</span>
        <span>Now</span>
      </div>
    {/if}

    {#if result?.hits}
      <dl class="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {#each [["Countries", result.countries, "country"], ["Networks", result.networks, "asn_org"], ["IPs", result.ips, "ip"]].filter(([, , f]) => !pinned.has(f)) as [label, items] (label)}
          {#if items.length}
            <div class="flex min-w-0 items-baseline gap-1.5">
              <dt class="text-muted-foreground">{label}</dt>
              <dd class="min-w-0 truncate">
                {#each items as it, j (it.value)}{j ? ", " : ""}<span class={label === "IPs" ? "font-mono text-[11px]" : ""}>{it.value}</span> <span class="text-muted-foreground tabular-nums">{pct(it.share)}</span>{/each}
              </dd>
            </div>
          {/if}
        {/each}
      </dl>
    {/if}
    {#if caught}
      <p class="text-xs text-pretty text-muted-foreground">
        {caught.share >= 0.995 ? "All" : pct(caught.share)} of these are caught first by "{caught.name}"{caught.more ? ` or ${caught.more} other rule${caught.more > 1 ? "s" : ""}` : ""}, {caught.more ? "which run" : "which runs"} earlier.
      </p>
    {/if}
    {#if risky}
      <p class="text-xs text-pretty text-warning">
        {rule.action === "allow"
          ? "That's a big share of your traffic skipping every later rule and automatic block."
          : "That's a big share of your traffic. Check who it catches before you save."}
      </p>
    {/if}
    {#if skippedText}
      <p class="text-xs text-pretty text-muted-foreground">Leaves out {skippedText}, which events don't record.</p>
    {/if}
  {/if}
</section>
