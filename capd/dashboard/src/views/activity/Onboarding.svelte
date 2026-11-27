<script>
import { app } from "../../lib/state.svelte.js";

const skipped = (() => {
  try {
    return localStorage.getItem(`cap_onboarded:${app.key.siteKey}`) === "1";
  } catch {
    return false;
  }
})();
</script>

{#if !skipped}
  {#await import("../../polish/first-run/Checklist.svelte") then { default: Checklist }}
    <Checklist />
  {/await}
{/if}
