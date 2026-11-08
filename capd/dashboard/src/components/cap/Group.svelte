<script>
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/index.js";

let { title, description, id, action, children, flush = false } = $props();
</script>

<Card variant="layered" class="cap-card" role="region" aria-labelledby={id}>
  <CardHeader class={[action && "grid-cols-[1fr_auto]", description && "grid-rows-[auto_auto]"]}>
    <CardTitle><h2 {id} class="scroll-mt-24">{title}</h2></CardTitle>
    {#if description}<CardDescription class="max-w-xl text-pretty">{description}</CardDescription>{/if}
    {#if action}<CardAction>{@render action()}</CardAction>{/if}
  </CardHeader>
  <CardContent class={flush ? "px-0" : "divide-y divide-border"}>
    {@render children()}
  </CardContent>
</Card>
