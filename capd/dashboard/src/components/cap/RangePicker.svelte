<script>
import Icon from "../Icon.svelte";
import Popover from "../ui/popover/Popover.svelte";
import PopoverContent from "../ui/popover/PopoverContent.svelte";
import PopoverTrigger from "../ui/popover/PopoverTrigger.svelte";
import Button from "./Button.svelte";

let {
  value,
  ranges,
  onchange,
  custom = null,
  oncustom,
  class: className = "",
} = $props();

const short = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const long = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const current = $derived(ranges.find((r) => r.id === value) ?? ranges[0]);
const label = $derived.by(() => {
  if (!custom) return current.label;
  const a = new Date(custom.from);
  const b = new Date(custom.to - 1);
  const year = new Date().getFullYear();
  const fmt =
    a.getFullYear() === year && b.getFullYear() === year ? short : long;
  return a.toDateString() === b.toDateString()
    ? fmt.format(a)
    : `${fmt.format(a)} to ${fmt.format(b)}`;
});

let open = $state(false);
let calendar = $state(null);
let list = $state(null);
let picking = $state(false);

$effect(() => {
  if (!open || !oncustom || calendar) return;
  import("./RangeCalendar.svelte").then((m) => {
    calendar = m.default;
  });
});

const pick = (id) => {
  open = false;
  if (id !== value || custom) onchange(id);
};

const move = (e) => {
  const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const items = [...list.querySelectorAll("button")];
  const at = items.indexOf(document.activeElement);
  items[(at + step + items.length) % items.length]?.focus();
};
</script>

<Popover
  bind:open
  onOpenChange={(v) => {
    if (v) picking = !!custom;
  }}
>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} class="focus-visible:z-10 {className}" aria-label="Time range: {label}">
        <span class="tabular-nums">{label}</span>
        <Icon name="selector" size={13} class="-mr-0.5 text-muted-foreground" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent
    align="end"
    sideOffset={6}
    arrow={false}
    onOpenAutoFocus={(e) => {
      e.preventDefault();
      list?.querySelector("[aria-pressed='true']")?.focus();
    }}
    class="z-[95] w-auto max-w-[calc(100vw-2rem)] flex-row gap-0 rounded-xl p-1.5 max-sm:flex-col"
  >
    <div bind:this={list} class="flex w-48 shrink-0 flex-col max-sm:w-full" role="toolbar" aria-orientation="vertical" aria-label="Time ranges" tabindex="-1" onkeydown={move}>
      {#each ranges as r (r.id)}
        {@const active = !custom && r.id === value}
        <button
          type="button"
          aria-pressed={active}
          class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm outline-hidden select-none focus-visible:bg-accent focus-visible:text-accent-foreground [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-accent-foreground"
          onclick={() => pick(r.id)}
        >
          <span class="min-w-0 flex-1">{r.label}</span>
          <span class="text-xs text-muted-foreground tabular-nums">{r.short}</span>
          <span class="flex w-4 justify-end">{#if active}<Icon name="check" size={14} />{/if}</span>
        </button>
      {/each}
      {#if oncustom}
        <div class="-mx-1.5 my-1.5 h-px bg-border" role="none"></div>
        <button
          type="button"
          aria-pressed={!!custom}
          aria-expanded={picking}
          class="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm outline-hidden select-none focus-visible:bg-accent focus-visible:text-accent-foreground [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-accent-foreground {picking ? 'bg-accent text-accent-foreground' : ''}"
          onclick={() => (picking = true)}
        >
          <span class="min-w-0 flex-1">Custom range...</span>
          <span class="flex w-4 justify-end">{#if custom}<Icon name="check" size={14} />{/if}</span>
        </button>
      {/if}
    </div>
    {#if oncustom && picking}
      <div class="calendar-in ms-1.5 border-s border-border ps-1.5 max-sm:ms-0 max-sm:mt-1.5 max-sm:border-s-0 max-sm:border-t max-sm:ps-0 max-sm:pt-1.5">
        {#if calendar}
          {@const Calendar = calendar}
          <Calendar
            {custom}
            onpick={(range) => {
              open = false;
              oncustom(range);
            }}
          />
        {:else}
          <div class="h-[18.5rem] w-[15.5rem]"></div>
        {/if}
      </div>
    {/if}
  </PopoverContent>
</Popover>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .calendar-in {
      animation: calendar-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  @keyframes calendar-in {
    from {
      opacity: 0;
      filter: blur(4px);
      translate: -4px 0;
    }
  }
</style>
