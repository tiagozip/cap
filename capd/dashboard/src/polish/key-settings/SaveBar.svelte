<script>
import { Button, Icon } from "../../components/cap/index.js";

let {
  items = [],
  invalid = false,
  saving = false,
  onsave,
  ondiscard,
  bar = $bindable(),
} = $props();

let open = $state(false);
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const count = $derived(items.length);
const summary = $derived(
  invalid
    ? "Fix the marked fields to save"
    : count
      ? `${count} unsaved ${count === 1 ? "change" : "changes"}`
      : "You have unsaved changes",
);

$effect(() => {
  if (!count) open = false;
});

const jump = (target) => {
  const el = document.getElementById(target);
  if (!el) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  if (el.matches("input, button, select, textarea, [tabindex]"))
    el.focus({ preventScroll: true });
};
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key !== "Escape" || !open || !bar?.contains(document.activeElement)) return;
    open = false;
    bar.querySelector("[aria-controls=ks-review]")?.focus();
  }}
/>

<div
  bind:this={bar}
  class="sticky bottom-5 z-40 mx-auto -mt-6 mb-6 flex w-[calc(100%-1.5rem)] max-w-md flex-col rounded-xl bg-popover text-sm text-popover-foreground shadow-overlay transition-[translate,opacity] duration-200 ease-(--ease-out) starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none"
  role="region"
  aria-label="Unsaved changes"
>
  {#if open}
    <ul id="ks-review" class="flex max-h-64 flex-col overflow-y-auto border-b border-border p-1.5">
      {#each items as item (item.key)}
        <li>
          <button
            type="button"
            disabled={!item.target}
            class="ks-item flex w-full cursor-pointer disabled:cursor-default items-baseline gap-4 rounded-lg px-2.5 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onclick={() => {
              open = false;
              jump(item.target);
            }}
          >
            <span class="shrink-0 text-muted-foreground">{item.label}</span>
            <span class="ms-auto flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 text-end">
              {#if item.added}
                {#each item.removed as r (r)}<s class="truncate text-muted-foreground decoration-muted-foreground/60">{r}</s>{/each}
                {#each item.added as a (a)}<span class="truncate">{a}</span>{/each}
                {#if item.cleared}<span>{item.empty}</span>{/if}
              {:else}
                <s class="truncate text-muted-foreground decoration-muted-foreground/60">{item.from}</s>
                <span class="truncate">{item.to}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="flex items-center gap-2 py-2 ps-2 pe-2">
    {#if count && !invalid}
      <button
        type="button"
        class="ks-toggle me-auto flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls="ks-review"
        onclick={() => (open = !open)}
      >
        <span role="status" class="tabular-nums">{summary}</span>
        <Icon name="up" size={14} class="ks-chevron text-muted-foreground {open ? 'rotate-180' : ''}" />
      </button>
    {:else}
      <span role="status" class="me-auto ps-2">{summary}</span>
    {/if}
    <Button variant="ghost" size="sm" disabled={saving} onclick={ondiscard}>Discard</Button>
    <Button variant="primary" size="sm" aria-busy={saving} aria-keyshortcuts={mac ? "Meta+S" : "Control+S"} onclick={onsave}>
      <span class="grid">
        <span class="col-start-1 row-start-1 flex items-center gap-2 transition-[opacity,filter] duration-150 ease-(--ease-out) motion-reduce:transition-none {saving ? 'opacity-0 blur-[2px]' : ''}">
          Save
          <kbd class="hidden font-sans text-xs opacity-60 md:inline" aria-hidden="true">{mac ? "⌘S" : "Ctrl S"}</kbd>
        </span>
        <span class="col-start-1 row-start-1 text-center transition-[opacity,filter] duration-150 ease-(--ease-out) motion-reduce:transition-none {saving ? '' : 'opacity-0 blur-[2px]'}" aria-hidden={!saving}>Saving…</span>
      </span>
    </Button>
  </div>
</div>

<style>
  @media (hover: hover) {
    .ks-item:not(:disabled):hover,
    .ks-toggle:hover {
      background: var(--accent);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .ks-item,
    .ks-toggle {
      transition: background-color 120ms ease-out;
    }

    .ks-toggle :global(.ks-chevron) {
      transition: rotate 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  }
</style>
