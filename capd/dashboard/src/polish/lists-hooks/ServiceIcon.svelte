<script>
import Icon from "../../components/Icon.svelte";
import { SERVICE_ICONS } from "./serviceIcons.js";

let { service = "generic", size = 20, class: className = "" } = $props();

const uid = $props.id();
const icon = $derived(SERVICE_ICONS[service]);
const body = $derived(
  icon?.body.replace(/(id="|#)(SVG[A-Za-z0-9]+)/g, `$1$2-${uid}`),
);
</script>

{#if icon}
  <svg
    class="shrink-0 {className}"
    viewBox={icon.viewBox}
    width={size}
    height={size}
    aria-hidden="true"
  >
    {@html body}
  </svg>
{:else}
  <Icon name="link" {size} class="shrink-0 text-muted-foreground {className}" />
{/if}
