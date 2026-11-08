<script>
import { setContext, tick } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const state = $state({ highlight: null });
setContext("pagination-highlight", state);

const measure = () => {
  const active = ref?.querySelector("[data-active=true]");
  const next = active
    ? {
        x: active.offsetLeft,
        width: active.offsetWidth,
        y: active.offsetTop,
        height: active.offsetHeight,
      }
    : null;
  const current = state.highlight;
  if (current === next) return;
  if (
    current &&
    next &&
    current.x === next.x &&
    current.width === next.width &&
    current.y === next.y &&
    current.height === next.height
  )
    return;
  state.highlight = next;
};

$effect(() => {
  if (!ref) return;
  measure();
  const observer = new MutationObserver(() => tick().then(measure));
  observer.observe(ref, {
    attributes: true,
    subtree: true,
    attributeFilter: ["data-active"],
    childList: true,
  });
  const resize = new ResizeObserver(measure);
  resize.observe(ref);
  let cancelled = false;
  document.fonts.ready.then(() => {
    if (!cancelled) measure();
  });
  return () => {
    cancelled = true;
    observer.disconnect();
    resize.disconnect();
  };
});
</script>

<ul bind:this={ref} data-slot="pagination-content" class={cn("relative flex items-center gap-0.5", className)} {...rest}>
  {#if state.highlight}
    <span
      aria-hidden="true"
      data-slot="pagination-highlight"
      class="sliding-tab-pill pointer-events-none absolute left-0 rounded-lg border border-border dark:border-input"
      style:transform={`translateX(${state.highlight.x}px)`}
      style:width={`${state.highlight.width}px`}
      style:top={`${state.highlight.y}px`}
      style:height={`${state.highlight.height}px`}
    ></span>
  {/if}
  {@render children?.()}
</ul>
