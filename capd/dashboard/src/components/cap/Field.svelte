<script>
let {
  label,
  for: htmlFor,
  help,
  error,
  optional = false,
  children,
  class: className = "",
} = $props();
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label}
    <label for={htmlFor} class="text-sm font-medium">
      {label}{#if optional}<span class="font-normal text-muted-foreground">{" "}(optional)</span>{/if}
    </label>
  {/if}
  {@render children()}
  {#if error}
    <p class="text-sm text-destructive" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">{error}</p>
  {:else if help}
    <p class="text-sm text-pretty text-muted-foreground">{help}</p>
  {/if}
</div>
