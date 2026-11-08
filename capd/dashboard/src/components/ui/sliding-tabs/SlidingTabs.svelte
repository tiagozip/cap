<script>
import { tick } from "svelte";
import { cn } from "../../../lib/utils.js";

let {
  tabs,
  value = $bindable(),
  onChange,
  indicator = "pill",
  flat = false,
  icons = "active",
  class: className,
  pillClass,
  tabClass,
  activeTabClass,
} = $props();

const raised = $derived(indicator === "pill" && !flat);
let root = $state(null);
const tabEls = {};
const labelEls = {};
const iconEls = {};
let box = $state(null);
let spans = $state({});
let iconWidths = $state({});

const showsIcon = (tab) => !!tab.icon && (icons === "all" || tab.id === value);

const measure = () => {
  const active = tabEls[value];
  if (!root || !active) return;
  const slots = [...root.querySelectorAll('[data-slot="sliding-tabs-icon"]')];
  const from = slots.map((slot) => slot.style.width);
  const settled = slots.map((slot) => getComputedStyle(slot).width);
  for (const slot of slots) slot.style.transition = "none";
  box = {
    x: active.offsetLeft,
    width: active.offsetWidth,
    y: active.offsetTop,
    height: active.offsetHeight,
  };
  const next = {};
  for (const tab of tabs) {
    const button = tabEls[tab.id];
    const label = labelEls[tab.id];
    if (button && label)
      next[tab.id] = {
        left: button.offsetLeft + label.offsetLeft,
        width: label.offsetWidth,
      };
  }
  spans = next;
  for (const [index, slot] of slots.entries())
    slot.style.width = settled[index] ?? "";
  void root.offsetWidth;
  for (const [index, slot] of slots.entries()) {
    slot.style.transition = "";
    slot.style.width = from[index] ?? "";
  }
};

$effect(() => {
  tabs;
  const next = {};
  for (const tab of tabs) {
    const icon = iconEls[tab.id];
    if (icon) next[tab.id] = icon.offsetWidth;
  }
  iconWidths = next;
});

$effect(() => {
  value;
  indicator;
  icons;
  iconWidths;
  tick().then(measure);
  let cancelled = false;
  document.fonts.ready.then(() => {
    if (!cancelled) measure();
  });
  return () => {
    cancelled = true;
  };
});

const pill = $derived(
  box === null
    ? null
    : indicator === "underline"
      ? { x: box.x, width: box.width, top: box.y + box.height - 2, height: 2 }
      : {
          x: box.x + 1,
          width: box.width - 2,
          top: box.y + 1,
          height: box.height - 2,
        },
);

const clip = (id) => {
  const span = spans[id];
  if (!pill || !span) return undefined;
  return `inset(0 ${span.left + span.width - (pill.x + pill.width)}px 0 ${pill.x - span.left}px)`;
};
</script>

{#snippet iconSlot(tab, measured)}
  {#if tab.icon}
    <span
      data-slot="sliding-tabs-icon"
      data-shown={showsIcon(tab) || undefined}
      class="sliding-tab-icon-slot flex justify-end"
      style:width={`${showsIcon(tab) ? (iconWidths[tab.id] ?? 0) : 0}px`}
    >
      {#if measured}
        <span bind:this={iconEls[tab.id]} class="pointer-events-none flex w-max shrink-0 items-center pe-1.5">
          <span aria-hidden="true" class="sliding-tab-icon flex">{@render tab.icon()}</span>
        </span>
      {:else}
        <span class="pointer-events-none flex w-max shrink-0 items-center pe-1.5">
          <span aria-hidden="true" class="sliding-tab-icon flex">{@render tab.icon()}</span>
        </span>
      {/if}
    </span>
  {/if}
{/snippet}

{#snippet labelText(tab)}
  {#if typeof tab.label === "function"}{@render tab.label(tab)}{:else}{tab.label}{/if}
{/snippet}

<div bind:this={root} class={cn("relative inline-flex", indicator === "pill" && "rounded-full", className)}>
  {#if pill}
    <span
      class={cn(
        "sliding-tab-pill pointer-events-none absolute left-0 rounded-full",
        raised ? "sliding-tab-face" : indicator === "pill" && "bg-foreground shadow-sm",
        pillClass,
      )}
      style:transform={`translateX(${pill.x}px)`}
      style:width={`${pill.width}px`}
      style:top={`${pill.top}px`}
      style:height={`${pill.height}px`}
    ></span>
  {/if}
  {#each tabs as tab (tab.id)}
    <button
      bind:this={tabEls[tab.id]}
      type="button"
      data-slot="sliding-tabs-item"
      data-tip={tab.tip}
      data-current={tab.id === value || undefined}
      aria-pressed={tab.id === value}
      onclick={() => {
        value = tab.id;
        onChange?.(tab.id);
      }}
      class={cn(
        "relative z-10 flex-none cursor-pointer rounded-full whitespace-nowrap text-muted-foreground transition-[transform,color,box-shadow] duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:not-data-current:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100",
        raised && "text-foreground/80 dark:text-muted-foreground",
        tabClass,
      )}
    >
      <span class="relative grid" bind:this={labelEls[tab.id]}>
        <span class={cn("col-start-1 row-start-1", tab.icon && "flex items-center")}>
          {@render iconSlot(tab, true)}
          {@render labelText(tab)}
        </span>
        {#if pill}
          <span
            aria-hidden="true"
            class={cn(
              "sliding-tab-active-label pointer-events-none col-start-1 row-start-1",
              tab.icon && "flex items-center",
              activeTabClass ?? (raised ? "text-foreground" : indicator === "pill" ? "text-background" : "text-foreground"),
            )}
            style:clip-path={clip(tab.id)}
          >
            {@render iconSlot(tab, false)}
            {@render labelText(tab)}
          </span>
        {/if}
      </span>
    </button>
  {/each}
</div>
