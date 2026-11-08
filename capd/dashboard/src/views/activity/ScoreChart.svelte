<script>
import { Button } from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { app } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import Bars from "./Bars.svelte";

let { rows } = $props();

const STEP = 5;
const MIN = 40;

const config = $derived(app.key?.config ?? {});
const current = $derived(Math.round((config.behaviorThreshold ?? 0.75) * 100));
const blocking = $derived(config.behavior === "block");

let threshold = $state(null);
let plot = $state();
let hover = $state(null);
let dragging = $state(false);
let saving = $state(false);

const t = $derived(threshold ?? current);

const bins = $derived.by(() => {
  const out = Array.from({ length: 100 / STEP }, (_, i) => ({
    from: i * STEP,
    pass: 0,
    flagged: 0,
    blocked: 0,
  }));
  for (const r of rows) {
    const bin = out[Math.min(out.length - 1, Math.floor(r.b / STEP))];
    if (r.outcome === "block") bin.blocked += r.n;
    else {
      bin.flagged += r.flagged;
      bin.pass += r.n - r.flagged;
    }
  }
  return out;
});

const at = $derived.by(() => {
  let caught = 0;
  let through = 0;
  let total = 0;
  for (const r of rows) {
    total += r.n;
    if (r.b < t) continue;
    caught += r.n;
    if (r.outcome !== "block") through += r.n;
  }
  return { caught, through, total };
});

const nf = new Intl.NumberFormat();
const pct = (n) =>
  at.total ? `${Math.round((n / at.total) * 1000) / 10}%` : "0%";

const toValue = (clientX) => {
  const rect = plot.getBoundingClientRect();
  const raw = ((clientX - rect.left) / rect.width) * 100;
  return Math.min(100, Math.max(MIN, Math.round(raw / STEP) * STEP));
};

const down = (e) => {
  if (e.button !== 0) return;
  plot.setPointerCapture(e.pointerId);
  dragging = true;
  threshold = toValue(e.clientX);
};
const move = (e) => {
  if (dragging) threshold = toValue(e.clientX);
};
const up = () => {
  dragging = false;
};
const key = (e) => {
  const delta = {
    ArrowLeft: -STEP,
    ArrowDown: -STEP,
    ArrowRight: STEP,
    ArrowUp: STEP,
  }[e.key];
  if (e.key === "Home") threshold = MIN;
  else if (e.key === "End") threshold = 100;
  else if (delta) threshold = Math.min(100, Math.max(MIN, t + delta));
  else return;
  e.preventDefault();
};

const apply = async () => {
  saving = true;
  const value = t / 100;
  const patch = { behaviorThreshold: value === 0.75 ? null : value };
  const res = await api("PUT", `/keys/${app.key.siteKey}/config`, patch);
  saving = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't save the threshold", "error");
    return;
  }
  app.key.config = { ...app.key.config, ...patch };
  threshold = null;
  toast(`Cap now acts on scores of ${t}% and up`);
};
</script>

{#snippet overlay()}
  <div data-bone="ignore" class="pointer-events-none absolute inset-y-0 end-0 bg-destructive/[0.06] transition-[left] duration-150 ease-(--ease-out) motion-reduce:transition-none" style:left="{t}%"></div>
  {#if t !== current}
    <div data-bone="ignore" class="pointer-events-none absolute inset-y-0 border-s border-dashed border-faint-foreground/60" style:left="{current}%">
      <span class="absolute bottom-1 start-1 rounded-[4px] bg-background px-1 text-[11px] whitespace-nowrap text-muted-foreground">Now {current}%</span>
    </div>
  {/if}
  <div data-bone="ignore"
    class="absolute inset-y-0 -ms-2.5 flex w-5 cursor-ew-resize justify-center outline-none transition-[left] duration-150 ease-(--ease-out) motion-reduce:transition-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring {dragging ? 'duration-0' : ''}"
    style:left="{t}%"
    role="slider"
    tabindex="0"
    aria-label="Risk score threshold"
    aria-valuemin={MIN}
    aria-valuemax={100}
    aria-valuenow={t}
    aria-valuetext="{t}%"
    onkeydown={key}
  >
    <span class="h-full w-0.5 rounded-full bg-destructive"></span>
    <span class="absolute -top-1 rounded-[5px] bg-destructive px-1 text-[11px] leading-4 font-medium text-background tabular-nums">{t}%</span>
  </div>
{/snippet}

<Bars
  {bins}
  bind:plot
  bind:hover
  label="Solves by risk score, in steps of {STEP}%"
  title={(b) => `Scored ${b.from} to ${b.from + STEP}%`}
  ticks={[0, 25, 50, 75, 100].map((v) => ({ x: v / 100, label: `${v}%` }))}
  class="cursor-ew-resize"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  {overlay}
/>

<div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
  <p class="max-w-md text-sm text-pretty text-muted-foreground" role="status">
    {#if !at.total}
      No scored solves in this period.
    {:else}
      <span class="font-medium text-foreground tabular-nums">{nf.format(at.caught)}</span> solves scored {t}% or more ({pct(at.caught)}).
      {#if at.through}
        <span class="font-medium text-foreground tabular-nums">{nf.format(at.through)}</span> of them got through{blocking ? "" : " because behavior checks only report right now"}.
      {:else}
        Cap blocked all of them.
      {/if}
    {/if}
  </p>
  <div class="flex items-center gap-2">
    {#if t !== current}
      <Button size="sm" disabled={saving} onclick={apply}>{saving ? "Saving" : `Use ${t}%`}</Button>
    {/if}
  </div>
</div>
