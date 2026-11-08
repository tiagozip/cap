<script>
const { height, width, radius = "4px", class: className = "" } = $props();
</script>

<span
  class="sk-bone {className}"
  aria-hidden="true"
  style:height
  style:width
  style:border-radius={radius}
></span>
