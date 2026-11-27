<script>
import Icon from "../../components/Icon.svelte";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/index.js";

let {
  id,
  value = $bindable([]),
  options = [],
  any,
  noun = ["item", "items"],
  empty = "Nothing to pick yet",
  lead,
  onchange,
} = $props();

let open = $state(false);
let query = $state("");

const searchable = $derived(options.length > 8);
const shown = $derived.by(() => {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) =>
    `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(q),
  );
});
const summary = $derived.by(() => {
  if (!value.length) return any;
  if (value.length === 1)
    return options.find((o) => o.value === value[0])?.label ?? value[0];
  return `${value.length} ${noun[1]}`;
});

const toggle = (v) => {
  value = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
  onchange?.(value);
};

const clear = () => {
  value = [];
  onchange?.(value);
};
</script>

<Popover bind:open onOpenChange={(v) => v || (query = "")}>
  <PopoverTrigger>
    {#snippet child({ props })}
      <button
        {...props}
        {id}
        type="button"
        class="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent ps-3 pe-2.5 text-left text-sm transition-[border-color,box-shadow] duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [@media(hover:hover)]:hover:border-foreground/20"
      >
        <span class="min-w-0 flex-1 truncate {value.length ? '' : 'text-muted-foreground'}">{summary}</span>
        <Icon name="selector" size={14} class="shrink-0 text-muted-foreground" />
      </button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    align="start"
    sideOffset={6}
    arrow={false}
    onOpenAutoFocus={(e) => (!searchable || matchMedia("(pointer: coarse)").matches) && e.preventDefault()}
    class="z-[95] max-h-80 w-(--bits-popover-anchor-width) min-w-64 gap-0 overflow-hidden rounded-xl p-0"
  >
    {#if searchable}
      <label class="flex items-center gap-2 border-b border-border px-3">
        <Icon name="search" size={15} class="shrink-0 text-faint-foreground" />
        <span class="sr-only">Find {noun[1]}</span>
        <input
          bind:value={query}
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="Find {noun[1]}"
          class="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint-foreground"
        />
      </label>
    {/if}
    <div class="flex min-h-0 flex-col overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label={noun[1]}>
      {#each shown as o, i (o.value)}
        {#if o.group && o.group !== shown[i - 1]?.group}
          <span class="px-2 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">{o.group}</span>
        {/if}
        {@const on = value.includes(o.value)}
        <button
          type="button"
          role="option"
          aria-selected={on}
          class="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:bg-accent [@media(hover:hover)]:hover:bg-accent"
          onclick={() => toggle(o.value)}
        >
          <span class="grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors duration-100 {on ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}">
            {#if on}<Icon name="check" size={11} stroke={3} />{/if}
          </span>
          {#if lead}{@render lead(o)}{/if}
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate">{o.label}</span>
            {#if o.hint}<span class="truncate text-xs text-muted-foreground">{o.hint}</span>{/if}
          </span>
        </button>
      {:else}
        <p class="px-2 py-3 text-sm text-muted-foreground">{query ? `No ${noun[1]} match "${query}"` : empty}</p>
      {/each}
    </div>
    {#if value.length}
      <div class="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{value.length} {value.length === 1 ? noun[0] : noun[1]} picked</span>
        <button type="button" class="cursor-pointer rounded-sm underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline" onclick={clear}>Clear</button>
      </div>
    {/if}
  </PopoverContent>
</Popover>
