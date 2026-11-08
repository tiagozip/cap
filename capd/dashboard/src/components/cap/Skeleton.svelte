<script>
import { untrack } from "svelte";
import { queueReveal } from "./reveal-queue.js";

const props = $props();

const driven = $derived("data" in props);
const waiting = $derived(
  !!props.loading ||
    (driven && props.data == null && !props.error && !props.empty),
);
let held = $state(untrack(() => waiting));
let last = null;

$effect(() => {
  if (props.data != null) last = { id: props.id, data: props.data };
});

const decoded = (urls) =>
  Promise.race([
    Promise.all(
      urls.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {});
      }),
    ),
    new Promise((resolve) => setTimeout(resolve, 800)),
  ]);

$effect(() => {
  if (waiting) {
    held = true;
    return;
  }
  if (!untrack(() => held)) return;
  const urls = untrack(() => props.preload?.filter(Boolean) ?? []);
  let live = true;
  let cancel;
  (urls.length ? decoded(urls) : Promise.resolve()).then(() => {
    if (!live) return;
    cancel = queueReveal(() => {
      held = false;
      untrack(() => props.onreveal?.());
    });
  });
  return () => {
    live = false;
    cancel?.();
  };
});

const ghostData = $derived(
  driven && last && last.id === props.id ? last.data : props.sample,
);
const phase = $derived(
  held ? "loading" : props.error ? "error" : props.empty ? "empty" : "content",
);
</script>

{#if phase === "loading"}
  {@const ghost = !props.skeleton && (!driven || ghostData != null)}
  <div class="sk-pane {props.class ?? ''}" class:sk-ghost={ghost} style={props.style} aria-busy="true">
    {#if props.label}<span class="sr-only" role="status">{props.label}</span>{/if}
    {#if props.skeleton}
      {@render props.skeleton()}
    {:else if ghost}
      <div class="contents" aria-hidden="true" inert>{@render props.children?.(ghostData)}</div>
    {:else}
      <span class="sk-bone h-3 w-2/3" aria-hidden="true"></span>
      <span class="sk-bone mt-2 h-3 w-1/2" aria-hidden="true"></span>
    {/if}
  </div>
{:else}
  <div class="sk-pane {props.class ?? ''}" style={props.style}>
    {#if phase === "error"}
      {@render props.errorMessage?.(props.error)}
    {:else if phase === "empty"}
      {@render props.emptyMessage?.()}
    {:else if driven}
      {@render props.children?.(props.data)}
    {:else}
      {@render props.children?.()}
    {/if}
  </div>
{/if}
