<script>
import BaseEmpty from "../ui/empty/Empty.svelte";
import EmptyContent from "../ui/empty/EmptyContent.svelte";
import EmptyDescription from "../ui/empty/EmptyDescription.svelte";
import EmptyHeader from "../ui/empty/EmptyHeader.svelte";
import EmptyTitle from "../ui/empty/EmptyTitle.svelte";

let { title, action, children, class: className = "" } = $props();
</script>

<BaseEmpty class="cap-empty max-w-xl {className}">
  <EmptyHeader class="max-w-md gap-1">
    {#if title}<EmptyTitle class="text-sm font-medium tracking-normal">{title}</EmptyTitle>{/if}
    {#if children}<EmptyDescription class="max-w-md text-balance">{@render children()}</EmptyDescription>{/if}
  </EmptyHeader>
  {#if action}<EmptyContent class="max-w-xl">{@render action()}</EmptyContent>{/if}
</BaseEmpty>

<style>

</style>
