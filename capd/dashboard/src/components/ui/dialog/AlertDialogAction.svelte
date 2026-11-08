<script>
import Button from "../button/Button.svelte";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Button bind:ref data-slot="alert-dialog-action" {...rest}>
  {@render children?.()}
</Button>
