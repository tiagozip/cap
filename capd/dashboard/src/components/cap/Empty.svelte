<script>
import {
  Empty as BaseEmpty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../ui/index.js";

let { title, action, children, class: className = "" } = $props();
</script>

<BaseEmpty class="max-w-xl {className}">
  <EmptyHeader class="max-w-md gap-1">
    {#if title}<EmptyTitle class="text-sm font-medium tracking-normal">{title}</EmptyTitle>{/if}
    {#if children}<EmptyDescription class="max-w-md text-balance">{@render children()}</EmptyDescription>{/if}
  </EmptyHeader>
  {#if action}<EmptyContent class="max-w-xl">{@render action()}</EmptyContent>{/if}
</BaseEmpty>
