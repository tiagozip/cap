<script>
import { t } from "../lib/i18n.svelte.js";
import { ui } from "../lib/ui.svelte.js";
import { Button, Dialog } from "./cap/index.js";
import { Toaster } from "./ui/index.js";
</script>

<Toaster position="bottom-end" />

{#if ui.confirm}
  {@const c = ui.confirm}
  <Dialog title={c.title} description={c.message} onclose={() => c.resolve(false)}>
    {#snippet footer()}
      <Button onclick={() => c.resolve(false)}>{t("Cancel")}</Button>
      <Button variant={c.danger ? "danger" : "primary"} onclick={() => c.resolve(true)}>{c.confirmText}</Button>
    {/snippet}
  </Dialog>
{/if}
