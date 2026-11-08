<script>
let {
  label,
  for: htmlFor,
  help,
  wide = false,
  muted = false,
  below,
  children,
} = $props();
</script>

<div class="grid gap-3 py-5 max-md:[&:has(>div:last-child>[role=switch]:only-child)]:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-12 {muted ? 'opacity-60' : ''}">
  <div class="flex min-w-0 flex-col gap-1">
    {#if htmlFor}
      <label for={htmlFor} class="text-sm font-medium">{label}</label>
    {:else}
      <p class="text-sm font-medium">{label}</p>
    {/if}
    {#if help}<p class="text-sm text-pretty text-muted-foreground">{help}</p>{/if}
  </div>
  <div
    class="flex min-w-0 flex-col gap-3 {wide ? '' : 'md:items-end'}"
  >
    {@render children?.()}
    {#if below}{@render below()}{/if}
  </div>
</div>
