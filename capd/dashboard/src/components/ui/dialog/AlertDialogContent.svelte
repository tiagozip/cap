<script>
import DialogContent from "./DialogContent.svelte";

let {
  ref = $bindable(null),
  showCloseButton = false,
  children,
  ...rest
} = $props();
</script>

<DialogContent bind:ref role="alertdialog" data-slot="alert-dialog-content" {showCloseButton} {...rest}>
  {@render children?.()}
</DialogContent>
