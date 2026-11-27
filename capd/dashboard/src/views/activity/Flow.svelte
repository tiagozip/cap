<script>
import Odometer from "../../components/cap/Odometer.svelte";
import { compact } from "../../lib/format.js";
import { app, navigate, openEvents } from "../../lib/state.svelte.js";

let { flow, previous = null, grow = false, onpick = openEvents } = $props();

let hot = $state(null);

const build = (rows) => {
  const c = (type, outcome) =>
    rows
      .filter((r) => r.type === type && (!outcome || r.outcome === outcome))
      .reduce((a, r) => a + r.n, 0);
  const attempts = c("redeem");
  const issued = Math.max(c("challenge", "pass"), attempts);
  const early = [
    {
      label: "Blocked before solving",
      n: c("challenge", "block"),
      color: "var(--destructive)",
      filters: ["type:challenge", "outcome:block"],
    },
    {
      label: "Rate limited",
      n: c("challenge", "limit"),
      color: "var(--warning)",
      filters: ["type:challenge", "outcome:limit"],
    },
  ];
  const requested = issued + early.reduce((a, d) => a + d.n, 0);
  const solved = c("redeem", "pass");
  const verified = Math.min(solved, c("siteverify", "pass"));
  return [
    {
      label: "Challenges requested",
      n: requested,
      filters: ["type:challenge"],
      drops: early,
    },
    {
      label: "Challenges issued",
      n: issued,
      filters: ["type:challenge", "outcome:pass"],
      drops: [
        {
          label: "Left without solving",
          n: issued - attempts,
          color: "var(--faint-foreground)",
        },
        {
          label: "Failed the check",
          n: c("redeem", "fail"),
          color: "var(--faint-foreground)",
          filters: ["type:redeem", "outcome:fail"],
        },
        {
          label: "Blocked on solve",
          n: c("redeem", "block"),
          color: "var(--destructive)",
          filters: ["type:redeem", "outcome:block"],
        },
        {
          label: "Rate limited",
          n: c("redeem", "limit"),
          color: "var(--warning)",
          filters: ["type:redeem", "outcome:limit"],
        },
      ],
    },
    {
      label: "Solved",
      n: solved,
      filters: ["type:redeem", "outcome:pass"],
      drops: [
        {
          label: "Token never checked by your server",
          n: solved - verified,
          color: "var(--faint-foreground)",
        },
      ],
    },
    {
      label: "Verified by your server",
      n: verified,
      filters: ["type:siteverify", "outcome:pass"],
      drops: [],
    },
  ];
};

const steps = $derived.by(() =>
  build(flow).map((step, i, all) => {
    const kept = all[i + 1]?.n ?? step.n;
    let room = step.n - kept;
    const parts = [{ n: kept, color: "var(--chart-2)", key: -1 }];
    step.drops.forEach((d, k) => {
      const take = Math.max(0, Math.min(d.n, room));
      room -= take;
      if (take) parts.push({ n: take, color: d.color, key: k });
    });
    return { ...step, parts };
  }),
);

const before = $derived.by(() => {
  if (!previous?.length) return null;
  const prev = build(previous);
  return prev[0].n ? prev.map((s) => s.n / prev[0].n) : null;
});

const top = $derived(Math.max(1, steps[0].n));
const share = (n) => {
  const p = (n / top) * 100;
  return p && p < 1 ? "<1%" : `${Math.round(p)}%`;
};

const shift = (i) => {
  if (!before || !i) return null;
  const pts = Math.round((steps[i].n / top - before[i]) * 100);
  return pts ? pts : null;
};

const unchecked = $derived.by(() => {
  const solved = steps[2].n;
  if (solved < 50) return null;
  const share = 1 - steps[3].n / solved;
  return share >= 0.25 ? share : null;
});

const lit = (i, key) => !hot || (hot.step === i && hot.key === key);
const focus = (step, key) => {
  const on = () => {
    hot = { step, key };
  };
  const off = () => {
    hot = null;
  };
  return { onpointerenter: on, onpointerleave: off, onfocus: on, onblur: off };
};
</script>

{#if !steps[0].n}
  <p class="m-auto py-10 text-sm text-muted-foreground">No challenges in this period.</p>
{:else}
  <ol class="flex flex-col gap-3">
    {#each steps as s, i (s.label)}
      {@const pts = shift(i)}
      <li class="flex flex-col gap-1.5">
        <div class="flex items-baseline gap-2 text-sm">
          <button
            type="button"
            class="-mx-1 cursor-pointer rounded-md px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring {i ? 'text-foreground' : 'text-muted-foreground'} [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground"
            onclick={() => onpick(s.filters)}
            {...focus(i, -1)}
          >
            {s.label}
          </button>
          {#if pts}
            <span class="ms-auto text-xs tabular-nums text-muted-foreground" title="Change in share since the previous period">
              {pts > 0 ? "+" : "−"}{Math.abs(pts)} pts
            </span>
          {/if}
          <Odometer class="font-medium {pts ? '' : 'ms-auto'}" value={s.n} format={compact} />
          <span class="w-10 text-end text-xs text-muted-foreground tabular-nums">{share(s.n)}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-muted">
          <div class="flex h-full gap-0.5 overflow-hidden rounded-full transition-[width] duration-500 ease-(--ease-out) motion-reduce:transition-none" style:width="{(s.n / top) * 100}%" class:grow-in={grow} style:--i={i}>
            {#each s.parts as p (p.key)}
              <span
                class="seg h-full min-w-0.5 basis-0"
                style:flex-grow={p.n}
                style:background={p.color}
                style:opacity={lit(i, p.key) ? (p.key < 0 ? 1 : 0.7) : 0.25}
              ></span>
            {/each}
          </div>
        </div>
        {#if s.drops.some((d) => d.n > 0)}
          <ul class="flex flex-wrap gap-x-4 gap-y-0.5 ps-1 pt-0.5">
            {#each s.drops as d, k (d.label)}
              {#if d.n > 0}
                <li>
                  {#if d.filters}
                    <button type="button" class="-mx-1 flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground" onclick={() => onpick(d.filters)} {...focus(i, k)}>
                      <span class="size-1.5 rounded-full" style:background={d.color}></span>
                      {d.label}
                      <span class="text-foreground tabular-nums">{compact(d.n)}</span>
                    </button>
                  {:else}
                    <span class="flex h-6 items-center gap-1.5 text-xs text-muted-foreground" {...focus(i, k)}>
                      <span class="size-1.5 rounded-full" style:background={d.color}></span>
                      {d.label}
                      <span class="text-foreground tabular-nums">{compact(d.n)}</span>
                    </span>
                  {/if}
                </li>
              {/if}
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>
  {#if unchecked != null}
    <p class="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-sm text-pretty text-muted-foreground">
      {unchecked > 0.99 ? "Your server hasn't verified any tokens." : `Your server skipped verifying ${Math.round(unchecked * 100)}% of solved tokens.`}
      <button
        type="button"
        class="-mx-1 flex h-6 cursor-pointer items-center rounded-md px-1 font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
        onclick={() => navigate({ view: "key", siteKey: app.key.siteKey, tab: "configuration" })}
      >
        Check your setup
      </button>
    </p>
  {/if}
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .grow-in {
      transform-origin: left;
      animation: bar-grow 700ms var(--ease-out) backwards;
      animation-delay: calc(var(--i) * 70ms + 220ms);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .seg {
      transition:
        flex-grow 500ms var(--ease-out),
        opacity 160ms ease;
    }
  }

  @keyframes bar-grow {
    from {
      transform: scaleX(0);
    }
  }
</style>
