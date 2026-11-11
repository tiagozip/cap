<script>
import {
  Button,
  CodeBlock,
  Icon,
  Input,
  Row,
  Skeleton,
  Switch,
  Tag,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { ago } from "../../lib/format.js";
import { t } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { toast } from "../../lib/ui.svelte.js";
import { setWidgetFiles, widgetScript } from "../integration/embed.svelte.js";
import { highlight } from "../integration/highlight.js";

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,32})?$/;

let status = $state(structuredClone(samples.widgetFiles));
let loadError = $state("");
let form = $state({
  enabled: samples.widgetFiles.enabled,
  widget: samples.widgetFiles.widget,
  wasm: samples.widgetFiles.wasm,
});
let ready = $state(false);
let saving = $state(false);
let downloading = $state(false);
let checking = $state(false);
let latest = $state(null);
let error = $state("");
let usageOpen = $state(false);

const apply = (s) => {
  status = s;
  setWidgetFiles(s);
  form = { enabled: s.enabled, widget: s.widget, wasm: s.wasm };
  ready = true;
};

const load = async () => {
  const r = await api("GET", "/settings/assets");
  if (!r?.builtWith) {
    loadError = r?.error || "Couldn't load widget file settings";
    return;
  }
  loadError = "";
  apply(r);
};

load();

const dirty = $derived(
  !!form &&
    !!status &&
    (form.enabled !== status.enabled ||
      form.widget.trim() !== status.widget ||
      form.wasm.trim() !== status.wasm),
);
const builtIn = $derived(
  !!form &&
    form.widget.trim() === status.builtWith.widget &&
    form.wasm.trim() === status.builtWith.wasm,
);
const newer = $derived(
  latest &&
    (latest.widget !== form?.widget.trim() || latest.wasm !== form?.wasm.trim())
    ? latest
    : null,
);
const usage = $derived(
  status
    ? `${widgetScript({ selfHosted: true, widget: status.widget, wasm: status.wasm })}

<cap-widget data-cap-api-endpoint="${location.origin}/<site-key>/"></cap-widget>`
    : "",
);
const host = $derived(status ? new URL(status.source).host : "");

const save = async () => {
  error = "";
  const widget = form.widget.trim();
  const wasm = form.wasm.trim();
  if (!VERSION.test(widget) || !VERSION.test(wasm)) {
    error = "Use version numbers such as 0.1.58.";
    return;
  }
  saving = true;
  const r = await api("PUT", "/settings/assets", {
    enabled: form.enabled,
    widget,
    wasm,
  });
  saving = false;
  if (!r?.success) {
    error = r?.error || "Couldn't save widget file settings";
    return;
  }
  if (r.status) apply(r.status);
  toast(t("Widget file settings saved"));
  if (form.enabled) setTimeout(load, 3000);
};

const download = async () => {
  downloading = true;
  const r = await api("POST", "/settings/assets/refresh");
  downloading = false;
  if (r?.status) apply(r.status);
  if (!r?.success) toast(t(r?.error || "Couldn't download the files"), "error");
};

const check = async () => {
  checking = true;
  const r = await api("GET", "/settings/assets/latest");
  checking = false;
  if (!r?.success) {
    toast(t(r?.error || "Couldn't check for new versions"), "error");
    return;
  }
  latest = { widget: r.widget, wasm: r.wasm };
  if (!newer) toast(t("These are the newest versions"));
};
</script>

<Skeleton loading={!ready && !loadError} error={loadError} label={t("Loading widget file settings")}>
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{t(loadError)}</p>
  {/snippet}
  <div class="flex flex-col divide-y divide-border">
    <Row
      label={t("Serve widget files from this server")}
      for="assets-enabled"
      help={t("Visitors load the widget and its WebAssembly from this server's /assets instead of jsDelivr. Each key's setup snippet follows this setting.")}
    >
      <Switch id="assets-enabled" bind:checked={form.enabled} />
    </Row>

    <Row
      label={t("Versions")}
      help={t("This Cap release was built with widget {widget} and WebAssembly {wasm}. An older widget can miss features this server expects.", { widget: status.builtWith.widget, wasm: status.builtWith.wasm })}
    >
      <div class="flex w-full flex-col gap-3 md:max-w-xs">
        <div class="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2">
          <label for="assets-widget" class="text-sm text-muted-foreground">{t("Widget")}</label>
          <Input id="assets-widget" mono bind:value={form.widget} invalid={!!error} />
          <label for="assets-wasm" class="text-sm text-muted-foreground">WebAssembly</label>
          <Input id="assets-wasm" mono bind:value={form.wasm} invalid={!!error} />
        </div>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-end">
          {#if !builtIn}
            <Button
              variant="link"
              onclick={() => {
                form.widget = status.builtWith.widget;
                form.wasm = status.builtWith.wasm;
              }}
            >
              {t("Use built-in versions")}
            </Button>
          {/if}
          <Button variant="link" disabled={checking} onclick={check}>
            {checking ? t("Checking") : t("Check for newer versions")}
          </Button>
        </div>
        {#if newer}
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm md:justify-end">
            <span class="text-muted-foreground">{t("Newest on npm: widget {widget}, WebAssembly {wasm}", { widget: newer.widget, wasm: newer.wasm })}</span>
            <Button
              variant="link"
              onclick={() => {
                form.widget = newer.widget;
                form.wasm = newer.wasm;
              }}
            >
              {t("Use these")}
            </Button>
          </div>
        {/if}
      </div>
    </Row>

    {#if status.enabled}
      <Row
        label={t("Downloaded files")}
        help={t("Cap downloads the files from {host} into Valkey when you save new versions, and checks every hour that they're there.", { host })}
      >
        <div class="flex flex-col gap-2 md:items-end">
          {#if status.cached}
            <Tag tone={status.cached.widget === status.widget && status.cached.wasm === status.wasm ? "success" : "warning"} dot>
              {t("Widget {widget}, WebAssembly {wasm}", { widget: status.cached.widget, wasm: status.cached.wasm })}
            </Tag>
            <p class="text-sm text-muted-foreground md:text-end">
              {t("Downloaded {time} from {host}.", { time: ago(status.cached.at), host })}{status.cached.hashwx ? "" : ` ${t("This WebAssembly version has no HashWX file, so HashWX keys load it from jsDelivr.")}`}
            </p>
          {:else}
            <p class="text-sm text-muted-foreground md:text-end">{status.updating ? t("Downloading now.") : t("Nothing downloaded yet.")}</p>
          {/if}
          {#if status.error}
            <p class="text-sm text-destructive md:text-end" role="alert">{t("The last download failed: {error}", { error: status.error })}</p>
          {/if}
          <Button size="sm" disabled={downloading} onclick={download}>
            {downloading ? t("Downloading") : t("Download again")}
          </Button>
        </div>
      </Row>

      <div class="flex flex-col py-3">
        <button
          type="button"
          class="-mx-2 flex cursor-pointer items-center gap-1.5 self-start rounded-md px-2 py-1 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [@media(hover:hover)]:hover:bg-foreground/5"
          aria-expanded={usageOpen}
          aria-controls="assets-usage"
          onclick={() => (usageOpen = !usageOpen)}
        >
          <Icon
            name="right"
            size={14}
            class="text-muted-foreground transition-[rotate] duration-200 ease-out motion-reduce:transition-none {usageOpen ? 'rotate-90' : ''}"
          />
          {t("Usage")}
        </button>
        <div
          id="assets-usage"
          class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none {usageOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"
          inert={!usageOpen}
        >
          <div class="flex min-h-0 flex-col gap-3 overflow-hidden">
            <p class="pt-2 text-sm text-pretty text-muted-foreground">
              {t("Load the widget from this server on any page that uses one of its keys, and replace")}
              <code class="font-mono text-[0.9em] text-foreground">&lt;site-key&gt;</code> {t("with the key's site key. Each key's setup section already shows this snippet with its own key filled in.")}
            </p>
            <CodeBlock class="min-w-0" filename="index.html" language="html" download={false} code={usage} html={highlight(usage)} />
          </div>
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-end gap-3 py-5">
      {#if error}
        <p class="me-auto text-sm text-destructive" role="alert">{t(error)}</p>
      {/if}
      <Button variant="primary" disabled={saving || !dirty} onclick={save}>{saving ? t("Saving") : t("Save widget file settings")}</Button>
    </div>
  </div>
</Skeleton>
