<script>
import { Tooltip } from "bits-ui";

let {
  open = $bindable(false),
  delayDuration = 0,
  children,
  ...rest
} = $props();
</script>

<Tooltip.Provider {delayDuration}>
  <Tooltip.Root bind:open {...rest}>
    {@render children?.()}
  </Tooltip.Root>
</Tooltip.Provider>
