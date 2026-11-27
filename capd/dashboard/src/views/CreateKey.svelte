<script>
import { tick } from "svelte";
import {
  Button,
  CopyText,
  Dialog,
  Field,
  Icon,
  Input,
  Segmented,
  Switch,
} from "../components/cap/index.js";
import { CopyCheck, createReceipt } from "../components/ui/index.js";
import { api } from "../lib/api.js";
import { app, loadKeys, navigate } from "../lib/state.svelte.js";
import OriginList from "./config/OriginList.svelte";
import { normalizeOrigin } from "./config/origins.js";
import { PRESETS } from "./config/presets.js";
import { secret } from "./config/secret.svelte.js";

let name = $state("");
let level = $state("balanced");
let corsOn = $state(false);
let origins = $state([]);
let originBad = $state({});
let error = $state("");
let nameInvalid = $state(false);
let submitting = $state(false);
let created = $state(null);
let setUpButton = $state(null);

const envCopy = createReceipt(2000);
const copyEnv = async () => {
  try {
    await navigator.clipboard.writeText(
      `CAP_SITE_KEY=${created.siteKey}\nCAP_SECRET=${created.secretKey}\n`,
    );
  } catch {
    return;
  }
  envCopy.mark();
};

const preset = $derived(PRESETS.find((p) => p.id === level));
const suggested = $derived.by(() => {
  const first = corsOn && origins.map(normalizeOrigin).find(Boolean);
  if (!first) return "";
  try {
    return new URL(first.replace("://*.", "://")).host;
  } catch {
    return "";
  }
});

const close = () => {
  app.createKeyOpen = false;
  if (created) navigate({ view: "key", siteKey: created.siteKey });
};

const setUp = () => {
  const { siteKey } = created;
  created = null;
  app.createKeyOpen = false;
  navigate({ view: "key", siteKey });
};

async function submit() {
  error = "";
  nameInvalid = false;
  const finalName = name.trim() || suggested;
  if (!finalName) {
    error = "Give this key a name so you can find it later.";
    nameInvalid = true;
    document.getElementById("newKeyName")?.focus();
    return;
  }
  const badIndex = corsOn
    ? origins.findIndex((o) => o.trim() && !normalizeOrigin(o))
    : -1;
  const list = corsOn
    ? [...new Set(origins.map(normalizeOrigin).filter(Boolean))]
    : [];
  if (corsOn && (badIndex >= 0 || !list.length)) {
    error =
      "Enter a valid website, such as https://example.com or *.example.com.";
    originBad = { [Math.max(badIndex, 0)]: true };
    document.getElementById(`newKeyOrigin-${Math.max(badIndex, 0)}`)?.focus();
    return;
  }
  submitting = true;
  const res = await api("POST", "/keys", {
    name: finalName,
    ...preset.config,
    ...(list.length && { corsOrigins: list }),
  });
  submitting = false;
  if (!res?.siteKey || !res?.secretKey) {
    error = res?.error || "Couldn't create the key. Try again.";
    return;
  }
  const hosts = list.map((o) => {
    try {
      return new URL(o).host;
    } catch {
      return o;
    }
  });
  created = {
    ...res,
    name: finalName,
    summary: hosts.length
      ? `${preset.name} protection, ${hosts.length === 1 ? hosts[0] : `${hosts.length} websites`} only`
      : `${preset.name} protection`,
  };
  secret.entry = {
    siteKey: res.siteKey,
    value: res.secretKey,
    error: "",
    revealed: false,
    busy: false,
  };
  await tick();
  setUpButton?.focus();
  await loadKeys();
}
</script>

<Dialog
  title={created ? "Your site key is ready" : "Create site key"}
  description={created ? "Your server uses the secret key to check tokens." : "One key per website."}
  onclose={close}
>
  {#if created}
    <div class="flex items-center gap-3">
      <span class="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <Icon name="check" size={18} />
      </span>
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-sm font-medium" title={created.name}>{created.name}</span>
        <span class="truncate text-xs text-muted-foreground">{created.summary}</span>
      </div>
    </div>
    <div>
      <Field label="Site key">
        <CopyText value={created.siteKey} label="Copy site key" />
      </Field>
    </div>
    <div>
      <Field label="Secret key">
        <CopyText value={created.secretKey} label="Copy secret key" />
      </Field>
    </div>
  {:else}
    <form
      id="createKeyForm"
      class="flex flex-col gap-4"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Name" for="newKeyName">
        <Input
          id="newKeyName"
          type="text"
          maxlength="600"
          autocomplete="off"
          placeholder={suggested || "My website"}
          invalid={nameInvalid}
          aria-describedby="newKeyError"
          bind:value={name}
          oninput={() => {
            nameInvalid = false;
            error = "";
          }}
        />
      </Field>

      <div class="flex flex-col gap-1.5">
        <p class="text-sm font-medium">Protection level</p>
        <Segmented
          label="Protection level"
          class="w-full"
          bind:value={level}
          options={PRESETS.map((p) => [p.id, p.name])}
        />
        <div class="grid">
          {#key preset.id}
            <p class="col-start-1 row-start-1 text-xs text-pretty text-muted-foreground">{preset.text}</p>
          {/key}
        </div>
      </div>

      <div class="flex flex-col gap-3 border-t border-border pt-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5">
            <label for="newKeyCorsEnabled" class="text-sm font-medium">Only allow my websites</label>
            <p class="text-xs text-pretty text-muted-foreground">Other sites can't load puzzles with this key.</p>
          </div>
          <Switch id="newKeyCorsEnabled" bind:checked={corsOn} />
        </div>
        {#if corsOn}
          <div>
            <OriginList id="newKeyOrigin" bind:values={origins} bind:bad={originBad} describedby="newKeyError" />
          </div>
        {/if}
      </div>

      {#if error}
        <p id="newKeyError" class="text-sm text-destructive" role="alert">{error}</p>
      {/if}
    </form>
  {/if}
  {#snippet footer()}
    {#if created}
      <Button onclick={copyEnv}>
        <CopyCheck copied={envCopy.copied} size={15} />
        Copy as .env
        <span class="sr-only" role="status">{envCopy.copied ? "Copied" : ""}</span>
      </Button>
      <Button variant="primary" bind:ref={setUpButton} onclick={setUp}>Set up the widget</Button>
    {:else}
      <Button variant="ghost" onclick={close}>Cancel</Button>
      <Button variant="primary" type="submit" form="createKeyForm" disabled={submitting}>
        {submitting ? "Creating site key" : "Create site key"}
      </Button>
    {/if}
  {/snippet}
</Dialog>
