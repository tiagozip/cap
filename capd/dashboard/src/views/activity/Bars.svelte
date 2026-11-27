<script>
import { compact } from "../../lib/format.js";

let {
  bins,
  ticks = [],
  label,
  title,
  plot = $bindable(),
  hover = $bindable(null),
  overlay,
  marks,
  empty,
  onpointermove,
  class: cls = "",
  ...rest
} = $props();

const PARTS = [
  ["pass", "Passed", "color-mix(in oklab, var(--foreground) 22%, transparent)"],
  ["flagged", "Flagged", "var(--warning)"],
  ["blocked", "Blocked", "var(--destructive)"],
];

const nice = (v) => {
  if (v <= 1) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= v);
};

let hidden = $state([]);
const shown = $derived(PARTS.filter(([k]) => !hidden.includes(k)));
const toggle = (k) => {
  if (hidden.includes(k)) hidden = hidden.filter((h) => h !== k);
  else if (shown.length > 1) hidden = [...hidden, k];
};

const totals = $derived(bins.map((b) => shown.reduce((a, [k]) => a + b[k], 0)));
const anyData = $derived(bins.some((b) => b.pass + b.flagged + b.blocked > 0));
const max = $derived(nice(Math.max(1, ...totals)));
const blank = $derived(!anyData);
const y = (v) => Math.sqrt(v / max) * 100;
const yTicks = $derived(
  blank ? [0] : [...new Set([0, nice(max / 4), max])].filter((t) => t <= max),
);

let tipAt = $state(0);
let axisWidth = $state(400);

const fitted = $derived.by(() => {
  const out = [];
  for (const t of ticks) {
    const prev = out.at(-1);
    if (!prev || (t.x - prev.x) * axisWidth >= 48) out.push(t);
    else if (t.x === 1) out[out.length - 1] = t;
  }
  return out;
});
let glide = $state(false);
let rising = $state(true);

$effect(() => {
  if (plot?.closest(".enter")) rising = false;
  const settle = setTimeout(() => {
    rising = false;
  }, 1000);
  return () => clearTimeout(settle);
});

const readout = $derived.by(() => {
  const b = bins[hover ?? -1];
  if (!b) return "Use arrow keys to read each bar";
  return `${title(b)}: ${PARTS.map(([k, name]) => `${b[k].toLocaleString()} ${name.toLowerCase()}`).join(", ")}`;
});

const reading = $derived(
  overlay || blank
    ? {}
    : {
        role: "slider",
        tabindex: 0,
        "aria-roledescription": "chart",
        "aria-valuemin": 0,
        "aria-valuemax": bins.length - 1,
        "aria-valuenow": hover ?? 0,
        "aria-valuetext": readout,
      },
);

const key = (e) => {
  const last = bins.length - 1;
  const next = {
    ArrowLeft: Math.max(0, (hover ?? last + 1) - 1),
    ArrowRight: Math.min(last, (hover ?? -1) + 1),
    Home: 0,
    End: last,
  }[e.key];
  if (next == null || blank || e.target !== e.currentTarget) return;
  e.preventDefault();
  glide = hover != null;
  hover = next;
  tipAt = next;
};

const pick = (e) => {
  const rect = plot.getBoundingClientRect();
  const i = Math.floor(((e.clientX - rect.left) / rect.width) * bins.length);
  glide = hover != null;
  hover = !blank && i >= 0 && i < bins.length ? i : null;
  if (hover != null) tipAt = hover;
};
</script>

<div class="grid grid-cols-[auto_1fr] gap-x-3">
  <div class="relative h-40 w-7 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each yTicks as t (t)}
      <span class="tick absolute right-0 leading-none" style:bottom="{y(t)}%" style:transform="translateY(50%)">{compact(t)}</span>
    {/each}
  </div>

  <div
    bind:this={plot}
    class="relative h-40 touch-none rounded-[3px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card {cls}"
    aria-label={label}
    {...reading}
    {...rest}
    onkeydown={key}
    onblur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) hover = null;
    }}
    onpointerdown={(e) => {
      if (e.pointerType === "touch") pick(e);
      rest.onpointerdown?.(e);
    }}
    onpointermove={(e) => {
      pick(e);
      onpointermove?.(e);
    }}
    onpointerleave={(e) => {
      if (e.pointerType !== "touch") hover = null;
    }}
  >
    {#each yTicks as t (t)}
      <div class="pointer-events-none absolute inset-x-0 border-t {t === 0 ? 'border-border' : 'border-dashed border-border'}" style:bottom="{y(t)}%"></div>
    {/each}
    <div data-bone="block" class="pointer-events-none absolute inset-0 flex items-end gap-px">
      {#each bins as b, i (i)}
        {@const v = totals[i]}
        <div class="relative flex h-full min-w-0 flex-1 items-end">
          {#if hover === i}<div class="absolute inset-0 rounded-[3px] bg-foreground/[0.05]"></div>{/if}
          <div
            class="bar relative flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px]"
            class:bar-rise={rising}
            style:height="{v ? Math.max(1.5, y(v)) : 0}%"
            style:animation-delay={rising ? `${Math.round((i / bins.length) * 280)}ms` : null}
            style:opacity={hover == null || hover === i ? 1 : 0.55}
          >
            {#each shown as [k, , c] (k)}
              {#if b[k]}<span class="part w-full shrink-0" style:height="{(b[k] / v) * 100}%" style:background={c}></span>{/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>

    {#if blank && empty}
      <p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{empty}</p>
    {/if}

    {@render marks?.()}
    {@render overlay?.()}

    {#if bins[tipAt] && !blank}
      {@const b = bins[tipAt]}
      {@const right = tipAt < bins.length / 2}
      <div class="tip-track pointer-events-none absolute inset-x-0 top-1 z-20" class:glide style:translate="{((right ? tipAt + 1 : tipAt) / bins.length) * 100}% 0">
        <div
          class="tip absolute left-0 w-52 rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]"
          class:shown={hover != null}
          style:translate={right ? "8px 0" : "calc(-100% - 8px) 0"}
        >
          <p class="mb-2 font-medium text-muted-foreground">{title(b)}</p>
          <ul class="flex flex-col gap-1.5">
            {#each PARTS as [k, name, c] (k)}
              {@const all = b.pass + b.flagged + b.blocked}
              <li class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 {hidden.includes(k) ? 'text-faint-foreground' : ''}">
                <span class="size-2 shrink-0 rounded-full" style:background={c}></span>
                {name}
                <span class="text-right text-faint-foreground tabular-nums">{all ? (b[k] && b[k] < all / 100 ? "<1%" : `${Math.round((b[k] / all) * 100)}%`) : ""}</span>
                <span class="min-w-10 text-right tabular-nums">{b[k].toLocaleString()}</span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </div>

  <div></div>
  <div bind:clientWidth={axisWidth} class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each fitted as t (t.x)}
      <span class="absolute whitespace-nowrap" style:left="{t.x * 100}%" style:transform="translateX({t.x === 0 ? '0' : t.x === 1 ? '-100%' : '-50%'})">{t.label}</span>
    {/each}
  </div>
</div>

<div class="mt-2 -ms-2 flex flex-wrap items-center gap-x-0.5 text-xs" class:invisible={blank}>
  {#each PARTS as [k, name, c] (k)}
    {@const off = hidden.includes(k)}
    <button
      type="button"
      class="legend flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default {off ? 'text-faint-foreground' : 'text-muted-foreground'} [@media(hover:hover)]:hover:bg-foreground/[0.05] [@media(hover:hover)]:hover:text-foreground"
      aria-pressed={!off}
      disabled={!off && shown.length === 1}
      onclick={() => toggle(k)}
    >
      <span class="dot size-2 rounded-full" class:off style:--c={c}></span>{name}
    </button>
  {/each}
</div>



<style>
  .dot {
    border: 1.5px solid var(--c);
    background: var(--c);
    transition: background-color 160ms ease-out;
  }

  .dot.off {
    background: transparent;
  }

  .legend {
    transition:
      color 120ms ease-out,
      background-color 120ms ease-out;
  }

  .bar {
    transform-origin: bottom;
    transition: opacity 120ms ease-out;
  }

  .tip {
    transform-origin: top center;
    opacity: 0;
    scale: 0.97;
    transition:
      opacity 120ms ease-out,
      scale 120ms ease-out;
  }

  .tip.shown {
    opacity: 1;
    scale: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar {
      transition:
        height 420ms var(--ease-out),
        opacity 120ms ease-out;
    }

    .tip-track.glide,
    .tip-track.glide .tip {
      transition:
        translate 160ms var(--ease-out),
        opacity 120ms ease-out,
        scale 120ms ease-out;
    }

    .tick {
      animation: tick-in 240ms ease-out both;
    }

    .bar-rise {
      animation: bar-rise 520ms var(--ease-out) both;
    }

    :global(.sk-ghost) .bar-rise {
      animation: none;
    }
  }

  @keyframes tick-in {
    from {
      opacity: 0;
    }
  }

  @keyframes bar-rise {
    from {
      scale: 1 0;
    }
  }
</style>
