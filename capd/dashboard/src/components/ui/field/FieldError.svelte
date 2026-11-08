<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  errors,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const unique = $derived(
  [
    ...new Map(
      (errors ?? []).filter(Boolean).map((error) => [error?.message, error]),
    ).values(),
  ].filter((error) => error?.message),
);
</script>

{#if children || unique.length}
  <div bind:this={ref} role="alert" data-slot="field-error" class={cn("text-sm font-normal text-destructive", className)} {...rest}>
    {#if children}
      {@render children()}
    {:else if unique.length === 1}
      {unique[0].message}
    {:else}
      <ul class="ms-4 flex list-disc flex-col gap-1">
        {#each unique as error (error.message)}
          <li>{error.message}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
