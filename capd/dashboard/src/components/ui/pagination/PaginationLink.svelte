<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { buttonVariants } from "../button/variants.js";

let {
  class: className,
  isActive,
  size = "icon",
  href,
  disabled,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const highlight = getContext("pagination-highlight");
const tracked = $derived(isActive !== undefined);
let label = $state(null);

const clip = $derived.by(() => {
  const h = highlight?.highlight;
  if (!h || !ref || !label) return undefined;
  const left = ref.offsetLeft + label.offsetLeft;
  return `inset(0 ${left + label.offsetWidth - (h.x + h.width)}px 0 ${h.x - left}px)`;
});
const variant = $derived(
  isActive && !highlight?.highlight ? "outline" : "ghost",
);
const classes = $derived(
  buttonVariants({
    variant,
    size,
    class: cn(
      "aria-disabled:pointer-events-none aria-disabled:opacity-50",
      tracked &&
        "text-muted-foreground aria-[current=page]:hover:before:bg-transparent!",
      className,
    ),
  }),
);
</script>

{#snippet content()}
  {#if tracked}
    <span bind:this={label} class="relative grid">
      <span class="col-start-1 row-start-1">{@render children?.()}</span>
      <span aria-hidden="true" class="sliding-tab-active-label pointer-events-none col-start-1 row-start-1 text-foreground" style:clip-path={clip}>
        {@render children?.()}
      </span>
    </span>
  {:else}
    {@render children?.()}
  {/if}
{/snippet}

{#if href !== undefined}
  <a
    bind:this={ref}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    aria-current={isActive ? "page" : undefined}
    data-slot="pagination-link"
    data-active={isActive}
    data-variant={variant}
    class={classes}
    {...rest}
  >
    {@render content()}
  </a>
{:else}
  <button
    bind:this={ref}
    type="button"
    {disabled}
    aria-disabled={disabled || undefined}
    aria-current={isActive ? "page" : undefined}
    data-slot="pagination-link"
    data-active={isActive}
    data-variant={variant}
    class={classes}
    {...rest}
  >
    {@render content()}
  </button>
{/if}
