<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
import { dismissToast, pauseToasts, toasts } from "../toast.svelte.js";
import ToastPill from "./ToastPill.svelte";

let { position = "bottom-end", class: className } = $props();

let hovering = $state(false);
let focused = $state(false);
let hidden = $state(false);
let sizes = $state({});
const open = $derived(hovering || focused);
const notes = $derived(toasts.notes);
const piled = $derived(notes.length > 1 && !open);
const side = $derived(position.split("-")[0]);
const edge = $derived(position.split("-")[1] ?? "center");
const fall = $derived(side === "top" ? 1 : -1);
const heights = $derived(notes.map((note) => sizes[note.id]?.height ?? 36));
const deck = $derived(notes[0] ? sizes[notes[0].id] : undefined);

$effect(() => {
  pauseToasts(open || hidden);
});

const remembered = new Map();
const placements = $derived.by(() => {
  const out = {};
  let fan = 0;
  for (const [index, note] of notes.entries()) {
    const depth = Math.min(index, 2);
    const base = piled ? depth * 10 : fan;
    fan += (heights[index] ?? 36) + 8;
    const drop =
      piled && index > 0
        ? Math.max(0, (heights[0] ?? 36) - (heights[index] ?? 36))
        : 0;
    out[note.id] = remembered
      .set(note.id, {
        y: (base + drop) * fall,
        scale: piled ? 1 - depth * 0.03 : 1,
        opacity: piled ? (index < 3 ? 1 - depth * 0.15 : 0) : 1,
        layer: notes.length - index,
        behind: piled && index > 0,
      })
      .get(note.id);
  }
  return out;
});
const fallback = { y: 0, scale: 1, opacity: 0, layer: 0, behind: true };
const place = (id) => placements[id] ?? remembered.get(id) ?? fallback;

const measure = (node, id) => {
  const observer = new ResizeObserver(() => {
    const { maxWidth, maxHeight } = node.style;
    node.style.maxWidth = "";
    node.style.maxHeight = "";
    const next = { width: node.offsetWidth, height: node.offsetHeight };
    node.style.maxWidth = maxWidth;
    node.style.maxHeight = maxHeight;
    const current = sizes[id];
    if (current?.width === next.width && current?.height === next.height)
      return;
    sizes[id] = next;
  });
  observer.observe(node.firstElementChild ?? node);
  return () => {
    observer.disconnect();
    delete sizes[id];
    remembered.delete(id);
  };
};

const enter = (_node, params) => {
  const { y, scale } = params();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return { duration: 0 };
  return {
    duration: 300,
    easing: (t) => 1 - (1 - t) ** 3,
    css: (t, u) =>
      `opacity:${t};transform:translateY(${y - 8 * fall * u}px) scale(${scale * (0.98 + 0.02 * t)});`,
  };
};
const leave = (_node, params) => {
  const { y, scale } = params();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return { duration: 0 };
  return {
    duration: 200,
    easing: (t) => t,
    css: (t, u) =>
      `opacity:${t};transform:translateY(${y - 8 * fall * u}px) scale(${scale * (0.96 + 0.04 * t)});filter:blur(${4 * u}px);`,
  };
};
</script>

<svelte:document onvisibilitychange={() => (hidden = document.hidden)} />

<section
  aria-label={t("Notifications")}
  aria-live="polite"
  class={cn("pointer-events-none fixed inset-x-0 z-100", side === "top" ? "top-4" : "bottom-4", className)}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => (hovering = false)}
  onfocusin={() => (focused = true)}
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) focused = false;
  }}
>
  {#each notes as note (note.id)}
    <div
      class={cn(
        "toast-slot absolute inset-x-0 flex px-4",
        side === "top" ? "top-0" : "bottom-0",
        edge === "start" || edge === "left" ? "justify-start" : edge === "end" || edge === "right" ? "justify-end" : "justify-center",
      )}
      style:z-index={place(note.id).layer}
      style:transform-origin={`${side} ${edge === "center" ? "center" : edge === "start" || edge === "left" ? "left" : "right"}`}
      style:transform={`translateY(${place(note.id).y}px) scale(${place(note.id).scale})`}
      style:opacity={place(note.id).opacity}
      aria-hidden={place(note.id).opacity === 0 || undefined}
      in:enter={() => place(note.id)}
      out:leave={() => place(note.id)}
    >
      <div
        class="toast-cap relative flex flex-col"
        style:max-width={place(note.id).behind && deck ? `${deck.width}px` : undefined}
        style:max-height={place(note.id).behind && deck ? `${deck.height}px` : undefined}
        {@attach (node) => measure(node, note.id)}
      >
        <ToastPill
          {note}
          behind={place(note.id).behind}
          onDismiss={() => dismissToast(note.id)}
          onAction={() => {
            note.action?.run();
            dismissToast(note.id);
          }}
        />
      </div>
    </div>
  {/each}
</section>

<style>
  .toast-slot,
  .toast-cap {
    transition:
      transform 300ms cubic-bezier(0.23, 1, 0.32, 1),
      opacity 300ms cubic-bezier(0.23, 1, 0.32, 1),
      max-width 300ms cubic-bezier(0.23, 1, 0.32, 1),
      max-height 300ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .toast-slot,
    .toast-cap {
      transition: none;
    }
  }
</style>
