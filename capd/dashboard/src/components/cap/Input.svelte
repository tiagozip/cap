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
  ...rest
} = $props();
</script>

<div class="relative flex w-full items-center {className}">
  {#if icon}
    <Icon name={icon} size={15} class="pointer-events-none absolute left-3 z-10 text-muted-foreground" />
  {/if}
  <Input
    bind:ref
    bind:value
    aria-invalid={invalid || undefined}
    class="{size === 'sm' ? 'h-8' : 'h-9'} {icon ? 'ps-9' : 'ps-3'} {suffix ? 'pe-10' : 'pe-3'} {mono ? 'font-mono' : ''} [&::-webkit-search-cancel-button]:hidden"
    {...rest}
  />
  {#if suffix}
    <div class="absolute right-1 flex items-center">{@render suffix()}</div>
  {/if}
</div>
