<script>
import { cn } from "../../../lib/utils.js";
import Button from "../button/Button.svelte";
import Icon from "../icon/Icon.svelte";
import Spinner from "../spinner/Spinner.svelte";

let { note, behind = false, onAction, onDismiss } = $props();

let drag = $state(null);
let offset = $state(0);

const ink = {
  error: "text-error size-5",
  warning: "text-warning size-4",
  info: "text-info size-4",
  success: "text-success size-4",
};
const glyph = {
  error: "alert-circle",
  warning: "alert-circle",
  info: "info-circle",
  success: "circle-check",
};
</script>

<div
  role="group"
  data-slot="toast"
  data-state={note.state}
  style:border-radius="18px"
  style:translate={offset ? `${offset}px 0` : undefined}
  style:opacity={offset ? Math.max(0.2, 1 - Math.abs(offset) / 160) : undefined}
  class={cn(
    "toast-pill relative flex max-w-lg touch-pan-y overflow-hidden bg-popover/80 text-sm text-foreground backdrop-blur-md",
    behind ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing",
    note.action ? "pe-2" : "pe-4",
    note.state ? "ps-3" : "ps-4",
    note.description && "pt-0.5",
    !drag && "toast-settle",
  )}
  onpointerdown={(event) => {
    if (behind || event.button !== 0 || event.target.closest("button")) return;
    drag = { x: event.clientX, t: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
  }}
  onpointermove={(event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    offset = Math.abs(dx) > 44 ? Math.sign(dx) * (44 + (Math.abs(dx) - 44) * 0.6) : dx;
  }}
  onpointerup={(event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - drag.t);
    drag = null;
    if (Math.abs(dx) > 44 || speed > 0.38) {
      onDismiss();
      return;
    }
    offset = 0;
  }}
  onpointercancel={() => {
    drag = null;
    offset = 0;
  }}
>
  <div
    class="toast-content grid min-w-max grid-cols-[auto_minmax(0,1fr)_auto] items-center"
    style:opacity={behind ? 0 : 1}
  >
    <div class="col-start-1 row-start-1 flex">
      {#if note.state}
        <div class="flex w-max items-center pe-3">
          <span class="flex size-4 shrink-0 items-center justify-center">
            {#if note.state === "pending"}
              <Spinner class="size-4 text-muted-foreground" label="In progress" />
            {:else}
              <Icon name={glyph[note.state]} class={cn("shrink-0", ink[note.state])} />
            {/if}
          </span>
        </div>
      {/if}
    </div>
    <div class={cn("relative col-start-2 row-start-1 flex h-9 items-center justify-self-start", note.description && "font-bold")}>
      <span class="w-max max-w-lg shrink-0 truncate">{note.message}</span>
    </div>
    <div class="col-start-3 row-start-1 flex">
      {#if note.action}
        <div class="-my-1 -me-1 flex items-center overflow-hidden rounded-full py-1 pe-1">
          <div class="w-max ps-7">
            <Button size="sm" onclick={onAction} class="h-7 rounded-full">{note.action.label}</Button>
          </div>
        </div>
      {/if}
    </div>
    {#if note.description}
      <div class={cn("toast-detail relative -top-1.5 col-span-2 col-start-2 row-start-2 w-0 min-w-full", note.action ? "pe-2" : "pe-0")}>
        <p class="pb-0.75 text-pretty text-muted-foreground">{note.description}</p>
      </div>
      <div
        aria-hidden="true"
        class="col-span-3 col-start-1 row-start-3"
        style:width={`${340 - (note.state ? 12 : 16) - (note.action ? 8 : 16)}px`}
      ></div>
    {/if}
  </div>
</div>

<style>
  .toast-content {
    transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .toast-settle {
    transition:
      padding var(--toast-morph-duration, 300ms) var(--toast-morph-ease, cubic-bezier(0.23, 1, 0.32, 1)),
      translate 300ms cubic-bezier(0.23, 1, 0.32, 1),
      opacity 200ms ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .toast-content,
    .toast-settle {
      transition: none;
    }
  }
</style>
