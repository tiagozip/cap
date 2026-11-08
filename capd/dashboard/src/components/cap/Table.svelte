<script>
import { Table } from "../ui/index.js";

let { flush = false, class: className = "", children, ...rest } = $props();
</script>

<Table
  containerClass="rounded-none border-0 {flush ? 'cap-flush' : ''} {className}"
  {...rest}
>
  {@render children()}
</Table>
