<script>
import { Icon, Tag } from "../../components/cap/index.js";
import { OUTCOMES } from "../../lib/catalog.svelte.js";

let { outcome, label, flagged = false } = $props();

const TONES = {
  pass: "success",
  fail: "neutral",
  block: "danger",
  limit: "outline",
};
const info = $derived(OUTCOMES[outcome]);
</script>

{#if flagged}
  <Tag tone="warning"><Icon name="flag" size={12} stroke={2.25} />{label ?? "Flagged"}</Tag>
{:else}
  <Tag tone={TONES[outcome] ?? "neutral"}>
    {#if info}<Icon name={info.icon} size={12} stroke={2.5} />{/if}
    {label ?? info?.label ?? outcome}
  </Tag>
{/if}
