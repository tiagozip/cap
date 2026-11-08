<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  type = "text",
  value = $bindable(),
  files = $bindable(),
  ref = $bindable(null),
  ...rest
} = $props();

const autoDir = $derived(["text", "search", "email", "url"].includes(type));
const inheritPlaceholderDir = $derived(type === "text" || type === "search");
const classes = $derived(
  cn(
    "h-8 w-full min-w-0 rounded-lg border focus-field border-input bg-transparent px-2.5 py-1 text-base file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    inheritPlaceholderDir &&
      "[&[dir=auto]]:placeholder-shown:[direction:inherit]",
    className,
  ),
);
</script>

{#if type === "file"}
  <input bind:this={ref} data-slot="input" type="file" bind:files class={classes} {...rest} />
{:else}
  <input bind:this={ref} data-slot="input" {type} dir={autoDir ? "auto" : undefined} bind:value class={classes} {...rest} />
{/if}
