<script>
import Icon from "../Icon.svelte";
import { DropdownMenuItem } from "../ui/index.js";

let {
  icon,
  inset = false,
  danger = false,
  href,
  onselect,
  hint,
  children,
} = $props();
const variant = $derived(danger ? "destructive" : "default");
</script>

{#snippet body()}
  {#if icon}<Icon name={icon} size={16} class={danger ? "" : "text-muted-foreground"} />{:else if inset}<span class="size-4 shrink-0" aria-hidden="true"></span>{/if}
  <span class="min-w-0 flex-1">{@render children()}</span>
  {#if hint}<span class="text-xs text-muted-foreground">{hint}</span>{/if}
{/snippet}

{#if href}
  <DropdownMenuItem {variant} onSelect={onselect}>
    {#snippet child({ props })}
      <a {href} {...props} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener">{@render body()}</a>
    {/snippet}
  </DropdownMenuItem>
{:else}
  <DropdownMenuItem {variant} onSelect={onselect}>{@render body()}</DropdownMenuItem>
{/if}
