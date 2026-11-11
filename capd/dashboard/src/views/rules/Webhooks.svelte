<script>
import {
  Button,
  Checkbox,
  CopyText,
  Dialog,
  Empty,
  Field,
  Group,
  Icon,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Switch,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { catalog } from "../../lib/catalog.svelte.js";
import { ago } from "../../lib/format.js";
import { t, tx } from "../../lib/i18n.svelte.js";
import { confirm, toast } from "../../lib/ui.svelte.js";
import { TRIGGER_LABELS } from "./rules.js";

let { siteKey, hooks = $bindable([]), onchange } = $props();

let adding = $state(null);
let secret = $state(null);
let log = $state(null);
let last = $state({});

$effect(() => {
  const ids = hooks.map((h) => h.id);
  let stale = false;
  Promise.all(
    ids.map((id) =>
      api("GET", `/keys/${siteKey}/webhooks/${id}/deliveries`).then((l) => [
        id,
        Array.isArray(l) ? (l[0] ?? null) : undefined,
      ]),
    ),
  ).then((pairs) => {
    if (!stale) last = Object.fromEntries(pairs);
  });
  return () => {
    stale = true;
  };
});

const title = (h) => h.name || h.url;

const startAdd = () => {
  adding = { url: "", name: "", triggers: ["block"], error: "", busy: false };
};

const toggleTrigger = (trig, on) => {
  adding.triggers = on
    ? [...adding.triggers, trig]
    : adding.triggers.filter((x) => x !== trig);
};

async function add() {
  adding.busy = true;
  adding.error = "";
  const res = await api("POST", `/keys/${siteKey}/webhooks`, {
    url: adding.url.trim(),
    name: adding.name.trim(),
    triggers: adding.triggers,
  });
  adding.busy = false;
  if (!res.success) {
    adding.error = res.error || "Couldn't add this webhook";
    return;
  }
  adding = null;
  secret = { value: res.secret, rotated: false };
  if (res.webhook) hooks = [...hooks, res.webhook];
  else onchange();
}

async function toggle(h, enabled) {
  const res = await api("PUT", `/keys/${siteKey}/webhooks/${h.id}`, {
    enabled,
  });
  if (!res.success) {
    toast(t(res.error || "Couldn't update the webhook"), "error");
    onchange();
    return;
  }
  h.enabled = enabled;
}

async function test(h) {
  const r = await api("POST", `/keys/${siteKey}/webhooks/${h.id}/test`);
  toast(
    r.ok
      ? t("Test delivered, your server answered {status}", {
          status: r.status,
        })
      : t("Test failed: {error}", {
          error: t(r.error || `HTTP ${r.status}`),
        }),
    r.ok ? "ok" : "error",
  );
  const l = await api("GET", `/keys/${siteKey}/webhooks/${h.id}/deliveries`);
  if (Array.isArray(l)) last = { ...last, [h.id]: l[0] ?? null };
}

async function showLog(h) {
  const l = await api("GET", `/keys/${siteKey}/webhooks/${h.id}/deliveries`);
  log = { hook: h, rows: Array.isArray(l) ? l : [] };
}

async function rotate(h) {
  const ok = await confirm({
    title: t("Rotate the signing secret?"),
    message: t(
      "Cap signs with a new secret from now on, so update your server right after. The delivery history for this webhook is cleared.",
    ),
    confirmText: t("Rotate secret"),
    danger: true,
  });
  if (!ok) return;
  const res = await api("POST", `/keys/${siteKey}/webhooks`, {
    url: h.url,
    name: h.name,
    triggers: h.triggers,
    enabled: h.enabled,
  });
  if (!res.success) {
    toast(t(res.error || "Couldn't rotate the secret"), "error");
    return;
  }
  await api("DELETE", `/keys/${siteKey}/webhooks/${h.id}`);
  hooks = hooks.map((x) => (x.id === h.id ? (res.webhook ?? x) : x));
  secret = { value: res.secret, rotated: true };
  if (!res.webhook) onchange();
}

async function remove(h) {
  const ok = await confirm({
    title: t("Delete this webhook?"),
    message: t("Cap stops sending events to this endpoint."),
    confirmText: t("Delete webhook"),
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", `/keys/${siteKey}/webhooks/${h.id}`);
  if (!res.success) {
    toast(t(res.error || "Couldn't delete the webhook"), "error");
    return;
  }
  hooks = hooks.filter((x) => x.id !== h.id);
}
</script>

{#snippet addButton()}
  <Button size="sm" class="pl-2" onclick={startAdd}>
    <Icon name="plus" size={14} />
    {t("Add webhook")}
  </Button>
{/snippet}

<Group
  id="webhooks"
  title={t("Webhooks")}
  flush
>
  {#snippet action()}{@render addButton()}{/snippet}

{#if !hooks.length}
  <Empty title={t("No webhooks yet")}>{t("Add one to hear about blocks and AI agents as they happen.")}</Empty>
{:else}
  <Table flush>
    <TableHeader>
      <TableRow>
        <TableHead>{t("Endpoint")}</TableHead>
        <TableHead class="max-md:hidden">{t("Sends")}</TableHead>
        <TableHead class="w-px whitespace-nowrap max-sm:hidden">{t("Last delivery")}</TableHead>
        <TableHead class="w-px"><span class="sr-only">{tx("rule", "On")}</span></TableHead>
        <TableHead class="w-px"><span class="sr-only">{t("Actions")}</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each hooks as h (h.id)}
        {@const d = last[h.id]}
        <TableRow class={h.enabled ? "" : "[&>td:not(:nth-last-child(-n+2))]:opacity-55"}>
          <TableCell class="w-full max-w-0 py-2.5!">
            <span class="flex min-w-0 flex-col gap-0.5">
              {#if h.name}<span class="truncate font-medium">{h.name}</span>{/if}
              <span class="truncate font-mono text-xs {h.name ? 'text-muted-foreground' : ''}" title={h.url}>{h.url}</span>
              <span class="mt-1 flex flex-wrap gap-1 md:hidden">
                {#each h.triggers as trig (trig)}
                  <Tag>{TRIGGER_LABELS[trig] ?? trig}</Tag>
                {/each}
              </span>
            </span>
          </TableCell>
          <TableCell class="py-2.5! max-md:hidden">
            <span class="flex gap-1">
              {#each h.triggers as trig (trig)}
                <Tag>{TRIGGER_LABELS[trig] ?? trig}</Tag>
              {/each}
            </span>
          </TableCell>
          <TableCell class="whitespace-nowrap max-sm:hidden">
            {#if d}
              <button
                type="button"
                class="flex cursor-pointer flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:[&>span:first-child]:underline"
                onclick={() => showLog(h)}
              >
                <span class="font-medium {d.ok ? 'text-success' : 'text-destructive'}">{d.ok ? t("Delivered, {status}", { status: d.status }) : d.error ? t(d.error) : t("Failed, {status}", { status: d.status })}</span>
                <span class="text-xs text-muted-foreground tabular-nums">{ago(d.at)}</span>
              </button>
            {:else if d === null}
              <span class="text-muted-foreground">{t("Nothing sent yet")}</span>
            {:else}
              <span class="text-faint-foreground">{t("Unknown")}</span>
            {/if}
          </TableCell>
          <TableCell>
            <Switch checked={h.enabled} label={t("Send events to {name}", { name: title(h) })} onchange={(v) => toggle(h, v)} />
          </TableCell>
          <TableCell>
            <Menu width="w-48">
              {#snippet trigger(props)}
                <Button {...props} variant="ghost" size="sm" icon aria-label={t("More for {name}", { name: title(h) })}>
                  <Icon name="more" size={16} stroke={3} />
                </Button>
              {/snippet}
              <MenuItem icon="share" onselect={() => test(h)}>{t("Send test")}</MenuItem>
              <MenuItem icon="events" onselect={() => showLog(h)}>{t("Show deliveries")}</MenuItem>
              <MenuItem icon="refresh" onselect={() => rotate(h)}>{t("Rotate secret")}</MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onselect={() => remove(h)}>{t("Delete")}</MenuItem>
            </Menu>
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{/if}
</Group>

{#if adding}
  <Dialog title={t("Add webhook")} onclose={() => (adding = null)}>
    <form
      id="hookForm"
      class="flex flex-col gap-5"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Field label={t("Endpoint URL")} for="hookUrl">
        <Input type="url" id="hookUrl" inputmode="url" placeholder="https://example.com/hooks/cap" bind:value={adding.url} />
      </Field>
      <Field label={t("Name")} for="hookName" optional help={t("Shown here instead of the URL.")}>
        <Input id="hookName" maxlength={60} bind:value={adding.name} />
      </Field>
      <fieldset class="flex flex-col gap-2.5">
        <legend class="pb-2.5 text-sm font-medium">{t("Send when")}</legend>
        {#each catalog.webhookTriggers as trig (trig)}
          <div class="flex items-center gap-2.5">
            <Checkbox id="hookTrigger-{trig}" checked={adding.triggers.includes(trig)} onchange={(v) => toggleTrigger(trig, v)} />
            <label for="hookTrigger-{trig}" class="cursor-pointer text-sm">{TRIGGER_LABELS[trig] ?? trig}</label>
          </div>
        {/each}
      </fieldset>
      {#if adding.error}
        <p class="text-sm text-destructive" role="alert">{t(adding.error)}</p>
      {/if}
    </form>
    {#snippet footer()}
      <Button onclick={() => (adding = null)}>{t("Cancel")}</Button>
      <Button variant="primary" type="submit" form="hookForm" disabled={adding.busy}>{t("Add webhook")}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if secret}
  <Dialog
    title={secret.rotated ? t("New signing secret") : t("Webhook added")}
    description={t("Copy the signing secret now. Cap only shows it once.")}
    onclose={() => (secret = null)}
  >
    <Field label={t("Signing secret")}>
      <CopyText value={secret.value} label={t("Copy secret")} />
    </Field>
    <p class="text-sm text-pretty text-muted-foreground">
      {t("Every request has a")} <code class="font-mono text-sm text-foreground">cap-signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> {t("header. The")} <code class="font-mono text-sm text-foreground">v1</code> {t("part is an HMAC-SHA256 of")} <code class="font-mono text-sm text-foreground">t.body</code> {t("with this secret, so your server can check the request came from Cap.")}
    </p>
    {#snippet footer()}
      <Button variant="primary" onclick={() => (secret = null)}>{t("Done")}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if log}
  <Dialog title={t("Recent deliveries")} description={title(log.hook)} size="md" onclose={() => (log = null)}>
    {#if log.rows.length}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tx("log", "When")}</TableHead>
            <TableHead>{t("Result")}</TableHead>
            <TableHead>{t("Took")}</TableHead>
            <TableHead>{t("Attempt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each log.rows as d, i (i)}
            <TableRow>
              <TableCell class="whitespace-nowrap tabular-nums">{ago(d.at)}</TableCell>
              <TableCell class="font-medium {d.ok ? 'text-success' : 'text-destructive'}">{d.ok ? t("Delivered, {status}", { status: d.status }) : t(d.error || `HTTP ${d.status}`)}</TableCell>
              <TableCell class="tabular-nums">{d.ms} ms</TableCell>
              <TableCell class="tabular-nums">{d.attempt + 1}</TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    {:else}
      <Empty class="py-2" title={t("Nothing sent yet")}>
        {t("Send a test to check that your server answers.")}
        {#snippet action()}
          <Button size="sm" onclick={() => test(log.hook)}>{t("Send test")}</Button>
        {/snippet}
      </Empty>
    {/if}
  </Dialog>
{/if}
