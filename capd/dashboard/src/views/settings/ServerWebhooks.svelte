<script>
import { api } from "../../lib/api.js";
import { loadCatalog } from "../../lib/catalog.svelte.js";
import Webhooks from "../rules/Webhooks.svelte";

let hooks = $state(null);

const load = () =>
  api("GET", "/settings/webhooks").then((h) => {
    hooks = Array.isArray(h) ? h : [];
  });
loadCatalog().then(load);
</script>

{#if hooks}
  <Webhooks scope="instance" bind:hooks onchange={load} />
{/if}
