<script>
import {
  Button,
  Checkbox,
  CodeBlock,
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
  Spinner,
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
import { confirm, toast, undoable } from "../../lib/ui.svelte.js";
import DeliveryLog from "../../polish/lists-hooks/DeliveryLog.svelte";
import HealthStrip from "../../polish/lists-hooks/HealthStrip.svelte";
import { highlight } from "../integration/highlight.js";
import { TRIGGER_LABELS } from "./rules.js";

let { siteKey, hooks = $bindable([]), onchange } = $props();

let adding = $state(null);
let secret = $state(null);
let log = $state(null);
let history = $state({});
let testing = $state({});
let tested = $state(null);
let fresh = $state(null);
let eventView = $state(null);

async function openEvent(id) {
  const { default: Component } = await import("../events/EventDrawer.svelte");
  eventView = { Component, id, hook: log?.hook, open: true };
}

function closeEvent() {
  if (!eventView?.open) return;
  const { hook } = eventView;
  eventView.open = false;
  setTimeout(() => {
    if (!log && hook) showLog(hook);
  }, 220);
}

$effect(() => {
  const ids = hooks.map((h) => h.id);
  let stale = false;
  const refresh = () =>
    Promise.all(
      ids.map((id) =>
        api("GET", `/keys/${siteKey}/webhooks/${id}/deliveries`).then((l) => [
          id,
          Array.isArray(l) ? l : undefined,
        ]),
      ),
    ).then((pairs) => {
      if (stale) return;
      const next = Object.fromEntries(pairs);
      for (const id of ids)
        if (next[id] === undefined && history[id]) next[id] = history[id];
      history = next;
      if (log && next[log.hook.id]) log.rows = next[log.hook.id];
    });
  refresh();
  const timer = setInterval(() => {
    if (document.visibilityState === "visible" && ids.length) refresh();
  }, 30_000);
  return () => {
    stale = true;
    clearInterval(timer);
  };
});

const VERIFY = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(header, rawBody, secret) {
  const { t, v1 = "" } = Object.fromEntries(
    header.split(",").map((part) => part.split("=")),
  );
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 300) return false;
  const mac = createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  return (
    v1.length === mac.length &&
    timingSafeEqual(Buffer.from(v1), Buffer.from(mac))
  );
}
`;

const title = (h) => h.name || h.url;
const bare = (url) => url.replace(/^https?:\/\//, "");

const startAdd = () => {
  adding = {
    id: null,
    url: "",
    name: "",
    triggers: ["block"],
    error: "",
    urlError: "",
    busy: false,
  };
};

const startEdit = (h) => {
  adding = {
    id: h.id,
    url: h.url,
    name: h.name ?? "",
    triggers: [...h.triggers],
    error: "",
    urlError: "",
    busy: false,
  };
};

const urlProblem = (raw) => {
  const v = raw.trim();
  if (!v) return "Enter the URL Cap should send events to";
  let u;
  try {
    u = new URL(v);
  } catch {
    return /^[a-z][\w+.-]*:/i.test(v)
      ? "Enter a valid URL"
      : "Start the URL with https://";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return "Webhooks must use http or https";
  if (u.username || u.password)
    return "Put credentials in the webhook secret, not the URL";
  return "";
};

const toggleTrigger = (t, on) => {
  adding.triggers = on
    ? [...adding.triggers, t]
    : adding.triggers.filter((x) => x !== t);
};

async function add() {
  adding.urlError = urlProblem(adding.url);
  if (adding.urlError) {
    document.getElementById("hookUrl")?.focus();
    return;
  }
  if (!adding.triggers.length) return;
  adding.busy = true;
  adding.error = "";
  const body = {
    url: adding.url.trim(),
    name: adding.name.trim(),
    triggers: adding.triggers,
  };
  const editing = adding.id;
  const res = editing
    ? await api("PUT", `/keys/${siteKey}/webhooks/${editing}`, body)
    : await api("POST", `/keys/${siteKey}/webhooks`, body);
  adding.busy = false;
  if (!res.success) {
    adding.error =
      res.error ||
      (editing ? "Couldn't save this webhook" : "Couldn't add this webhook");
    return;
  }
  adding = null;
  if (editing) {
    hooks = hooks.map((x) =>
      x.id === editing ? (res.webhook ?? { ...x, ...body }) : x,
    );
    toast("Webhook saved");
    return;
  }
  secret = { value: res.secret, rotated: false, hook: res.webhook ?? null };
  if (res.webhook) {
    fresh = res.webhook.id;
    hooks = [...hooks, res.webhook];
  } else onchange();
}

async function toggle(h, enabled) {
  const res = await api("PUT", `/keys/${siteKey}/webhooks/${h.id}`, {
    enabled,
  });
  if (!res.success) {
    toast(res.error || "Couldn't update the webhook", "error");
    onchange();
    return;
  }
  h.enabled = enabled;
}

async function test(h) {
  if (testing[h.id]) return;
  testing = { ...testing, [h.id]: true };
  const r = await api("POST", `/keys/${siteKey}/webhooks/${h.id}/test`);
  toast(
    r.ok
      ? `Test delivered, your server answered ${r.status}`
      : `Test failed: ${r.error || `HTTP ${r.status}`}`,
    r.ok ? "ok" : "error",
  );
  const l = await api("GET", `/keys/${siteKey}/webhooks/${h.id}/deliveries`);
  if (Array.isArray(l)) {
    history = { ...history, [h.id]: l };
    if (log?.hook.id === h.id) log.rows = l;
  }
  tested = h.id;
  testing = { ...testing, [h.id]: false };
}

async function showLog(h) {
  const cached = history[h.id];
  if (cached) log = { hook: h, rows: cached };
  const l = await api("GET", `/keys/${siteKey}/webhooks/${h.id}/deliveries`);
  if (!Array.isArray(l)) {
    log ??= { hook: h, rows: [] };
    return;
  }
  history = { ...history, [h.id]: l };
  log = { hook: h, rows: l };
}

async function rotate(h) {
  const ok = await confirm({
    title: "Rotate the signing secret?",
    message:
      "Cap signs with a new secret from now on, so update your server right after. The delivery history for this webhook is cleared.",
    confirmText: "Rotate secret",
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
    toast(res.error || "Couldn't rotate the secret", "error");
    return;
  }
  await api("DELETE", `/keys/${siteKey}/webhooks/${h.id}`);
  hooks = hooks.map((x) => (x.id === h.id ? (res.webhook ?? x) : x));
  secret = { value: res.secret, rotated: true, hook: res.webhook ?? null };
  if (!res.webhook) onchange();
}

function remove(h) {
  const at = hooks.indexOf(h);
  hooks = hooks.filter((x) => x.id !== h.id);
  undoable({
    message: "Webhook deleted",
    commit: async () => {
      const res = await api("DELETE", `/keys/${siteKey}/webhooks/${h.id}`);
      return res?.success ? null : res?.error || "Couldn't delete the webhook";
    },
    undo: () => {
      hooks = hooks.toSpliced(at, 0, h);
    },
  });
}
</script>

{#snippet logFooter()}
  <Button disabled={testing[log?.hook.id]} onclick={() => log && test(log.hook)}>
    {#if testing[log?.hook.id]}<Spinner class="size-3.5" label="Sending test" />{/if}
    Send test
  </Button>
  <Button variant="primary" onclick={() => (log = null)}>Done</Button>
{/snippet}

{#snippet addButton()}
  <Button size="sm" class="pl-2" onclick={startAdd}>
    <Icon name="plus" size={14} />
    Add webhook
  </Button>
{/snippet}

<Group
  id="webhooks"
  title="Webhooks"
  flush
>
  {#snippet action()}{@render addButton()}{/snippet}

{#if !hooks.length}
  <Empty title="No webhooks yet">Add one to hear about blocks and AI agents as they happen.</Empty>
{:else}
  <Table flush>
    <TableHeader>
      <TableRow>
        <TableHead>Endpoint</TableHead>
        <TableHead class="max-md:hidden">Sends</TableHead>
        <TableHead class="w-px whitespace-nowrap max-sm:hidden">Last delivery</TableHead>
        <TableHead class="w-px"><span class="sr-only">On</span></TableHead>
        <TableHead class="w-px"><span class="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each hooks as h (h.id)}
        {@const rows = history[h.id]}
        {@const d = rows === undefined ? undefined : (rows[0] ?? null)}
        <TableRow class="motion-safe:[&>td]:transition-opacity motion-safe:[&>td]:duration-200 {h.enabled ? '' : '[&>td:not(:nth-last-child(-n+2))]:opacity-55'} {fresh === h.id ? 'wh-enter' : ''}">
          <TableCell class="w-full max-w-0 py-2.5!">
            <span class="flex min-w-0 flex-col gap-0.5">
              {#if h.name}<span class="truncate font-medium">{h.name}</span>{/if}
              <span class="truncate font-mono text-xs {h.name ? 'text-muted-foreground' : ''}" title={h.url}>{bare(h.url)}</span>
              {#if d}
                <span class="flex items-center gap-2 text-xs sm:hidden {d.ok ? 'text-muted-foreground' : 'text-destructive'}">{d.ok ? "Delivered" : "Failed"} {ago(d.at)}<HealthStrip {rows} max={20} /></span>
              {/if}
              <span class="mt-1 flex flex-wrap gap-1 md:hidden">
                {#each h.triggers as t (t)}
                  <Tag>{TRIGGER_LABELS[t] ?? t}</Tag>
                {/each}
              </span>
            </span>
          </TableCell>
          <TableCell class="py-2.5! max-md:hidden">
            <span class="flex gap-1">
              {#each h.triggers as t (t)}
                <Tag>{TRIGGER_LABELS[t] ?? t}</Tag>
              {/each}
            </span>
          </TableCell>
          <TableCell class="whitespace-nowrap max-sm:hidden">
            {#if testing[h.id]}
              <span class="flex items-center gap-2 text-muted-foreground">
                <Spinner class="size-3.5" label="Sending test" />
                Sending test
              </span>
            {:else if d}
              <button
                type="button"
                class="flex cursor-pointer flex-col items-start rounded-sm text-left {tested === h.id ? 'wh-enter' : ''} outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:[&>span:first-child]:underline"
                onclick={() => showLog(h)}
              >
                <span class="font-medium {d.ok ? 'text-success' : 'text-destructive'}">{d.ok ? `Delivered, ${d.status}` : d.status ? `Failed, HTTP ${d.status}` : "Failed, no answer"}</span>
                <span class="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {Date.now() - d.at < 5000 ? "Just now" : ago(d.at)}
                  <HealthStrip {rows} max={20} />
                </span>
              </button>
            {:else if d === null}
              <span class="text-muted-foreground">Nothing sent yet</span>
            {:else}
              <span class="text-faint-foreground">Unknown</span>
            {/if}
          </TableCell>
          <TableCell class="pe-1">
            <Switch checked={h.enabled} label="Send events to {title(h)}" onchange={(v) => toggle(h, v)} />
          </TableCell>
          <TableCell class="ps-1 pe-2.5">
            <Menu width="w-48">
              {#snippet trigger(props)}
                <Button {...props} variant="ghost" size="sm" icon aria-label="More for {title(h)}">
                  <Icon name="more" size={16} stroke={3} />
                </Button>
              {/snippet}
              <MenuItem icon="edit" onselect={() => startEdit(h)}>Edit</MenuItem>
              <MenuItem icon="share" onselect={() => test(h)}>Send test</MenuItem>
              <MenuItem icon="events" onselect={() => showLog(h)}>Show deliveries</MenuItem>
              <MenuItem icon="refresh" onselect={() => rotate(h)}>Rotate secret</MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onselect={() => remove(h)}>Delete</MenuItem>
            </Menu>
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{/if}
</Group>

{#if adding}
  <Dialog title={adding.id ? "Edit webhook" : "Add webhook"} onclose={() => (adding = null)}>
    <form
      id="hookForm"
      class="flex flex-col gap-5"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Field label="Endpoint URL" for="hookUrl" error={adding.urlError}>
        <Input
          type="url"
          id="hookUrl"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="https://example.com/hooks/cap"
          bind:value={adding.url}
          invalid={!!adding.urlError}
          aria-describedby={adding.urlError ? "hookUrl-error" : undefined}
          oninput={() => {
            if (adding.urlError) adding.urlError = urlProblem(adding.url);
          }}
          onblur={() => {
            if (adding.url.trim()) adding.urlError = urlProblem(adding.url);
          }}
        />
      </Field>
      <Field label="Name" for="hookName" optional>
        <Input id="hookName" maxlength={60} bind:value={adding.name} />
      </Field>
      <fieldset class="flex flex-col gap-2.5" aria-describedby={adding.triggers.length ? undefined : "hookTriggers-error"}>
        <legend class="pb-2.5 text-sm font-medium">Send when</legend>
        {#each catalog.webhookTriggers as t (t)}
          <div class="flex items-center gap-2.5">
            <Checkbox id="hookTrigger-{t}" checked={adding.triggers.includes(t)} onchange={(v) => toggleTrigger(t, v)} />
            <label for="hookTrigger-{t}" class="cursor-pointer text-sm">{TRIGGER_LABELS[t] ?? t}</label>
          </div>
        {/each}
        {#if !adding.triggers.length}
          <p id="hookTriggers-error" class="text-sm text-muted-foreground">Pick at least one event.</p>
        {/if}
      </fieldset>
      {#if adding.error}
        <p class="text-sm text-destructive" role="alert">{adding.error}</p>
      {/if}
    </form>
    {#snippet footer()}
      <Button onclick={() => (adding = null)}>Cancel</Button>
      <Button variant="primary" type="submit" form="hookForm" disabled={adding.busy || !adding.triggers.length} aria-busy={adding.busy}>
        {#if adding.busy}<Spinner class="size-3.5" label={adding.id ? "Saving webhook" : "Adding webhook"} />{/if}
        {adding.id ? "Save webhook" : "Add webhook"}
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if secret}
  <Dialog
    title={secret.rotated ? "New signing secret" : "Webhook added"}
    description="Copy the signing secret now. Cap only shows it once."
    size="md"
    onclose={() => (secret = null)}
  >
    <Field label="Signing secret">
      <CopyText value={secret.value} label="Copy secret" />
    </Field>
    <div class="flex flex-col gap-2">
      <p class="text-sm text-pretty text-muted-foreground">
        Each request has a <code class="font-mono text-sm whitespace-nowrap text-foreground">cap-signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> header, an HMAC-SHA256 of <code class="font-mono text-sm text-foreground">t.body</code> with this secret. Check it before trusting the body.
      </p>
      <CodeBlock class="min-w-0" filename="verify.js" language="js" download={false} code={VERIFY} html={highlight(VERIFY)} />
    </div>
    {#snippet footer()}
      {#if secret.hook}
        {@const hook = hooks.find((x) => x.id === secret.hook.id) ?? secret.hook}
        <Button disabled={testing[hook.id]} onclick={() => test(hook)}>
          {#if testing[hook.id]}<Spinner class="size-3.5" label="Sending test" />{/if}
          {tested === hook.id && history[hook.id]?.[0] ? (history[hook.id][0].ok ? "Test delivered" : "Test failed, try again") : "Send test"}
        </Button>
      {/if}
      <Button variant="primary" onclick={() => (secret = null)}>Done</Button>
    {/snippet}
  </Dialog>
{/if}

{#if log}
  <Dialog open={!eventView?.open} title="Recent deliveries" description={title(log.hook)} size="md" footer={log.rows.length ? logFooter : undefined} onclose={() => (log = null)}>
    <DeliveryLog rows={log.rows} onevent={openEvent} testing={testing[log.hook.id]} highlight={tested === log.hook.id} ontest={() => test(log.hook)} />
  </Dialog>
{/if}

{#if eventView}
  <eventView.Component
    bind:open={
      () => eventView?.open ?? false,
      (v) => {
        if (!v) closeEvent();
      }
    }
    id={eventView.id}
    {siteKey}
    onfilter={closeEvent}
  />
{/if}

<style>

</style>
