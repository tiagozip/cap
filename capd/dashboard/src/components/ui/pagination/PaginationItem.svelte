<script>
let { children, ...rest } = $props();
</script>

<li data-slot="pagination-item" {...rest}>
  {@render children?.()}
</li>
