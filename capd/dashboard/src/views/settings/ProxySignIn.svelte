<script>
import {
  Button,
  CopyText,
  Field,
  Input,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { toast } from "../../lib/ui.svelte.js";
import SaveBar from "../../polish/instance-settings/SaveBar.svelte";

let loaded = $state(null);
let mode = $state("off");
let header = $state("X-Cap-Proxy-Secret");
let secret = $state("");
let saving = $state(false);
let error = $state("");
let rotating = $state(false);
let confirming = $state(false);
let confirmTimer;

const load = async () => {
  const res = await api("GET", "/settings/proxy-auth");
  if (res?.error) return;
  loaded = res;
  mode = res.mode;
  header = res.header;
};
load();

const cleanHeader = $derived(header.trim() || "X-Cap-Proxy-Secret");
const dirty = $derived(
  !!loaded && (mode !== loaded.mode || cleanHeader !== loaded.header),
);

const save = async () => {
  error = "";
  saving = true;
  const res = await api("PUT", "/settings/proxy-auth", {
    mode,
    header: cleanHeader,
  });
  saving = false;
  if (!res?.success) {
    error = res?.error || "Couldn't save proxy sign-in";
    return false;
  }
  await load();
};

const rotate = async () => {
  if (loaded?.hasSecret && !confirming) {
    confirming = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      confirming = false;
    }, 5000);
    return;
  }
  clearTimeout(confirmTimer);
  confirming = false;
  rotating = true;
  const res = await api("POST", "/settings/proxy-auth/secret");
  rotating = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't generate a secret", "error");
    return;
  }
  secret = res.secret;
  await load();
};
</script>

<div class="flex flex-col divide-y divide-border">
  <Row
    label="Sign in through a proxy"
    help="Trust a secret header from a sign-in proxy like Authentik or Authelia."
  >
    <Segmented
      class="self-start md:self-auto"
      label="Proxy sign-in"
      bind:value={mode}
      options={[
        ["off", "Off"],
        ["allow", "Proxy or admin key"],
        ["require", "Proxy only"],
      ]}
    />
    {#snippet below()}
      {#if mode === "require"}
        <p class="text-sm text-pretty text-muted-foreground md:text-end">The admin key stops working on the sign-in page, and every dashboard request needs the header. API keys keep working.</p>
      {/if}
    {/snippet}
  </Row>

  <Row label="Header and secret" help="Your proxy adds this header to requests it signed in.">
    <div class="flex w-full flex-col gap-4 md:max-w-sm">
      <Field label="Header name" for="proxy-header">
        <Input id="proxy-header" mono placeholder="X-Cap-Proxy-Secret" bind:value={header} />
      </Field>
      {#key secret}
        {#if secret}
          <div class="flex flex-col gap-4">
            <Field label="Secret" for="proxy-secret" help="Copy it now. Cap only keeps a hash, so you can't see it again.">
              <CopyText value={secret} label="Copy secret" secret />
            </Field>
            <div class="flex flex-col gap-1.5">
              <p class="text-sm font-medium">Caddy example</p>
              <CopyText value={`header_up ${cleanHeader} ${secret}`} label="Copy Caddy line" secret />
            </div>
          </div>
        {/if}
      {/key}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant={confirming ? "danger" : "secondary"}
          disabled={rotating || !loaded}
          onclick={rotate}
          onblur={() => (confirming = false)}
          onkeydown={(e) => {
            if (e.key !== "Escape" || !confirming) return;
            e.preventDefault();
            confirming = false;
          }}
        >
          {rotating ? "Generating" : confirming ? "Replace now" : loaded?.hasSecret ? "Replace secret" : "Generate secret"}
        </Button>
        {#if confirming}
          <span class="text-sm text-pretty text-destructive" role="status">The old secret stops working right away.</span>
        {:else if loaded?.hasSecret}
          <span class="text-sm text-muted-foreground" role="status">
            {loaded.requestPasses ? "This page came through your proxy." : "This page didn't come with the header."}
          </span>
        {/if}
      </div>
    </div>
  </Row>
  <SaveBar
    {dirty}
    {saving}
    {error}
    label="Save proxy sign-in"
    onsave={save}
    ondiscard={() => {
      error = "";
      mode = loaded.mode;
      header = loaded.header;
    }}
  />
</div>
