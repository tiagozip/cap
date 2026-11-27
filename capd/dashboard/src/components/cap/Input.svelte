<script>
import Icon from "../Icon.svelte";
import { Input } from "../ui/input/index.js";

let {
  value = $bindable(),
  icon,
  invalid = false,
  mono = false,
  size = "md",
  class: className = "",
  ref = $bindable(null),
  suffix,
  type = "text",
  ...rest
} = $props();

const clearable = $derived(type === "search" && !suffix);

const clear = () => {
  if (!ref) return;
  ref.value = "";
  ref.dispatchEvent(new Event("input", { bubbles: true }));
  ref.focus();
};
</script>

<div class="relative flex w-full items-center {className}">
  {#if icon}
    <Icon name={icon} size={15} class="pointer-events-none absolute left-3 z-10 text-muted-foreground" />
  {/if}
  <Input
    bind:ref
    bind:value
    {type}
    aria-invalid={invalid || undefined}
    class="{size === 'sm' ? 'h-8' : 'h-9'} {icon ? 'ps-9' : 'ps-3'} {suffix ? 'pe-10' : clearable ? 'pe-9' : 'pe-3'} {mono ? 'font-mono' : ''} [&::-webkit-search-cancel-button]:hidden"
    {...rest}
  />
  {#if clearable}
    <button
      type="button"
      class="in-clear absolute end-1.5 z-10 grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-foreground/7 [@media(hover:hover)]:hover:text-foreground"
      class:shown={!!value}
      tabindex={value ? 0 : -1}
      aria-hidden={!value}
      aria-label="Clear search"
      onclick={clear}
    >
      <Icon name="x" size={13} />
    </button>
  {/if}
  {#if suffix}
    <div class="absolute right-1 flex items-center">{@render suffix()}</div>
  {/if}
</div>

<style>
  .in-clear {
    opacity: 0;
    scale: 0.5;
    filter: blur(2px);
    pointer-events: none;
  }

  .in-clear.shown {
    opacity: 1;
    scale: 1;
    filter: none;
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: no-preference) {
    .in-clear {
      transition:
        opacity 140ms ease-out,
        scale 140ms ease-out,
        filter 140ms ease-out;
    }

    .in-clear.shown {
      transition-duration: 200ms;
      transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
    }

    .in-clear:active {
      scale: 0.9;
    }
  }
</style>
