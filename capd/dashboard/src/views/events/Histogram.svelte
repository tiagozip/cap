<script>
import { compact } from "../../lib/format.js";

let {
  series,
  bucket,
  onpick,
  active = null,
  picked = null,
  pickedTo = null,
  height = 180,
} = $props();

const DAY = 86_400_000;

const SETS = [
  {
    id: "issued",
    label: "Challenge issued",
    color: "var(--chart-4)",
    value: (b) => b.challenges,
  },
  {
    id: "solved",
    label: "Solved",
    color: "var(--chart-2)",
    value: (b) => Math.max(0, b.solved - b.flagged),
  },
  {
    id: "verified",
    label: "Verified",
    color: "var(--chart-1)",
    value: (b) => b.verified,
  },
  {
    id: "flagged",
    label: "Flagged",
    color: "var(--warning)",
    value: (b) => b.flagged,
  },
  {
    id: "failed",
    label: "Failed",
    color: "var(--faint-foreground)",
    value: (b) => b.failed,
  },
  {
    id: "limited",
    label: "Rate limited",
    color: "var(--violet)",
    value: (b) => b.limited,
  },
  {
    id: "blocked",
    label: "Blocked",
    color: "var(--destructive)",
    value: (b) => b.blocked,
  },
];

let hover = $state(null);
let cursor = $state(null);
let width = $state(0);
let group = $state(null);
let drag = $state(null);
let swallow = false;

const rows = $derived(
  series.map((b) => {
    const parts = SETS.map((s) => s.value(b));
    return { b: b.b, parts, total: parts.reduce((a, v) => a + v, 0) };
  }),
);
const max = $derived(Math.max(1, ...rows.map((r) => r.total)));
const step = $derived.by(() => {
  const raw = max / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 10]
    .map((m) => m * mag)
    .find((v) => v >= raw);
});
const peak = $derived(step * 3);
const gap = $derived(
  series.length > 60 ? 1 : series.length > 32 ? 2 : series.length > 16 ? 3 : 4,
);

const chosen = $derived(rows.findIndex((r) => r.b === picked));
const span = $derived.by(() => {
  if (drag && drag.a !== drag.b)
    return [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)];
  if (chosen < 0 || pickedTo == null) return null;
  const last = rows.findLastIndex((r) => r.b < pickedTo);
  return last > chosen ? [chosen, last] : null;
});
const focus = $derived(hover ?? (chosen >= 0 ? chosen : null));
const lit = (i) =>
  span ? i >= span[0] && i <= span[1] : focus == null || focus === i;
const slotAt = (x) => {
  const box = group.getBoundingClientRect();
  return Math.min(
    rows.length - 1,
    Math.max(0, Math.floor(((x - box.left) / box.width) * rows.length)),
  );
};
const commit = ([lo, hi]) => {
  drag = null;
  onpick(rows[lo].b, rows[hi].b + bucket);
};
const down = (e) => {
  if (e.button !== 0 || !rows.length) return;
  const i = slotAt(e.clientX);
  drag = { a: i, b: i };
  group.setPointerCapture?.(e.pointerId);
};
const drift = (e) => {
  if (!drag || drag.keys) return;
  const i = slotAt(e.clientX);
  hover = i;
  if (i !== drag.b) drag = { a: drag.a, b: i };
};
const up = () => {
  if (!drag || drag.keys) return;
  const s =
    drag.a === drag.b
      ? null
      : [Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)];
  const one = rows[drag.a];
  drag = null;
  swallow = true;
  setTimeout(() => {
    swallow = false;
  });
  if (s) commit(s);
  else if (one?.total) onpick(one.b, one.b + bucket);
};
const home = $derived(
  cursor ?? (chosen >= 0 ? chosen : rows.findLastIndex((r) => r.total)),
);

const brushing = (node) => {
  const on = {
    pointerleave: () => {
      if (!drag) hover = null;
    },
    pointerdown: down,
    pointermove: drift,
    pointerup: up,
    pointercancel: () => {
      drag = null;
    },
    keydown: (e) => move(e),
  };
  for (const [k, f] of Object.entries(on)) node.addEventListener(k, f);
  return () => {
    for (const [k, f] of Object.entries(on)) node.removeEventListener(k, f);
  };
};

const move = (e) => {
  const keys = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
  if (e.key === "Escape" && drag) {
    drag = null;
    return;
  }
  const d = keys[e.key];
  if (!d) return;
  e.preventDefault();
  const open = rows.flatMap((r, i) => (r.total ? [i] : []));
  if (!open.length) return;
  const at = open.indexOf(home);
  const next =
    d === -Infinity
      ? open[0]
      : d === Infinity
        ? open.at(-1)
        : open[Math.min(open.length - 1, Math.max(0, at + d))];
  drag = e.shiftKey
    ? { a: drag?.keys ? drag.a : home, b: next, keys: true }
    : null;
  cursor = next;
  group?.querySelectorAll("button")[next]?.focus();
};

const tip = $derived.by(() => {
  if (!width) return null;
  const slot = width / rows.length;
  if (drag && span) {
    const [lo, hi] = span;
    const list = rows.slice(lo, hi + 1);
    const parts = SETS.map((_, j) => list.reduce((a, r) => a + r.parts[j], 0));
    const end = 32 + (hi + 1) * slot + 8;
    return {
      r: {
        b: rows[lo].b,
        end: rows[hi].b + bucket,
        parts,
        total: parts.reduce((a, v) => a + v, 0),
      },
      x: Math.max(0, end + 224 <= 32 + width ? end : 32 + lo * slot - 8 - 224),
    };
  }
  if (hover == null || !rows[hover]?.total) return null;
  const mid = 32 + (hover + 0.5) * slot;
  const right = mid + slot / 2 + 8 + 224 <= 32 + width;
  return {
    r: rows[hover],
    x: Math.max(0, right ? mid + slot / 2 + 8 : mid - slot / 2 - 8 - 224),
  };
});

const hourFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const longFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const spanLabel = (b, end = b + bucket) =>
  bucket >= DAY
    ? end - b > bucket
      ? `${dayFmt.format(new Date(b))} to ${dayFmt.format(new Date(end - bucket))}`
      : dayFmt.format(new Date(b))
    : `${longFmt.format(new Date(b))} to ${(end - b > DAY ? longFmt : hourFmt).format(new Date(end))}`;

const TICK_STEPS = [
  60_000,
  300_000,
  900_000,
  1_800_000,
  3_600_000,
  10_800_000,
  21_600_000,
  43_200_000,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
];

const ticks = $derived.by(() => {
  const n = rows.length;
  if (!n) return [];
  const start = rows[0].b;
  const span = n * bucket;
  const want = width && width < 480 ? 3 : 5;
  const step =
    TICK_STEPS.find((s) => span / s <= want && s >= bucket) ?? 30 * DAY;
  const local = (t) => t - new Date(t).getTimezoneOffset() * 60_000;
  const out = [];
  let t = start;
  const off = ((local(t) % step) + step) % step;
  if (off) t += step - off;
  for (; t < start + span && out.length < 12; t += step) {
    const at = (t - start) / span;
    if (at > 0.9) break;
    const d = new Date(t);
    const midnight = !d.getHours() && !d.getMinutes();
    out.push({
      i: t,
      at,
      text: (step >= DAY || midnight ? dayFmt : hourFmt).format(d),
    });
  }
  return out;
});
</script>

<figure class="flex flex-col gap-3">
  <div class="relative pl-8">
    <div class="pointer-events-none absolute inset-y-0 left-0 right-0" style:height="{height}px" aria-hidden="true">
      {#each [3, 2, 1, 0] as k (k)}
        <div class="absolute inset-x-0 flex -translate-y-1/2 items-center" style:top="{((3 - k) / 3) * 100}%">
          <span class="w-8 pr-2 text-left text-[11px] text-muted-foreground tabular-nums">{compact(step * k)}</span>
          <span data-bone="ignore" class="flex-1 border-t {k ? 'border-dashed border-border' : 'border-border'}"></span>
        </div>
      {/each}
    </div>
    <div
      bind:this={group}
      bind:clientWidth={width}
      data-bone="block"
      class="relative flex touch-pan-y items-end select-none"
      style:height="{height}px"
      style:gap="{gap}px"
      role="group"
      aria-label="Events over time. Pick a bar to see its events, or drag across bars to pick a range. Hold Shift with the arrow keys to pick a range."
      {@attach brushing}
    >
      {#if span}
        <span
          class="brush pointer-events-none absolute inset-y-0 rounded-[3px] bg-foreground/[0.06]"
          style:left="{(span[0] / rows.length) * 100}%"
          style:width="{((span[1] - span[0] + 1) / rows.length) * 100}%"
          aria-hidden="true"
        ></span>
      {/if}
      {#each rows as r, i (r.b)}
        <button
          type="button"
          class="relative flex h-full min-w-0 flex-1 items-end outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default {r.total
            ? 'cursor-pointer'
            : ''}"
          disabled={!r.total}
          tabindex={i === home ? 0 : -1}
          aria-pressed={span ? i >= span[0] && i <= span[1] : i === chosen}
          aria-label="{spanLabel(r.b)}, {r.total.toLocaleString()} events. Show them."
          onpointerenter={() => (hover = i)}
          onfocus={() => {
            hover = i;
            cursor = i;
          }}
          onblur={() => (hover = null)}
          onclick={() => {
            if (swallow) return;
            if (drag?.keys && span) return commit(span);
            onpick(r.b, r.b + bucket);
          }}
        >
          <span class="pointer-events-none absolute -inset-x-px inset-y-0 rounded-[3px] bg-foreground/[0.05] {hover === i && !span ? '' : 'opacity-0'}" aria-hidden="true"></span>
          <span
            class="bar relative flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px]"
            style:height="{r.total ? Math.max(2, (r.total / peak) * 100) : 0}%"
            style:opacity={lit(i) ? 1 : 0.4}
            style:--i={i}
          >
            {#each SETS as s, j (s.id)}
              {#if r.parts[j]}
                <span class="part w-full shrink-0" style:height="{(r.parts[j] / r.total) * 100}%" style:background={s.color} style:opacity={active && active !== s.id ? 0.3 : 1}></span>
              {/if}
            {/each}
          </span>
        </button>
      {/each}
    </div>

    {#if tip}
      {@const r = tip.r}
      <div
        class="tip pointer-events-none absolute top-0 left-0 z-10 w-56 rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-overlay"
        style:transform="translate3d({tip.x}px, 0, 0)"
      >
        <p class="mb-2 font-medium">{spanLabel(r.b, r.end)}</p>
        <ul class="flex flex-col gap-1">
          {#each SETS as s, j (s.id)}
            {#if r.parts[j]}
              <li class="flex items-center gap-2 text-muted-foreground">
                <span class="size-2 shrink-0 rounded-full" style:background={s.color}></span>
                {s.label}
                <span class="ml-auto font-medium text-foreground tabular-nums">{r.parts[j].toLocaleString()}</span>
              </li>
            {/if}
          {/each}
        </ul>
        <p class="mt-2 flex border-t border-border pt-2 text-muted-foreground">
          Total
          <span class="ml-auto font-medium text-foreground tabular-nums">{r.total.toLocaleString()}</span>
        </p>
      </div>
    {/if}

    <div class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
      {#each ticks as t (t.i)}
        <span class="absolute whitespace-nowrap" style:left="{t.at * 100}%">{t.text}</span>
      {/each}
    </div>
  </div>

</figure>

<style>
  .bar {
    transform-origin: bottom;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar {
      transition:
        height 360ms var(--ease-out),
        opacity 120ms ease-out;
      animation: rise 620ms var(--ease-out) backwards;
      animation-delay: min(calc(var(--i) * 3ms), 280ms);
    }

    .part {
      transition: opacity 200ms ease-out;
    }

    .tip {
      transition: transform 140ms var(--ease-out);
    }
  }

  @keyframes rise {
    from {
      transform: scaleY(0);
    }
  }
</style>
