<script>
import { app } from "../lib/state.svelte.js";
import Activity from "./activity/Activity.svelte";
import Configuration from "./config/Configuration.svelte";
import Events from "./events/Events.svelte";
import { keyTab } from "./keyTabs.js";
import Protection from "./protection/Protection.svelte";

const tab = $derived(keyTab(app.route.tab));
</script>

{#key app.key.siteKey}
  {#if tab === "activity"}
    <Activity />
  {:else if tab === "events"}
    <Events />
  {:else if tab === "protection"}
    <Protection />
  {:else}
    <Configuration />
  {/if}
{/key}
