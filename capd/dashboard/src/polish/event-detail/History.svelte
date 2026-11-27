<script>
import { Icon, Tip } from "../../components/cap/index.js";
import { ago, compact, dateFmt } from "../../lib/format.js";

let { ctx, siteKey } = $props();

const SEGMENTS = [
  ["solved", "Solved", "bg-success"],
  ["flagged", "Flagged", "bg-warning"],
  ["failed", "Failed", "bg-muted-foreground"],
  ["blocked", "Blocked", "bg-destructive"],
  ["limited", "Rate limited", "bg-violet"],
];

const parts = (x) => {
  const v = {
    solved: Math.max(0, (x.solved ?? 0) - (x.flagged ?? 0)),
    flagged: x.flagged ?? 0,
    failed: x.failed ?? 0,
    blocked: x.blocked ?? 0,
    limited: x.limited ?? 0,
  };
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  return {
    sum,
    segs: SEGMENTS.map(([k, label, tone]) => [k, label, tone, v[k]]),
  };
};

const pct = (n, d) => {
  const p = (n / d) * 100;
  return p > 0 && p < 1 ? "<1" : String(Math.round(p));
};

const headline = (x, sum) => {
  if (!sum) return null;
  const bad = (x.blocked ?? 0) + (x.limited ?? 0) + (x.failed ?? 0);
  if (bad / sum >= 0.5)
    return [`${pct(bad, sum)}% stopped`, "text-destructive"];
  if ((x.flagged ?? 0) / sum >= 0.25)
    return [`${pct(x.flagged, sum)}% flagged`, "text-warning"];
  return [`${pct(x.solved ?? 0, sum)}% solved`, "text-muted-foreground"];
};

const days = (ms) => Math.max(1, Math.round(ms / 86_400_000));

const lists = $derived(
  (ctx.lists ?? []).filter((l) => !l.id.startsWith("blk_")),
);

const same = (a, b) =>
  a &&
  b &&
  a.total === b.total &&
  a.blocked === b.blocked &&
  a.solved === b.solved;

const rows = $derived.by(() => {
  const merged = same(ctx.ip, ctx.visitor);
  return [
    ctx.ip && [
      merged ? "This IP and visitor" : "This IP",
      ctx.ip,
      [
        "first",
        !merged &&
          ctx.ip.visitors > 1 &&
          `${compact(ctx.ip.visitors)} visitors`,
        ctx.ip.keys > 1 && `seen on ${ctx.ip.keys} keys`,
      ],
    ],
    ctx.visitor &&
      !merged && [
        "This visitor",
        ctx.visitor,
        ["first", ctx.visitor.ips > 1 && `${compact(ctx.visitor.ips)} IPs`],
      ],
    ctx.network && [
      ctx.network.asn_org || `AS${ctx.network.asn}`,
      ctx.network,
      [
        ctx.network.share != null &&
          `${pct(ctx.network.share, 1)}% of all your traffic`,
      ],
    ],
  ].filter(Boolean);
});
</script>

<section class="-mx-5 flex flex-col border-t border-border px-5 py-4" aria-labelledby="ed-history">
  <div class="flex items-baseline justify-between gap-3 pb-1.5">
    <h3 id="ed-history" class="text-sm font-semibold">History</h3>
    {#if ctx.window}
      <span class="text-xs text-muted-foreground">Past {days(ctx.window.to - ctx.window.from)} days</span>
    {/if}
  </div>
  <ul class="flex flex-col">
    {#each rows as [label, x, extra], i (label)}
      {@const { sum, segs } = parts(x)}
      {@const head = headline(x, sum)}
      {@const network = x === ctx.network}
      <li class="eh-row flex flex-col gap-1.5 py-2" style="--i: {i}">
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 truncate">{label}</span>
          {#if head}<span class="shrink-0 text-xs font-medium tabular-nums {head[1]}">{head[0]}</span>{/if}
        </div>
        {#if sum}
          <Tip side="bottom" align="start">
            {#snippet content()}
              <div class="flex w-44 flex-col gap-1 py-0.5 text-xs">
                {#each segs.filter((s) => s[3]) as [k, name, tone, n] (k)}
                  <div class="flex items-center gap-2">
                    <span class="size-1.5 rounded-full {tone}" aria-hidden="true"></span>
                    <span class="flex-1">{name}</span>
                    <span class="tabular-nums opacity-70">{compact(n)}</span>
                  </div>
                {/each}
              </div>
            {/snippet}
            {#snippet children(props)}
              <div
                {...props}
                class="eh-bar flex h-1.5 w-full origin-left cursor-default gap-px overflow-hidden rounded-full"
                role="img"
                aria-label={segs.filter((s) => s[3]).map(([, name, , n]) => `${name} ${n}`).join(", ")}
              >
                {#each segs.filter((s) => s[3]) as [k, , tone, n] (k)}
                  <span class="h-full {tone}" style="flex-grow: {n}; flex-basis: 0; min-width: 3px"></span>
                {/each}
              </div>
            {/snippet}
          </Tip>
        {/if}
        <p class="text-xs text-pretty text-muted-foreground tabular-nums">
          {compact(x.total)} {x.total === 1 ? "request" : "requests"}{network ? " this week" : ""}{#each extra.filter(Boolean) as t (t)}{#if t === "first"}, first seen <span title={dateFmt.format(new Date(x.first))}>{ago(x.first)}</span>{:else}, {t}{/if}{/each}
        </p>
      </li>
    {/each}
  </ul>
  {#if lists.length || ctx.rules?.length}
    <ul class="flex flex-wrap gap-1.5 pt-2">
      {#each lists as l (`${l.id}:${l.kind}:${l.value}`)}
        <li>
          <a
            href="#/settings/lists"
            class="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs outline-none transition-[background-color] duration-100 focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted"
          >
            <Icon name="list" size={12} class="text-muted-foreground" />
            <span class="text-muted-foreground">On</span>{l.name}
          </a>
        </li>
      {/each}
      {#each ctx.rules ?? [] as r (r.id)}
        <li>
          <a
            href="#/keys/{siteKey}/protection"
            class="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs outline-none transition-[background-color] duration-100 focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted {r.enabled ? '' : 'opacity-60'}"
          >
            <Icon name={r.action === "block" ? "ban" : r.action === "allow" ? "check" : "flag"} size={12} class={r.action === "block" ? "text-destructive" : r.action === "allow" ? "text-success" : "text-warning"} />
            <span class="text-muted-foreground">Matches</span>{r.name}{r.enabled ? "" : ", off"}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .eh-bar {
      animation: eh-grow 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(100ms + var(--i) * 45ms);
    }
  }

  @keyframes eh-grow {
    from {
      scale: 0 1;
    }
  }
</style>
