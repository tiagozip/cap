<script>
import { onMount } from "svelte";
import { Button, Icon } from "../../components/cap/index.js";
import { unsaved } from "./dirty.svelte.js";

let {
  dirty = false,
  saving = false,
  error = "",
  label = "Save changes",
  compact = false,
  onsave,
  ondiscard,
} = $props();

let bar = $state(null);
let saved = $state(false);
let busy = $state(false);
let timer;

const run = async () => {
  if (!dirty || saving || busy) return;
  busy = true;
  const ok = await onsave();
  busy = false;
  if (ok === false) return;
  saved = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    saved = false;
  }, 1800);
};

$effect(() => {
  if (dirty) saved = false;
});

let section = $state("");

$effect(() => {
  if (bar && !section)
    section = bar.closest("[id^=settings-]")?.id.slice(9) ?? "";
});

$effect(() => {
  if (!dirty || !section) return;
  const id = section;
  unsaved.add(id);
  const warn = (e) => e.preventDefault();
  window.addEventListener("beforeunload", warn);
  return () => {
    unsaved.delete(id);
    window.removeEventListener("beforeunload", warn);
  };
});

onMount(() => {
  const key = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== "s")
      return;
    const scope = bar?.closest("[role=region]");
    if (!scope?.contains(document.activeElement) || !dirty) return;
    e.preventDefault();
    run();
  };
  window.addEventListener("keydown", key);
  return () => {
    window.removeEventListener("keydown", key);
    clearTimeout(timer);
  };
});
</script>

{#if !compact || dirty || saving || busy || saved || error}
<div bind:this={bar} class="flex flex-wrap items-center justify-end gap-3 {compact ? 'bar-in max-md:flex-row-reverse' : 'py-5'}">
  {#if error}
    <p class="me-auto text-sm text-pretty text-destructive" role="alert">{error}</p>
  {/if}
  <span class="sr-only" role="status">{saved ? "Saved" : ""}</span>
  {#if dirty && !saving && !busy}
    <span class="pending flex items-center gap-3">
      <span class="flex items-center gap-2 text-sm text-muted-foreground {compact ? 'sr-only' : 'max-sm:sr-only'}">
        <span class="size-1.5 rounded-full bg-primary" aria-hidden="true"></span>
        Unsaved changes
      </span>
      {#if ondiscard}
        <Button variant="ghost" onclick={ondiscard}>Discard</Button>
      {/if}
    </span>
  {/if}
  <Button
    variant="primary"
    class="save"
    disabled={(!dirty && !saved) || saving || busy}
    aria-keyshortcuts="Control+S Meta+S"
    onclick={run}
  >
    <span class="grid items-center justify-items-center">
      <span class="swap col-start-1 row-start-1 {saved ? 'out' : ''}">{saving || busy ? "Saving" : label}</span>
      <span class="swap col-start-1 row-start-1 flex items-center gap-1.5 {saved ? '' : 'out'}" aria-hidden="true">
        <Icon name="check" size={14} />
        Saved
      </span>
    </span>
  </Button>
</div>
{/if}

<style>
  .swap.out {
    opacity: 0;
    visibility: hidden;
  }
  @media (prefers-reduced-motion: no-preference) {
    .swap {
      transition:
        opacity 180ms ease-out,
        filter 180ms ease-out,
        transform 180ms ease-out,
        visibility 0s;
    }
    .swap.out {
      filter: blur(4px);
      transform: scale(0.9);
      transition:
        opacity 140ms ease-in,
        filter 140ms ease-in,
        transform 140ms ease-in,
        visibility 0s 140ms;
    }
    .bar-in {
      animation: pending-in 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .pending {
      animation: pending-in 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }
  }
  @keyframes pending-in {
    from {
      opacity: 0;
      filter: blur(3px);
    }
  }
</style>
