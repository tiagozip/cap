<script>
import { Dialog } from "bits-ui";
import { tick, untrack } from "svelte";
import Icon from "../../components/Icon.svelte";
import { api, qs } from "../../lib/api.js";
import { compact } from "../../lib/format.js";
import { palette } from "../../lib/ui.svelte.js";
import {
  buildCommands,
  eventCommands,
  pushRecent,
  rank,
  readRecent,
} from "./commands.js";

const GROUP_ORDER = [
  "Recent",
  "This page",
  "Go to",
  "Site keys",
  "Events",
  "Instance settings",
  "Actions",
];

let query = $state("");
let active = $state(0);
let input = $state(null);
let list = $state(null);
let ran = false;
let recent = $state(readRecent());
let pointer = null;
const counts = $state({});
const asked = new Set();

const all = $derived(palette.open ? buildCommands() : []);

const groups = $derived.by(() => {
  const q = query.trim();
  if (!q) {
    const byId = new Map(all.map((c) => [c.id, c]));
    const seen = new Set();
    const out = [];
    const rec = recent
      .map((id) => byId.get(id))
      .filter((c) => c && !c.current)
      .slice(0, 4);
    for (const c of rec) seen.add(c.id);
    if (rec.length) out.push({ name: "Recent", items: rec });
    for (const name of GROUP_ORDER.slice(1)) {
      const items = all
        .filter((c) => c.group === name && !c.deep && !seen.has(c.id))
        .slice(0, name === "Site keys" ? 6 : 8);
      if (items.length) out.push({ name, items });
    }
    return out;
  }
  const ranked = rank(q, all);
  const dynamic = eventCommands(q);
  const buckets = new Map();
  for (const c of ranked) {
    if (!buckets.has(c.group)) buckets.set(c.group, []);
    const b = buckets.get(c.group);
    if (b.length < 6) b.push(c);
  }
  const out = [...buckets]
    .map(([name, items]) => ({ name, items, top: items[0].score }))
    .sort((a, b) => b.top - a.top);
  if (dynamic.length) {
    const strong = out[0]?.top > 120;
    out.splice(strong ? 1 : 0, 0, { name: "Search events", items: dynamic });
  }
  return out;
});

const flat = $derived(groups.flatMap((g) => g.items));

$effect(() => {
  const wanted = flat.filter((c) => c.filters && !asked.has(c.id));
  if (!wanted.length) return;
  const t = setTimeout(() => {
    for (const c of wanted) {
      asked.add(c.id);
      api(
        "GET",
        `/keys/${c.siteKey}/analytics${qs({ range: "24h", f: c.filters })}`,
      ).then((r) => {
        const total = r?.summary?.total;
        if (typeof total === "number")
          counts[c.id] = total
            ? `${compact(total)} in the past day`
            : "None in the past day";
      });
    }
  }, 220);
  return () => clearTimeout(t);
});
const current = $derived(flat[Math.min(active, flat.length - 1)]);

$effect(() => {
  query;
  active = Math.max(
    0,
    untrack(() => flat.findIndex((c) => !c.current)),
  );
});

$effect(() => {
  if (!palette.open) return;
  untrack(() => {
    ran = false;
    recent = readRecent();
    query = "";
    palette.used = true;
    asked.clear();
    for (const id in counts) delete counts[id];
    active = Math.max(
      0,
      flat.findIndex((c) => !c.current),
    );
  });
});

$effect(() => {
  const id = current?.id;
  if (!id || !list) return;
  list
    .querySelector(`[data-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest" });
});

const optionId = (c) => `cmdk-${c.id.replace(/[^a-z0-9]/gi, "-")}`;

const move = (delta) => {
  if (!flat.length) return;
  active = (active + delta + flat.length) % flat.length;
};

const run = async (c) => {
  if (!c) return;
  if (!c.dynamic) pushRecent(c.id);
  ran = true;
  palette.open = false;
  await tick();
  c.run();
};

const keydown = (e) => {
  if (e.key === "?" && !query) {
    e.preventDefault();
    ran = true;
    palette.open = false;
    palette.shortcuts = true;
    return;
  }
  const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
  if (e.key === "ArrowDown" || (ctrl && e.key === "n")) {
    e.preventDefault();
    move(1);
  } else if (e.key === "ArrowUp" || (ctrl && e.key === "p")) {
    e.preventDefault();
    move(-1);
  } else if (e.key === "PageDown") {
    e.preventDefault();
    active = Math.min(flat.length - 1, active + 5);
  } else if (e.key === "PageUp") {
    e.preventDefault();
    active = Math.max(0, active - 5);
  } else if (e.key === "Enter" && !e.isComposing) {
    e.preventDefault();
    run(current);
  }
};

const hover = (e, i) => {
  const at = `${e.clientX},${e.clientY}`;
  if (pointer === null) {
    pointer = at;
    return;
  }
  if (pointer === at) return;
  pointer = at;
  active = i;
};

const segments = (label, hits) => {
  if (!hits?.length) return [{ text: label, hit: false }];
  const set = new Set(hits);
  const out = [];
  for (let i = 0; i < label.length; i++) {
    const hit = set.has(i);
    const last = out.at(-1);
    if (last && last.hit === hit) last.text += label[i];
    else out.push({ text: label[i], hit });
  }
  return out;
};

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
</script>

<Dialog.Root bind:open={palette.open}>
  <Dialog.Portal>
    <Dialog.Overlay data-slot="palette-overlay" class="fixed inset-0 z-[90] bg-black/20 dark:bg-black/45" />
    <Dialog.Content
      data-slot="palette"
      class="fixed start-1/2 top-3 z-[91] flex max-h-[min(34rem,calc(100dvh-1.5rem))] w-[calc(100%-2rem)] max-w-[40rem] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground outline-none sm:top-[12vh] rtl:translate-x-1/2"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        pointer = null;
        input?.focus();
      }}
      onCloseAutoFocus={(e) => {
        if (ran) e.preventDefault();
      }}
    >
      <Dialog.Title class="sr-only">Command menu</Dialog.Title>
      <Dialog.Description class="sr-only">Search for keys, pages, settings and actions. Use the arrow keys to move and Enter to open.</Dialog.Description>
      <div class="flex h-13 shrink-0 items-center gap-3 border-b border-border ps-4 pe-3">
        <Icon name="search" size={18} class="shrink-0 text-muted-foreground" />
        <input
          bind:this={input}
          bind:value={query}
          onkeydown={keydown}
          class="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint-foreground"
          placeholder="Search keys, settings, events or actions"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(current) : undefined}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <kbd class="hidden h-6 shrink-0 items-center rounded-md border border-border px-1.5 font-sans text-[12px] text-muted-foreground sm:inline-flex">Esc</kbd>
      </div>

      <div bind:this={list} id="cmdk-list" role="listbox" aria-label="Results" class="cmdk-list min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {#each groups as g (g.name)}
          <div role="group" aria-labelledby="cmdk-g-{g.name.replace(/\s/g, '-')}" class="cmdk-group">
            <div id="cmdk-g-{g.name.replace(/\s/g, '-')}" class="px-2.5 pt-2.5 pb-1 text-[12px] font-medium text-muted-foreground" aria-hidden="true">{g.name}</div>
            {#each g.items as c (c.id)}
              {@const i = flat.indexOf(c)}
              <div
                id={optionId(c)}
                data-id={c.id}
                role="option"
                tabindex="-1"
                aria-selected={i === active}
                data-active={i === active || undefined}
                class="cmdk-item flex h-10 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-[14px] text-foreground select-none data-active:bg-accent"
                onpointermove={(e) => hover(e, i)}
                onclick={() => run(c)}
                onkeydown={() => {}}
              >
                <Icon name={c.icon} size={16} class="shrink-0 text-muted-foreground" />
                <span class="min-w-0 truncate">
                  {#each segments(c.label, c.hits) as s}{#if s.hit}<mark class="bg-transparent font-semibold text-foreground">{s.text}</mark>{:else}{s.text}{/if}{/each}
                </span>
                {#if c.external}<Icon name="external" size={13} class="shrink-0 text-faint-foreground" />{/if}
                <span class="ms-auto flex min-w-0 shrink items-center gap-2 ps-2">
                  {#if c.current}
                    <span class="shrink-0 text-[13px] text-faint-foreground">Current</span>
                  {:else if counts[c.id] ?? c.hint}
                    <span class="truncate text-[13px] text-muted-foreground tabular-nums">{counts[c.id] ?? c.hint}</span>
                  {/if}
                  {#if c.shortcut}
                    {#each c.shortcut as k}<kbd class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded border border-border px-1 font-sans text-[11px] text-muted-foreground">{k}</kbd>{/each}
                  {/if}
                </span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="px-3 py-10 text-center text-[14px] text-muted-foreground" role="status">
            No results for “{query.trim()}”
          </div>
        {/each}
      </div>

      <div class="hidden h-10 shrink-0 items-center gap-4 border-t border-border px-4 text-[12px] text-muted-foreground sm:flex" aria-hidden="true">
        <span class="flex items-center gap-1.5"><kbd class="cmdk-kbd">↑</kbd><kbd class="cmdk-kbd">↓</kbd> Move</span>
        <span class="flex items-center gap-1.5"><kbd class="cmdk-kbd">↵</kbd> Open</span>
        <span class="ms-auto flex items-center gap-1.5"><kbd class="cmdk-kbd">?</kbd> Shortcuts</span>
        <span class="flex items-center gap-1.5"><kbd class="cmdk-kbd">{isMac ? "⌘" : "Ctrl"}</kbd><kbd class="cmdk-kbd">K</kbd> Toggle</span>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global([data-slot="palette"]) {
    box-shadow: 0 0 0 1px var(--overlay-edge, var(--border)), var(--overlay-depth-lg, none);
  }

  :global([data-slot="palette"][data-ending-style]),
  :global([data-slot="palette-overlay"][data-ending-style]) {
    opacity: 0;
  }

  .cmdk-kbd {
    display: inline-flex;
    height: 1.25rem;
    min-width: 1.25rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
    border: 1px solid var(--border);
    padding-inline: 0.25rem;
    font-family: var(--font-sans);
    font-size: 11px;
  }

  .cmdk-list {
    scroll-padding-block: 0.375rem;
    scrollbar-width: thin;
  }

  .cmdk-group + .cmdk-group {
    margin-top: 0.25rem;
  }

  @media (prefers-reduced-motion: no-preference) {
    :global([data-slot="palette"]) {
      transition:
        opacity 140ms cubic-bezier(0.4, 0, 1, 1),
        scale 140ms cubic-bezier(0.4, 0, 1, 1),
        filter 140ms cubic-bezier(0.4, 0, 1, 1);
    }

    :global([data-slot="palette"][data-ending-style]) {
      scale: 0.985;
      filter: blur(4px);
    }

    :global([data-slot="palette-overlay"]) {
      transition: opacity 140ms cubic-bezier(0.4, 0, 1, 1);
    }
  }
</style>
