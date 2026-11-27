<script>
import { Tooltip } from "bits-ui";
import {
  tooltipOpened,
  warmth,
} from "../../../polish/overlays/warmth.svelte.js";

let {
  open = $bindable(false),
  delayDuration,
  onOpenChange,
  children,
  ...rest
} = $props();
</script>

<Tooltip.Provider delayDuration={delayDuration ?? (warmth.on ? 0 : 320)}>
  <Tooltip.Root
    bind:open
    onOpenChange={(v) => {
      tooltipOpened(v);
      onOpenChange?.(v);
    }}
    {...rest}
  >
    {@render children?.()}
  </Tooltip.Root>
</Tooltip.Provider>
