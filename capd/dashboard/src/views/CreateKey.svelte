<script>
import { tick } from "svelte";
import {
  Button,
  Dialog,
  Field,
  Input,
  Segmented,
  Switch,
} from "../components/cap/index.js";
import Splash from "../components/cap/Splash.svelte";
import SuccessMark from "../components/cap/SuccessMark.svelte";
import {
  CopyButton,
  CopyCheck,
  createReceipt,
} from "../components/ui/index.js";
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

const LAND = 520;
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
    at: performance.now(),
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

{#snippet trace()}<Splash land={LAND} origin={created?.at} />{/snippet}

<Dialog
  title={created ? "Your site key is ready" : "Create site key"}
  description={created ? "Your server uses the secret key to check tokens." : "Each key has its own settings and analytics."}
  bare={!!created}
  guard={!!created}
  overlay={created ? trace : undefined}
  onclose={close}
>
  {#if created}
    <div class="flex flex-col items-center text-center">
      <SuccessMark class="-mx-7 w-[calc(100%+3.5rem)]!" height={176} delay={LAND} origin={created.at} />
      <h2 class="ck-in -mt-2 text-lg font-semibold text-balance" style:--d="{LAND + 40}ms">Your site key is ready</h2>
      <p class="ck-in mt-1 max-w-full truncate text-sm text-muted-foreground" style:--d="{LAND + 110}ms" title="{created.name}, {created.summary}">
        <span class="font-medium text-foreground">{created.name}</span>, {created.summary.charAt(0).toLowerCase()}{created.summary.slice(1)}
      </p>
    </div>
    <div class="ck-in mt-2" style:--d="{LAND + 180}ms">
      <dl class="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {#each [["Site key", created.siteKey, created.siteKey], ["Secret key", created.secretKey, `${created.secretKey.slice(0, 9)}${"•".repeat(12)}`]] as [label, value, shown] (label)}
          <div class="flex min-w-0 items-center gap-3 py-1.5 ps-3.5 pe-1.5">
            <dt class="w-20 shrink-0 text-sm text-muted-foreground">{label}</dt>
            <dd class="flex min-w-0 flex-1 items-center gap-1">
              <code class="min-w-0 flex-1 truncate font-mono text-[13px]" aria-label={shown === value ? undefined : `${label}, hidden`}>{shown}</code>
              <CopyButton text={value} label="Copy {label.toLowerCase()}" />
            </dd>
          </div>
        {/each}
      </dl>
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
      <Button class="ck-in" style="--d: {LAND + 240}ms" onclick={copyEnv}>
        <CopyCheck copied={envCopy.copied} size={15} />
        Copy as .env
        <span class="sr-only" role="status">{envCopy.copied ? "Copied" : ""}</span>
      </Button>
      <Button class="ck-in" style="--d: {LAND + 290}ms" variant="primary" bind:ref={setUpButton} onclick={setUp}>Set up the widget</Button>
    {:else}
      <Button variant="ghost" onclick={close}>Cancel</Button>
      <Button variant="primary" type="submit" form="createKeyForm" disabled={submitting}>
        {submitting ? "Creating site key" : "Create site key"}
      </Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(.ck-in) {
      animation: ck-in 460ms cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0ms) both;
    }
  }

  @keyframes ck-in {
    from {
      opacity: 0;
      filter: blur(4px);
      translate: 0 4px;
    }
  }
</style>
