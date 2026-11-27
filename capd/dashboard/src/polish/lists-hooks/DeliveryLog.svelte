<script>
import {
  Button,
  Empty,
  Segmented,
  Spinner,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { ago, fullFmt, latency } from "../../lib/format.js";

let { rows, testing = false, highlight = null, ontest, onevent } = $props();

let show = $state("all");

const nf = new Intl.NumberFormat();
const pct = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});

const failures = $derived(rows.filter((d) => !d.ok));
const visible = $derived(
  show === "failed" && failures.length ? failures : rows,
);
const stats = $derived.by(() => {
  const times = rows
    .map((d) => d.ms ?? 0)
    .filter((ms) => ms > 0)
    .toSorted((a, b) => a - b);
  const at = (q) =>
    times[Math.min(times.length - 1, Math.floor(q * times.length))];
  return {
    rate: rows.length ? (rows.length - failures.length) / rows.length : 0,
    p50: times.length ? at(0.5) : 0,
    p95: times.length ? at(0.95) : 0,
    scale: Math.max(1, (times.length ? at(0.95) : 0) * 1.25),
  };
});
</script>

{#if rows.length}
  <div class="flex flex-col gap-4">
    <dl class="grid grid-cols-3 gap-3">
      <div class="flex flex-col gap-0.5">
        <dt class="text-xs text-muted-foreground">Delivered</dt>
        <dd class="text-lg font-medium tabular-nums {failures.length ? '' : 'text-success'}">{pct.format(stats.rate)}</dd>
      </div>
      <div class="flex flex-col gap-0.5">
        <dt class="text-xs text-muted-foreground">Median time</dt>
        <dd class="text-lg font-medium tabular-nums">{latency(stats.p50)}</dd>
      </div>
      <div class="flex flex-col gap-0.5">
        <dt class="text-xs text-muted-foreground">95th percentile</dt>
        <dd class="text-lg font-medium tabular-nums">{latency(stats.p95)}</dd>
      </div>
    </dl>

    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted-foreground tabular-nums">
        {failures.length ? `${nf.format(failures.length)} of the last ${nf.format(rows.length)} failed` : `The last ${nf.format(rows.length)} all arrived`}
      </p>
      {#if failures.length}
        <Segmented
          size="sm"
          label="Show deliveries"
          bind:value={show}
          options={[["all", "All"], ["failed", `Failed ${nf.format(failures.length)}`]]}
        />
      {/if}
    </div>

    <div class="-mx-1 max-h-[min(24rem,50dvh)] overflow-y-auto px-1">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Result</TableHead>
            <TableHead class="max-sm:hidden">Event</TableHead>
            <TableHead class="w-28 text-end">Took</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each visible as d (`${d.at}:${d.attempt}:${d.event}`)}
            <TableRow class={highlight && d === rows[0] && Date.now() - d.at < 5000 ? "wh-enter" : ""}>
              <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums" title={fullFmt.format(d.at)}>{Date.now() - d.at < 5000 ? "Just now" : ago(d.at)}</TableCell>
              <TableCell class="whitespace-nowrap" title={d.ok ? undefined : d.error || undefined}>
                <span class="font-medium {d.ok ? 'text-success' : 'text-destructive'}">{d.ok ? `${d.status}` : d.status ? `HTTP ${d.status}` : "No answer"}</span>
                {#if d.attempt > 0}<span class="ms-1.5 text-xs text-muted-foreground">retry {d.attempt}</span>{/if}
                {#if !d.ok && d.error && show === "failed"}<span class="block max-w-64 text-xs whitespace-normal text-muted-foreground">{d.error}</span>{/if}
              </TableCell>
              <TableCell class="max-w-40 max-sm:hidden">
                {#if d.kind === "cap.test" || d.event === "test"}
                  <Tag>Test</Tag>
                {:else if d.event}
                  {#if onevent}
                    <button
                      type="button"
                      class="block max-w-full cursor-pointer truncate rounded-sm font-mono text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      title="Open event {d.event}"
                      onclick={() => onevent(d.event)}
                    >{d.event}</button>
                  {:else}
                    <code class="block truncate font-mono text-xs text-muted-foreground" title={d.event}>{d.event}</code>
                  {/if}
                {/if}
              </TableCell>
              <TableCell class="text-end">
                <span class="flex items-center justify-end gap-2">
                  <span class="h-1 w-10 overflow-hidden rounded-full bg-foreground/8 max-sm:hidden" aria-hidden="true">
                    <span class="block h-full origin-left rounded-full {d.ok ? 'bg-foreground/35' : 'bg-destructive/70'}" style:transform="scaleX({Math.min(1, (d.ms ?? 0) / stats.scale)})"></span>
                  </span>
                  <span class="w-12 tabular-nums">{latency(d.ms)}</span>
                </span>
              </TableCell>
            </TableRow>

          {/each}
        </TableBody>
      </Table>
    </div>
  </div>
{:else}
  <Empty class="py-2" title="Nothing sent yet">
    Send a test to check that your server answers.
    {#snippet action()}
      <Button size="sm" disabled={testing} onclick={ontest}>
        {#if testing}<Spinner class="size-3.5" label="Sending test" />{/if}
        Send test
      </Button>
    {/snippet}
  </Empty>
{/if}

