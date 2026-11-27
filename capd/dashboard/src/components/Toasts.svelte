<script>
import { ui } from "../lib/ui.svelte.js";
import { Button, Dialog } from "./cap/index.js";
import { Toaster } from "./ui/index.js";

let held = $state(null);

$effect(() => {
  if (ui.confirm) held = ui.confirm;
});

const answer = (c, value) => {
  if (ui.confirm === c) c.resolve(value);
};
</script>

<Toaster position="bottom-end" />

{#if held}
  {@const c = held}
  {#key c}
    <Dialog open={ui.confirm === c} title={c.title} description={c.message} onclose={() => answer(c, false)}>
      {#snippet footer()}
        <Button onclick={() => answer(c, false)}>Cancel</Button>
        <Button variant={c.danger ? "danger" : "primary"} onclick={() => answer(c, true)}>{c.confirmText}</Button>
      {/snippet}
    </Dialog>
  {/key}
{/if}
