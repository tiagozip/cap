<script>
import { compact } from "../../lib/format.js";
import { t } from "../../lib/i18n.svelte.js";
import { openEvents } from "../../lib/state.svelte.js";

let { flow } = $props();

const steps = $derived.by(() => {
  const c = (type, outcome) =>
    flow
      .filter((r) => r.type === type && (!outcome || r.outcome === outcome))
      .reduce((a, r) => a + r.n, 0);
  const attempts = c("redeem");
  const issued = Math.max(c("challenge", "pass"), attempts);
  const early = [
    [
      t("Blocked before solving"),
      c("challenge", "block"),
      "var(--destructive)",
      ["type:challenge", "outcome:block"],
    ],
    [
      t("Rate limited"),
      c("challenge", "limit"),
      "var(--warning)",
      ["type:challenge", "outcome:limit"],
    ],
  ];
  const requested = issued + early.reduce((a, d) => a + d[1], 0);
  const solved = c("redeem", "pass");
  const verified = Math.min(solved, c("siteverify", "pass"));
  return [
    { label: t("Challenges requested"), n: requested, drops: early },
    {
      label: t("Challenges issued"),
      n: issued,
      drops: [
        [
          t("Left without solving"),
          issued - attempts,
          "var(--faint-foreground)",
        ],
        [
          t("Failed the check"),
          c("redeem", "fail"),
          "var(--faint-foreground)",
          ["type:redeem", "outcome:fail"],
        ],
        [
          t("Blocked on solve"),
          c("redeem", "block"),
          "var(--destructive)",
          ["type:redeem", "outcome:block"],
        ],
        [
          t("Rate limited"),
          c("redeem", "limit"),
          "var(--warning)",
          ["type:redeem", "outcome:limit"],
        ],
      ],
    },
    {
      label: t("Solved"),
      n: solved,
      drops: [
        [
          t("Token never checked by your server"),
          solved - verified,
          "var(--faint-foreground)",
        ],
      ],
    },
    { label: t("Verified by your server"), n: verified, drops: [] },
  ];
});

const top = $derived(Math.max(1, steps[0].n));
const share = (n) => {
  const p = (n / top) * 100;
  return p && p < 1 ? "<1%" : `${Math.round(p)}%`;
};
</script>

{#if !steps[0].n}
  <p class="m-auto py-10 text-sm text-muted-foreground">{t("No challenges in this period.")}</p>
{:else}
  <ol class="flex flex-col gap-3">
    {#each steps as s, i (s.label)}
      <li class="flex flex-col gap-1.5">
        <div class="flex items-baseline gap-2 text-sm">
          <span class={i ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
          <span class="ms-auto font-medium tabular-nums">{compact(s.n)}</span>
          <span class="w-10 text-end text-xs text-muted-foreground tabular-nums">{share(s.n)}</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full transition-[width] duration-500 ease-(--ease-out) motion-reduce:transition-none" style:width="{(s.n / top) * 100}%" style:background="var(--chart-2)"></div>
        </div>
        {#if s.drops.some((d) => d[1] > 0)}
          <ul class="flex flex-wrap gap-x-4 gap-y-0.5 ps-1 pt-0.5">
            {#each s.drops.filter((d) => d[1] > 0) as [label, n, color, filters] (label)}
              <li>
                {#if filters}
                  <button type="button" class="-mx-1 flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground" onclick={() => openEvents(filters)}>
                    <span class="size-1.5 rounded-full" style:background={color}></span>
                    {label}
                    <span class="text-foreground tabular-nums">{compact(n)}</span>
                  </button>
                {:else}
                  <span class="flex h-6 items-center gap-1.5 text-xs text-muted-foreground">
                    <span class="size-1.5 rounded-full" style:background={color}></span>
                    {label}
                    <span class="text-foreground tabular-nums">{compact(n)}</span>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ol>
{/if}
