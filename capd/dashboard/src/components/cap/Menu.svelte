<script>
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/index.js";

let {
  trigger,
  align = "end",
  side = "bottom",
  width = "w-56",
  open = $bindable(false),
  children,
} = $props();
</script>

<DropdownMenu bind:open>
  <DropdownMenuTrigger>
    {#snippet child({ props })}{@render trigger(props)}{/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent {align} {side} class="z-[95] min-w-0 {width}">
    {@render children()}
  </DropdownMenuContent>
</DropdownMenu>
