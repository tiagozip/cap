<script>
import { onMount } from "svelte";
import { Button, Empty } from "../components/cap/index.js";
import { app } from "../lib/state.svelte.js";
import Activity from "./activity/Activity.svelte";
import { keyTab } from "./keyTabs.js";

const VIEWS = {
  events: () => import("./events/Events.svelte"),
  protection: () => import("./protection/Protection.svelte"),
  configuration: () => import("./config/Configuration.svelte"),
};

const tab = $derived(keyTab(app.route.tab));
const stale = $derived(
  app.loadingKey &&
    app.route.view === "key" &&
    app.route.siteKey !== app.key?.siteKey,
);
const views = $state({ activity: Activity });

const failed = $state({});

const load = (id) => {
  failed[id] = false;
  return VIEWS[id]?.()
    .then(({ default: View }) => {
      views[id] = View;
    })
    .catch(() => {
      failed[id] = true;
    });
};

$effect(() => {
  if (!views[tab]) load(tab);
});

onMount(() => {
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
  idle(() => {
    for (const id of Object.keys(VIEWS)) if (!views[id]) load(id);
  });
});
</script>

{#key `${app.key.siteKey}/${tab}`}
  {#if views[tab]}
    {@const View = views[tab]}
    <div class="kd-view flex flex-1 flex-col" class:stale aria-busy={stale || undefined}>
      <View />
    </div>
  {:else if failed[tab]}
    <div class="flex flex-1 items-center justify-center p-6">
      <Empty title="Couldn't load this page">
        Check your connection, or reload if capd was just updated.
        {#snippet action()}
          <Button onclick={() => load(tab)}>Try again</Button>
        {/snippet}
      </Empty>
    </div>
  {/if}
{/key}

<style>
  .kd-view.stale {
    opacity: 0.55;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .kd-view {
      transition: opacity 160ms ease-out;
    }

    .kd-view.stale {
      transition: opacity 240ms ease-out 150ms;
    }
  }
</style>
