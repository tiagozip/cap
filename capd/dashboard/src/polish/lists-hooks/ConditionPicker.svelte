<script>
import Icon from "../../components/Icon.svelte";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/index.js";
import { WEBHOOK_CONDITIONS } from "../../views/rules/rules.js";

let {
  id,
  value = $bindable([]),
  available = [],
  settings,
  onchange,
} = $props();

let open = $state(false);
let query = $state("");
let active = $state(0);
let list = $state(null);

const info = (t) => WEBHOOK_CONDITIONS[t] ?? [t, "", "Other", "info"];

const shown = $derived.by(() => {
  const q = query.trim().toLowerCase();
  return available
    .filter((t) => !value.includes(t))
    .filter(
      (t) => !q || info(t).slice(0, 3).join(" ").toLowerCase().includes(q),
    );
});

const add = (t) => {
  value = [...value, t];
  open = false;
  query = "";
  active = 0;
  onchange?.(t);
};

const remove = (t) => {
  value = value.filter((x) => x !== t);
  onchange?.(null);
};

const keydown = (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = shown.length;
    if (!n) return;
    active = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
    list
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Enter" && shown[active]) {
    e.preventDefault();
    add(shown[active]);
  }
};
</script>

<div class="flex flex-col gap-2">
  {#if value.length}
    <ul class="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
      {#each value as t (t)}
        {@const [label, hint, , icon] = info(t)}
        <li class="flex flex-col gap-2.5 px-3 py-2.5">
          <div class="flex items-center gap-3">
            <Icon name={icon} size={16} class="shrink-0 text-muted-foreground" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="text-sm font-medium">{label}</span>
              <span class="truncate text-xs text-muted-foreground">{hint}</span>
            </span>
            <button
              type="button"
              class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-foreground/7 [@media(hover:hover)]:hover:text-foreground"
              aria-label="Remove {label}"
              onclick={() => remove(t)}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          {#if settings}{@render settings(t)}{/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if shown.length || query}
    <Popover
      bind:open
      onOpenChange={(v) => {
        if (v) return;
        query = "";
        active = 0;
      }}
    >
      <PopoverTrigger>
        {#snippet child({ props })}
          <button
            {...props}
            {id}
            type="button"
            class="flex h-9 cursor-pointer items-center gap-2 self-start rounded-lg ps-2.5 pe-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:bg-foreground/6 {value.length ? 'text-muted-foreground [@media(hover:hover)]:hover:text-foreground' : 'border border-dashed border-input'}"
          >
            <Icon name="plus" size={14} />
            {value.length ? "Add another condition" : "Add a condition"}
          </button>
        {/snippet}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        arrow={false}
        onOpenAutoFocus={(e) => matchMedia("(pointer: coarse)").matches && e.preventDefault()}
        class="z-[95] max-h-[min(26rem,var(--bits-popover-content-available-height))] w-[min(26rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl p-0"
      >
        <label class="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" size={15} class="shrink-0 text-faint-foreground" />
          <span class="sr-only">Find a condition</span>
          <input
            bind:value={query}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="{id}-list"
            aria-activedescendant={shown.length ? `${id}-${active}` : undefined}
            autocomplete="off"
            spellcheck="false"
            placeholder="Find a condition"
            class="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
            oninput={() => (active = 0)}
            onkeydown={keydown}
          />
        </label>
        <div bind:this={list} id="{id}-list" role="listbox" aria-label="Conditions" class="flex min-h-0 flex-col overflow-y-auto p-1">
          {#each shown as t, i (t)}
            {@const [label, hint, group, icon] = info(t)}
            {#if group !== info(shown[i - 1] ?? "")[2] || i === 0}
              <span class="px-2 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">{group}</span>
            {/if}
            <button
              type="button"
              role="option"
              id="{id}-{i}"
              data-index={i}
              aria-selected={i === active}
              tabindex="-1"
              class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left outline-none {i === active ? 'bg-accent' : ''}"
              onpointermove={() => (active = i)}
              onclick={() => add(t)}
            >
              <Icon name={icon} size={16} class="shrink-0 text-muted-foreground" />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm">{label}</span>
                <span class="truncate text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          {:else}
            <p class="px-2 py-3 text-sm text-muted-foreground">No condition matches "{query}"</p>
          {/each}
        </div>
      </PopoverContent>
    </Popover>
  {/if}
</div>
