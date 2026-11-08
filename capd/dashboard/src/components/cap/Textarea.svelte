<script>
import { Textarea } from "../ui/textarea/index.js";

let {
  value = $bindable(),
  invalid = false,
  mono = false,
  class: className = "",
  ...rest
} = $props();
</script>

<Textarea bind:value aria-invalid={invalid || undefined} class="min-h-24 px-3 {mono ? 'font-mono' : ''} {className}" {...rest} />
