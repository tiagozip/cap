<script>
import Odometer from "../../components/cap/Odometer.svelte";
import Icon from "../../components/Icon.svelte";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/index.js";
import { compact } from "../../lib/format.js";
import SwitchTrigger from "./SwitchTrigger.svelte";

let {
  keys,
  current,
  open = $bindable(false),
  hint = false,
  tab = "activity",
  onpick,
  oncreate,
} = $props();

const uid = $props.id();
let query = $state("");
let active = $state(0);
let list = $state();

const needle = $derived(query.trim().toLowerCase());
const hits = (name) => {
  if (!needle) return null;
  const lower = name.toLowerCase();
  const at = lower.indexOf(needle);
  if (at >= 0)
    return { rank: at === 0 ? 0 : 1, at: [...needle].map((_, i) => at + i) };
  const at2 = [];
  let from = 0;
  for (const c of needle) {
    if (c === " ") continue;
    const i = lower.indexOf(c, from);
    if (i < 0) return null;
    at2.push(i);
    from = i + 1;
  }
  return { rank: 2, at: at2 };
};

const matched = $derived(
  keys
    .map((k, i) => ({
      k,
      i,
      hit:
        hits(k.name) ??
        (needle && k.siteKey.toLowerCase().startsWith(needle)
          ? { rank: 3, at: [] }
          : null),
    }))
    .filter((m) => !needle || m.hit)
    .sort((x, y) => (x.hit?.rank ?? 0) - (y.hit?.rank ?? 0) || x.i - y.i),
);
const shown = $derived(matched.map((m) => m.k));

const segments = (name, at) => {
  const marks = new Set(at);
  const out = [];
  for (const [i, c] of [...name].entries()) {
    const on = marks.has(i);
    if (out.length && out.at(-1).on === on) out.at(-1).text += c;
    else out.push({ on, text: c });
  }
  return out;
};

$effect(() => {
  if (!open) return;
  query = "";
  active = Math.max(
    0,
    keys.findIndex((k) => k.siteKey === current?.siteKey),
  );
});

$effect(() => {
  needle;
  if (needle) active = 0;
});

$effect(() => {
  list?.querySelector(`#${CSS.escape(`${uid}-${active}`)}`)?.scrollIntoView({
    block: "nearest",
  });
});

const href = (k) => `#/keys/${k.siteKey}/${tab}`;

const pick = (k) => {
  if (!k) return;
  open = false;
  if (k.siteKey !== current?.siteKey) onpick(k);
};

const keydown = (e) => {
  const n = shown.length;
  const step =
    {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 5,
      PageUp: -5,
    }[e.key] ??
    (e.ctrlKey && e.key === "n" ? 1 : e.ctrlKey && e.key === "p" ? -1 : 0);
  if (step && n) {
    e.preventDefault();
    active =
      Math.abs(step) > 1
        ? Math.min(n - 1, Math.max(0, active + step))
        : (active + step + n) % n;
    return;
  }
  if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    if ((e.metaKey || e.ctrlKey) && shown[active]) {
      window.open(href(shown[active]), "_blank", "noopener");
      return;
    }
    pick(shown[active]);
  }
};
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <SwitchTrigger {...props} name={current?.name} {hint} />
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    align="start"
    sideOffset={6}
    arrow={false}
    onOpenAutoFocus={(e) => matchMedia("(pointer: coarse)").matches && e.preventDefault()}
    class="ks z-[95] w-(--bits-popover-anchor-width) min-w-64 gap-0 rounded-xl p-0"
  >
    <label class="ks-search">
      <Icon name="search" size={16} class="shrink-0 text-faint-foreground" />
      <span class="sr-only">Find a site key</span>
      <input
        bind:value={query}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="{uid}-list"
        aria-autocomplete="list"
        aria-activedescendant={shown.length ? `${uid}-${active}` : undefined}
        autocomplete="off"
        spellcheck="false"
        placeholder="Find a key"
        onkeydown={keydown}
      />
    </label>

    <div
      bind:this={list}
      id="{uid}-list"
      role="listbox"
      aria-label="Site keys"
      class="ks-list"
    >
      {#each matched as { k, hit }, i (k.siteKey)}
        {@const dir = k.difference?.direction}
        {@const pct = Math.round(Math.abs(Number(k.difference?.value) || 0))}
        <a
          id="{uid}-{i}"
          href={href(k)}
          role="option"
          tabindex="-1"
          aria-selected={i === active}
          class="ks-row"
          data-active={i === active || undefined}
          onpointermove={() => (active = i)}
          onclick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            pick(k);
          }}
        >
          <span class="ks-mark">
            {#if k.siteKey === current?.siteKey}<Icon name="check" size={16} /><span class="sr-only">Current key, </span>{/if}
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="flex items-baseline gap-2">
              <span class="min-w-0 flex-1 truncate" class:dim={hit?.at.length}>{#each segments(k.name, hit?.at ?? []) as seg, j (j)}{#if seg.on}<mark>{seg.text}</mark>{:else}{seg.text}{/if}{/each}</span>
              {#if k.secretOutdated}<span class="shrink-0 text-xs text-destructive">Reset secret</span>{/if}
            </span>
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              {#if k.solvesLast24h && dir && pct}
                <span class={dir === "up" ? "text-success" : "text-destructive"}><span class="sr-only">{dir === "up" ? "Up" : "Down"} </span>{dir === "up" ? "+" : "−"}{pct}%</span>
              {/if}
              {#if k.solvesLast24h}
                <span class="truncate"><Odometer value={k.solvesLast24h} format={compact} /> solves in 24h</span>
              {:else}
                <span class="truncate">No solves in 24h</span>
              {/if}
            </span>
          </span>
        </a>
      {:else}
        <p class="ks-empty" role="status">No keys match “{query.trim()}”</p>
      {/each}
    </div>

    <div class="ks-foot">
      <button
        type="button"
        class="ks-row ks-create"
        onclick={() => {
          open = false;
          oncreate();
        }}
      >
        <span class="ks-mark"><Icon name="plus" size={16} /></span>
        <span class="flex-1 text-start">Create site key</span>
      </button>
    </div>
  </PopoverContent>
</Popover>

<style>
  .ks-search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding-inline: 14px 12px;
    border-bottom: 1px solid var(--border);
    cursor: text;
  }

  .ks-search input {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: transparent;
    font-size: 14px;
    outline: none;
  }

  .ks-search input::placeholder {
    color: var(--muted-foreground);
  }

  .ks-list {
    max-height: min(320px, calc(var(--bits-popover-content-available-height) - 110px));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px;
    scroll-padding-block: 6px;
  }

  .ks-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 10px 6px 8px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
  }

  .ks-row[data-active] {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  .ks-mark {
    display: grid;
    place-items: center;
    width: 16px;
    flex-shrink: 0;
    color: var(--muted-foreground);
  }

  mark {
    background: none;
    color: inherit;
  }

  .dim {
    color: var(--muted-foreground);
  }

  .dim mark {
    color: var(--foreground);
    font-weight: 500;
  }

  .ks-empty {
    padding: 18px 10px;
    text-align: center;
    font-size: 14px;
    color: var(--muted-foreground);
    text-wrap: pretty;
    overflow-wrap: anywhere;
  }

  .ks-foot {
    padding: 6px;
    border-top: 1px solid var(--border);
  }

  .ks-create {
    outline: none;
  }

  .ks-create:focus-visible {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  @media (hover: hover) {
    .ks-create:hover {
      background: var(--accent);
      color: var(--accent-foreground);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .ks-row {
      transition: scale 160ms ease-out;
    }

    .ks-row:active {
      scale: 0.98;
    }
  }
</style>
