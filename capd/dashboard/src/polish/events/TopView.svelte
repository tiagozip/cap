<script module>
const fill = (make) =>
  Array.from({ length: 6 }, (_, i) => ({
    value: make(i),
    n: Math.round(800 / (1 + i)),
    blocked: Math.round(200 / (1 + i)),
  }));

export const TOP_DIMS = [
  ["ip", "IP addresses"],
  ["fp", "Visitors"],
  ["asn_org", "Networks"],
  ["origin", "Websites"],
  ["browser", "Browsers"],
  ["os", "Systems"],
  ["reason", "Why solves failed"],
  ["flag", "Risk signals"],
];

export const TOP_SAMPLE = Object.fromEntries(
  TOP_DIMS.map(([d]) => [d, fill((i) => `${d} ${i}`)]),
);
</script>

<script>
import { compact } from "../../lib/format.js";
import AsnIcon from "../../views/activity/AsnIcon.svelte";
import { FILTER_LABELS, filterValueLabel } from "../../views/events/labels.js";

let { data, onpick } = $props();

const nf = new Intl.NumberFormat();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const sections = $derived(
  TOP_DIMS.map(([field, title]) => ({
    field,
    title,
    list: (data?.[field] ?? []).filter(
      (r) => r.value !== "" && r.value != null,
    ),
  }))
    .filter((s) => s.list.length)
    .map((s) => ({ ...s, blocks: s.list.some((r) => r.blocked) })),
);
</script>

<div class="grid gap-x-6 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
  {#each sections as s (s.field)}
    {@const top = Math.max(1, ...s.list.map((r) => r.n))}
    <section class="min-w-0" aria-label={s.title}>
      <h2 class="mb-1.5 flex px-2 text-xs font-medium text-muted-foreground">
        <span class="me-auto">{s.title}</span>
        {#if s.blocks}<span class="w-16 text-end">Blocked</span>{/if}
        <span class="w-12 text-end">Events</span>
      </h2>
      <ul class="flex flex-col gap-0.5">
        {#each s.list.slice(0, 8) as r (r.value)}
          {@const label = filterValueLabel(s.field, String(r.value))}
          {@const blocked = pct(r.blocked ?? 0, r.n)}
          <li>
            <button
              type="button"
              class="relative flex h-8 w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
              title="Show only events where {FILTER_LABELS[s.field] ?? s.field} is {label}. Shift-click to hide them instead."
              onclick={(e) => onpick(`${e.shiftKey || e.altKey ? "-" : ""}${s.field}:${r.value}`)}
            >
              <span class="absolute inset-y-0 start-0 flex overflow-hidden rounded-md" style:width="{Math.max(1.5, (r.n / top) * 100)}%" aria-hidden="true">
                <span class="h-full flex-1 bg-foreground/[0.06]"></span>
                {#if blocked}<span class="h-full bg-destructive/15" style:width="{blocked}%"></span>{/if}
              </span>
              {#if s.field === "asn_org" && r.label}
                <span class="relative flex size-4 shrink-0 items-center justify-center"><AsnIcon asn={r.label} /></span>
              {/if}
              <span class="relative min-w-0 truncate {s.field === 'ip' || s.field === 'fp' ? 'font-mono text-xs' : ''}">{label}</span>
              <span class="relative ms-auto flex shrink-0 items-center">
                {#if s.blocks}
                  <span class="w-16 text-end text-xs text-destructive tabular-nums" title={blocked ? `${nf.format(r.blocked)} blocked` : undefined}>{blocked ? `${blocked}%` : ""}</span>
                {/if}
                <span class="w-12 text-end font-medium tabular-nums">{compact(r.n)}</span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>
