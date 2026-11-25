<script>
let {
  label,
  for: htmlFor,
  help,
  wide = false,
  muted = false,
  locked = false,
  below,
  children,
} = $props();
</script>

<div class="grid gap-3 py-5 max-md:[&:has(>:last-child>[role=switch]:only-child)]:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-12 {muted ? 'opacity-60' : ''}">
  <div class="flex min-w-0 flex-col gap-1">
    {#if htmlFor}
      <label for={htmlFor} class="text-sm font-medium">{label}</label>
    {:else}
      <p class="text-sm font-medium">{label}</p>
    {/if}
    {#if help}<p class="text-sm text-pretty text-muted-foreground">{help}</p>{/if}
    {#if locked}<p class="text-sm text-pretty text-muted-foreground">Set by Config File. Change it there and restart Cap.</p>{/if}
  </div>
  <!-- A locked row is a disabled fieldset, which disables every control in it. -->
  <svelte:element
    this={locked ? "fieldset" : "div"}
    disabled={locked || undefined}
    class="flex min-w-0 flex-col gap-3 {wide ? '' : 'md:items-end'} {locked ? 'opacity-60' : ''}"
  >
    {@render children?.()}
    {#if below}{@render below()}{/if}
  </svelte:element>
</div>
