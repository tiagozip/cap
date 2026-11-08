<script>
import { Badge } from "../ui/badge/index.js";

let {
  tone = "neutral",
  dot = false,
  class: className = "",
  children,
} = $props();

const TONES = {
  neutral: "neutral",
  brand: "blue",
  success: "green",
  warning: "amber",
  danger: "destructive",
  outline: "outline",
};
</script>

<Badge variant={TONES[tone]} size="sm" class={className}>
  {#if dot}<span class="size-1.5 rounded-full bg-current"></span>{/if}
  {@render children()}
</Badge>
