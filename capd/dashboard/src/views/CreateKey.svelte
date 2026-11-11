<script>
import {
  Button,
  CopyText,
  Dialog,
  Field,
  Input,
  Segmented,
  Switch,
} from "../components/cap/index.js";
import { api } from "../lib/api.js";
import { t } from "../lib/i18n.svelte.js";
import { app, loadKeys, navigate } from "../lib/state.svelte.js";
import OriginList from "./config/OriginList.svelte";
import { normalizeOrigin } from "./config/origins.js";
import { PRESETS } from "./config/presets.js";

let name = $state("");
let level = $state("balanced");
let corsOn = $state(false);
let origins = $state([]);
let originBad = $state({});
let error = $state("");
let nameInvalid = $state(false);
let submitting = $state(false);
let created = $state(null);

const preset = $derived(PRESETS.find((p) => p.id === level));

const close = () => {
  app.createKeyOpen = false;
  if (created) navigate({ view: "key", siteKey: created.siteKey });
};

const setUp = () => {
  const { siteKey } = created;
  created = null;
  app.createKeyOpen = false;
  navigate({ view: "key", siteKey, tab: "configuration" });
};

async function submit() {
  error = "";
  nameInvalid = false;
  if (!name.trim()) {
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
    name: name.trim(),
    ...preset.config,
    ...(list.length && { corsOrigins: list }),
  });
  submitting = false;
  if (!res?.siteKey || !res?.secretKey) {
    error = res?.error || "Couldn't create the key. Try again.";
    return;
  }
  created = res;
  await loadKeys();
}
</script>

{#if created}
  <Dialog
    title={t("Your site key is ready")}
    description={t("Your server needs the secret key to check tokens. You can reveal it again from the key's settings.")}
    onclose={close}
  >
    <Field label={t("Site key")}>
      <CopyText value={created.siteKey} label={t("Copy site key")} />
    </Field>
    <Field label={t("Secret key")}>
      <CopyText value={created.secretKey} label={t("Copy secret key")} />
    </Field>
    {#snippet footer()}
      <Button variant="primary" onclick={setUp}>{t("Set up the widget")}</Button>
    {/snippet}
  </Dialog>
{:else}
  <Dialog title={t("Create site key")} description={t("One key per website. You can change all of this later.")} onclose={close}>
    <form
      id="createKeyForm"
      class="flex flex-col gap-4"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label={t("Name")} for="newKeyName">
        <Input
          id="newKeyName"
          type="text"
          maxlength="600"
          autocomplete="off"
          placeholder={t("My website")}
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
        <p class="text-sm font-medium">{t("Protection level")}</p>
        <Segmented
          label={t("Protection level")}
          class="w-full"
          bind:value={level}
          options={PRESETS.map((p) => [p.id, p.name])}
        />
        <p class="text-xs text-pretty text-muted-foreground">{preset.text}</p>
      </div>

      <div class="flex flex-col gap-3 border-t border-border pt-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col gap-0.5">
            <label for="newKeyCorsEnabled" class="text-sm font-medium">{t("Only allow my websites")}</label>
            <p class="text-xs text-pretty text-muted-foreground">{t("Other sites can't load puzzles with this key.")}</p>
          </div>
          <Switch id="newKeyCorsEnabled" bind:checked={corsOn} />
        </div>
        {#if corsOn}
          <OriginList id="newKeyOrigin" bind:values={origins} bind:bad={originBad} describedby="newKeyError" />
        {/if}
      </div>

      {#if error}
        <p id="newKeyError" class="text-sm text-destructive" role="alert">{t(error)}</p>
      {/if}
    </form>
    {#snippet footer()}
      <Button variant="ghost" onclick={close}>{t("Cancel")}</Button>
      <Button variant="primary" type="submit" form="createKeyForm" disabled={submitting}>
        {submitting ? t("Creating site key") : t("Create site key")}
      </Button>
    {/snippet}
  </Dialog>
{/if}
