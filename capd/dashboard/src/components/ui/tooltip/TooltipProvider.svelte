<script>
import { Tooltip } from "bits-ui";

let { delayDuration = 0, children, ...rest } = $props();
</script>

<Tooltip.Provider {delayDuration} {...rest}>
  {@render children?.()}
</Tooltip.Provider>
