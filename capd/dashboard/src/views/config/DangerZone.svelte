<script>
import {
  Button,
  CopyButton,
  Dialog,
  Group,
  Input,
  Row,
  Spinner,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { app, loadKeys, navigate } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import RevealedValue from "../../polish/config-misc/RevealedValue.svelte";
import { setSecret } from "./secret.svelte.js";

let rotating = $state(false);
let step = $state("confirm");
let secret = $state("");

let deleting = $state(false);
let typed = $state("");
let busy = $state(false);

const keyName = $derived(app.key?.name ?? "");
const matches = $derived(typed.trim() === keyName.trim());

const openRotate = () => {
  step = "confirm";
  secret = "";
  rotating = true;
};

async function rotate() {
  if (step !== "confirm") return;
  step = "busy";
  const res = await api("POST", `/keys/${app.key.siteKey}/rotate-secret`);
  if (!res?.secretKey) {
    step = "confirm";
    toast(res?.error || "Couldn't reset the secret key", "error");
    return;
  }
  secret = res.secretKey;
  setSecret(res.secretKey);
  app.key.secretOutdated = false;
  const listed = app.keys.find((k) => k.siteKey === app.key.siteKey);
  if (listed) listed.secretOutdated = false;
  step = "done";
}

async function remove() {
  if (!matches || busy) return;
  busy = true;
  const res = await api("DELETE", `/keys/${app.key.siteKey}`);
  busy = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't delete the key", "error");
    return;
  }
  deleting = false;
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
      ? "This secret is from an older Cap release and /siteverify rejects it."
      : "Your server can't verify tokens until it has the new one."}
  >
    <Button
      size="sm"
      variant={app.key?.secretOutdated ? "danger" : "secondary"}
      class="self-start md:self-auto {app.key?.secretOutdated ? '' : 'text-destructive'}"
      onclick={openRotate}
    >
      Reset secret key
    </Button>
  </Row>
  <Row label="Delete key">
    <Button
      size="sm"
      class="self-start text-destructive md:self-auto"
      onclick={() => {
        typed = "";
        deleting = true;
      }}
    >
      Delete key
    </Button>
  </Row>
</Group>

<Dialog
  bind:open={rotating}
  title={step === "done" ? "New secret key" : "Reset the secret key?"}
  description={step === "done"
    ? "The old secret stopped working. Put this one on your server."
    : "The current secret stops working right away, so /siteverify fails until your server has the new one."}
>
  {#if step === "done"}
    <div class="flex flex-col gap-3">
      <RevealedValue value={secret} label="Copy secret key" />
      <div class="ks-swap flex items-center justify-between gap-3 rounded-[10px] border border-border py-1 ps-3 pe-1">
        <code class="min-w-0 truncate font-mono text-sm text-muted-foreground">CAP_SECRET={secret.slice(0, 6)}…</code>
        <CopyButton text={`CAP_SECRET=${secret}`} label="Copy as .env line" copiedLabel=".env line copied" />
      </div>
    </div>
  {:else}
    <ul class="flex flex-col gap-2 text-sm text-pretty text-muted-foreground">
      <li class="flex gap-2.5"><span class="ks-step">1</span>Reset, then copy the new secret.</li>
      <li class="flex gap-2.5"><span class="ks-step">2</span>Replace CAP_SECRET on your server and redeploy.</li>
    </ul>
  {/if}
  {#snippet footer()}
    {#if step === "done"}
      <Button variant="primary" onclick={() => (rotating = false)}>Done</Button>
    {:else}
      <Button disabled={step === "busy"} onclick={() => (rotating = false)}>Cancel</Button>
      <Button variant="danger" aria-busy={step === "busy"} onclick={rotate}>
        {#if step === "busy"}<Spinner class="size-3.5" label="Resetting" />{/if}
        Reset secret key
      </Button>
    {/if}
  {/snippet}
</Dialog>

<Dialog
  bind:open={deleting}
  title="Delete {keyName}?"
  description="This deletes the key with its stats, rules, lists and share links. Sites using it stop working. You can't undo this."
>
  <form
    class="flex flex-col gap-1.5"
    onsubmit={(e) => {
      e.preventDefault();
      remove();
    }}
  >
    <label for="ksDeleteName" class="text-sm">Type <span class="font-medium select-all">{keyName}</span> to confirm</label>
    <Input id="ksDeleteName" autocomplete="off" spellcheck="false" bind:value={typed} />
  </form>
  {#snippet footer()}
    <Button disabled={busy} onclick={() => (deleting = false)}>Cancel</Button>
    <Button variant="danger" disabled={!matches} aria-busy={busy} onclick={remove}>
      {#if busy}<Spinner class="size-3.5" label="Deleting" />{/if}
      Delete key
    </Button>
  {/snippet}
</Dialog>

<style>
  .ks-step {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 999px;
    background: var(--muted);
    color: var(--foreground);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }


</style>
