<script>
import { tick } from "svelte";
import {
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Segmented,
  Switch,
  Tag,
} from "../../components/cap/index.js";
import { CopyCheck } from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { app } from "../../lib/state.svelte.js";

let { onclose } = $props();

let open = $state(true);
let name = $state("");
let access = $state("all");
let siteKeys = $state([]);
let readonly = $state(false);
let error = $state("");
let invalid = $state("");
let busy = $state(false);
let created = $state(null);
let copied = $state(false);
let copyButton = $state(null);

const copyOrClose = async () => {
  if (copied) {
    onclose();
    return;
  }
  try {
    await navigator.clipboard.writeText(created);
    copied = true;
  } catch {
    const node = document.getElementById("apikey-value");
    if (node) getSelection()?.selectAllChildren(node);
  }
};

const submit = async (e) => {
  e.preventDefault();
  error = "";
  invalid = "";
  if (!name.trim()) {
    error = "Give this API key a name so you can recognize it later.";
    invalid = "name";
    document.getElementById("apikey-name")?.focus();
    return;
  }
  if (access === "scoped" && !siteKeys.length) {
    error = "Pick at least one site key, or allow all site keys.";
    invalid = "scope";
    return;
  }
  busy = true;
  const res = await api("POST", "/settings/apikeys", {
    name: name.trim(),
    siteKeys: access === "scoped" ? siteKeys : undefined,
    readonly: readonly || undefined,
  });
  busy = false;
  if (!res?.apiKey) {
    error = res?.error || "Couldn't create the API key. Try again.";
    return;
  }
  created = res.apiKey;
  await tick();
  copyButton?.focus();
};
</script>

<Dialog
  bind:open
  title={created ? "API key created" : "Create API key"}
  description={created ? "Copy it now. Cap won't show this key again." : "Your scripts send this key to manage Cap without signing in."}
  {onclose}
>
  {#if created}
    <div class="flex flex-col gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 truncate text-sm font-medium" title={name.trim()}>{name.trim()}</span>
        <Tag tone={readonly ? "neutral" : "warning"}>{readonly ? "Read-only" : "Full access"}</Tag>
        <Tag>{access === "scoped" ? `${siteKeys.length} site key${siteKeys.length === 1 ? "" : "s"}` : "All site keys"}</Tag>
      </div>
      <code
        id="apikey-value"
        class="block rounded-[10px] bg-muted px-3 py-2.5 font-mono text-sm leading-relaxed break-all select-all"
      >{created}</code>
      <span class="sr-only" role="status">{copied ? "API key copied" : ""}</span>
    </div>
  {:else}
    <form id="apikey-form" class="flex flex-col gap-5" onsubmit={submit} novalidate>
      <Field label="Name" for="apikey-name" error={invalid === "name" ? error : ""}>
        <Input
          id="apikey-name"
          placeholder="Deploy script"
          bind:value={name}
          invalid={invalid === "name"}
          aria-describedby={invalid === "name" ? "apikey-name-error" : undefined}
        />
      </Field>
      <div class="flex flex-col gap-2" role="group" aria-labelledby="apikey-scope-label">
        <span id="apikey-scope-label" class="text-sm font-medium">Site keys it can use</span>
        <Segmented
          label="Site keys it can use"
          class="self-start"
          bind:value={access}
          options={[
            ["all", "All site keys"],
            ["scoped", "Only some"],
          ]}
        />
        {#if access === "all"}
          <p class="text-sm text-muted-foreground">Includes keys you create later.</p>
        {/if}
        {#if access === "scoped"}
          <div
            class="mt-1 flex max-h-48 flex-col gap-0.5 overflow-y-auto"
            role="group"
            aria-label="Site keys"
            aria-describedby={invalid === "scope" ? "apikey-scope-error" : undefined}
          >
            {#each app.keys as k (k.siteKey)}
              <div class="flex h-9 items-center gap-2.5">
                <Checkbox
                  id="scope-{k.siteKey}"
                  checked={siteKeys.includes(k.siteKey)}
                  onchange={(on) => {
                    siteKeys = on ? [...siteKeys, k.siteKey] : siteKeys.filter((x) => x !== k.siteKey);
                  }}
                />
                <label for="scope-{k.siteKey}" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                  <span class="truncate">{k.name}</span>
                  <code class="ms-auto truncate font-mono text-xs text-muted-foreground" title={k.siteKey}>{k.siteKey}</code>
                </label>
              </div>
            {:else}
              <p class="text-sm text-muted-foreground">You don't have any site keys yet.</p>
            {/each}
          </div>
          {#if invalid === "scope"}
            <p id="apikey-scope-error" class="text-sm text-destructive" role="alert">{error}</p>
          {/if}
        {/if}
      </div>
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <label for="apikey-readonly" class="text-sm font-medium">Read-only</label>
          <p class="text-sm text-muted-foreground">It can read keys and stats, but can't change anything.</p>
        </div>
        <Switch id="apikey-readonly" bind:checked={readonly} />
      </div>
      {#if error && !invalid}
        <p class="text-sm text-destructive" role="alert">{error}</p>
      {/if}
    </form>
  {/if}
  {#snippet footer()}
    {#if created}
      <Button variant="primary" class="min-w-34 ps-3.5" bind:ref={copyButton} onclick={copyOrClose}>
        <CopyCheck {copied} />
        {copied ? "Done" : "Copy API key"}
      </Button>
    {:else}
      <Button onclick={onclose}>Cancel</Button>
      <Button type="submit" variant="primary" form="apikey-form" disabled={busy}>{busy ? "Creating API key" : "Create API key"}</Button>
    {/if}
  {/snippet}
</Dialog>
