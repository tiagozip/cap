<script>
import {
  Button,
  CopyText,
  Dialog,
  Group,
  Row,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { app, loadKeys, navigate } from "../../lib/state.svelte.js";
import { confirm, toast } from "../../lib/ui.svelte.js";
import { setSecret } from "./secret.svelte.js";

let secret = $state(null);
let showSecret = $state(false);
let busy = $state("");

async function rotate() {
  const ok = await confirm({
    title: "Reset the secret key?",
    message:
      "Your server stops verifying tokens until you replace the old secret with the new one.",
    confirmText: "Reset secret key",
    danger: true,
  });
  if (!ok) return;
  busy = "rotate";
  const res = await api("POST", `/keys/${app.key.siteKey}/rotate-secret`);
  busy = "";
  if (!res?.secretKey) {
    toast(res?.error || "Couldn't reset the secret key", "error");
    return;
  }
  secret = res.secretKey;
  setSecret(res.secretKey);
  app.key.secretOutdated = false;
  const listed = app.keys.find((k) => k.siteKey === app.key.siteKey);
  if (listed) listed.secretOutdated = false;
  showSecret = true;
}

async function remove() {
  const ok = await confirm({
    title: `Delete ${app.key?.name}?`,
    message:
      "This deletes the key with its stats, rules, lists and share links. Sites using it stop working. You can't undo this.",
    confirmText: "Delete key",
    danger: true,
  });
  if (!ok) return;
  busy = "delete";
  const res = await api("DELETE", `/keys/${app.key.siteKey}`);
  busy = "";
  if (!res?.success) {
    toast(res?.error || "Couldn't delete the key", "error");
    return;
  }
  toast("Key deleted");
  await loadKeys();
  navigate({ view: "home" });
  app.key = null;
}
</script>

<Group id="cfgDanger" title="Danger zone">
  <Row
    label="Reset secret key"
    help={app.key?.secretOutdated
      ? "This key's secret is from an older Cap release, and /siteverify rejects it. Reset it and give your server the new one."
      : "Use this if the secret leaked or you lost it. Your server stops verifying tokens until you give it the new key."}
  >
    <Button size="sm" class="self-start text-destructive md:self-auto" disabled={!!busy} onclick={rotate}>
      {busy === "rotate" ? "Resetting" : "Reset secret key"}
    </Button>
  </Row>
  <Row label="Delete key" help="Deletes its stats, rules, lists and share links. Sites using it stop working.">
    <Button size="sm" class="self-start text-destructive md:self-auto" disabled={!!busy} onclick={remove}>
      {busy === "delete" ? "Deleting" : "Delete key"}
    </Button>
  </Row>
</Group>

<Dialog
  bind:open={showSecret}
  title="New secret key"
  description="Put it on your server in place of the old one. You can reveal it again under Add Cap to your site."
>
  <CopyText value={secret ?? ""} label="Copy secret key" />
  {#snippet footer()}
    <Button variant="primary" onclick={() => (showSecret = false)}>Done</Button>
  {/snippet}
</Dialog>
