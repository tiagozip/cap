<script>
import { onDestroy } from "svelte";
import {
  Button,
  Group,
  Icon,
  Input,
  PageHeader,
  Row,
  SectionNav,
  Select,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { loadCatalog } from "../../lib/catalog.svelte.js";
import { app, loadKeys } from "../../lib/state.svelte.js";
import { toast, undoable } from "../../lib/ui.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import { describe } from "../../polish/key-settings/changes.js";
import { drafts } from "../../polish/key-settings/drafts.js";
import SaveBar from "../../polish/key-settings/SaveBar.svelte";
import Integration from "../integration/Integration.svelte";
import Webhooks from "../rules/Webhooks.svelte";
import Advanced from "./Advanced.svelte";
import DangerZone from "./DangerZone.svelte";
import { changesOf, formFrom, payloadOf } from "./form.js";
import Limits from "./Limits.svelte";
import { normalizeOrigin } from "./origins.js";
import ShareLinks from "./ShareLinks.svelte";
import WidgetDemo from "./WidgetDemo.svelte";

const siteKey = app.key.siteKey;
let form = $state(drafts.get(siteKey) ?? formFrom(app.key));
drafts.delete(siteKey);
let errors = $state({});
let originBad = $state({});
let saving = $state("");
let hooks = $state(null);
let demoOpen = $state(false);
let bar = $state();

let copyFrom = $state("");
const others = $derived(
  (app.keys ?? [])
    .filter((k) => k.siteKey !== siteKey)
    .map((k) => [k.siteKey, k.name || k.siteKey]),
);

async function copySettings(from) {
  const res = await api("GET", `/keys/${from}`);
  copyFrom = "";
  if (!res?.key?.config) {
    toast(res?.error || "Couldn't load that key's settings", "error");
    return;
  }
  const next = formFrom({ name: form.name, config: res.key.config });
  if (!Object.keys(changesOf(next, form)).length) {
    toast(`${res.key.name || from} already has the same settings`);
    return;
  }
  form = next;
  errors = {};
  originBad = {};
  toast(`Copied from ${res.key.name || from}. Review and save.`);
}

const loadHooks = () =>
  api("GET", `/keys/${app.key.siteKey}/webhooks`).then((h) => {
    hooks = Array.isArray(h) ? h : [];
  });
loadCatalog().then(loadHooks);

const baseline = $derived(formFrom(app.key));
const changes = $derived(changesOf(form, baseline));
const dirty = $derived(
  Object.keys(changes).length > 0 ||
    form.corsOn !== baseline.corsOn ||
    form.headersOn !== baseline.headersOn ||
    JSON.stringify(form.origins.filter((o) => o.trim())) !==
      JSON.stringify(baseline.origins),
);

const items = $derived(
  describe(changes, payloadOf(baseline), {
    ratelimitMax: app.settings.ratelimit?.max ?? 30,
    ratelimitDuration: app.settings.ratelimit?.duration ?? 5000,
  }),
);

onDestroy(() => {
  if (dirty) drafts.set(siteKey, $state.snapshot(form));
});

$effect(() => {
  JSON.stringify(form);
  errors = {};
});

const inRange = (v, min, max) =>
  v !== null && Number.isFinite(v) && v >= min && v <= max;

function validate() {
  const p = payloadOf(form);
  const next = {};
  if (!p.name) next.name = "Give this key a name so you can find it later.";
  const sha = form.protocol === "sha256-pow" || p.sha256Fallback;
  if (sha && !inRange(p.difficulty, 1, 8))
    next.difficulty = "Difficulty must be a whole number from 1 to 8.";
  if (sha && !inRange(p.challengeCount, 1, 500))
    next.challengeCount = "Challenge count must be from 1 to 500.";
  if (p.ratelimitMax !== null && !inRange(p.ratelimitMax, 1, 10000))
    next.ratelimitMax = "Max requests must be from 1 to 10,000.";
  if (
    p.ratelimitDuration !== null &&
    !inRange(p.ratelimitDuration, 1000, 3_600_000)
  )
    next.ratelimitSeconds = "The time window must be from 1 to 3,600 seconds.";
  const badOrigin = form.corsOn
    ? form.origins.findIndex((o) => o.trim() && !normalizeOrigin(o))
    : -1;
  if (badOrigin >= 0) {
    originBad = { [badOrigin]: true };
    next.origins = "Enter a website like example.com or *.example.com.";
  }
  if (form.corsOn && badOrigin < 0 && !p.corsOrigins)
    next.origins = "Add a website, or turn this off.";
  errors = next;
  const first = Object.keys(next)[0];
  if (!first) return true;
  const ids = {
    name: "cfgName",
    difficulty: "cfgDifficulty",
    challengeCount: "cfgChallengeCount",
    ratelimitMax: "cfgRatelimitMax",
    ratelimitSeconds: "cfgRatelimitSeconds",
    origins: `cfgOrigin-${Math.max(badOrigin, 0)}`,
  };
  document.getElementById(ids[first])?.focus();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    bar?.animate(
      { translate: ["0", "-4px", "3px", "-2px", "1px", "0"] },
      { duration: 320, easing: "ease-out" },
    );
  return false;
}

async function save() {
  if (saving || !validate()) return;
  const body = { ...changes };
  if (!Object.keys(body).length) {
    form = formFrom(app.key);
    return;
  }
  saving = "Saving";
  const res = await api("PUT", `/keys/${app.key.siteKey}/config`, body);
  saving = "";
  if (!res?.success) {
    toast(res?.error || "Couldn't save your changes", "error");
    return;
  }
  const { name, ...config } = body;
  Object.assign(app.key.config, config);
  if (name !== undefined) {
    app.key.name = name;
    loadKeys();
  }
  form = formFrom(app.key);
  toast("Settings saved");
}
</script>

<PageHeader title="Settings" />

<div class="flex items-start gap-10 px-4 pt-5 pb-12 md:px-5">
<SectionNav
  label="Settings sections"
  items={[
    { id: "cfgSetup", label: "Install" },
    { id: "cfgGeneral", label: "General", dot: "name" in changes },
    {
      id: "cfgAccess",
      label: "Access",
      dot: ["ratelimitMax", "ratelimitDuration", "corsOrigins", "blockNonBrowserUA", "requiredHeaders"].some((k) => k in changes),
    },
    {
      id: "cfgPuzzle",
      label: "Puzzle",
      dot: ["protocol", "sha256Fallback", "difficulty", "challengeCount", "obfuscationLevel"].some((k) => k in changes),
    },
    { id: "webhooks", label: "Webhooks" },
    { id: "cfgShares", label: "Share links" },
    { id: "cfgDanger", label: "Danger zone" },
  ]}
/>
<div class="flex max-w-3xl min-w-0 flex-1 flex-col gap-6">
  <Integration onreset={() => scrollToTop(document.getElementById("cfgDanger"), true)} />

  <form
    class="flex flex-col gap-6"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
  >
    <Group id="cfgGeneral" title="General">
      <Row label="Key name" for="cfgName">
        <div class="flex w-full flex-col gap-1.5 md:max-w-sm">
          <Input
            id="cfgName"
            type="text"
            maxlength="600"
            autocomplete="off"
            invalid={!!errors.name}
            aria-describedby={errors.name ? "cfgName-error" : undefined}
            bind:value={form.name}
          />
          {#if errors.name}<p id="cfgName-error" class="text-sm text-destructive">{errors.name}</p>{/if}
        </div>
      </Row>
      {#if others.length}
        <Row label="Copy settings from" for="cfgCopyFrom">
          <Select
            id="cfgCopyFrom"
            class="w-full md:w-64"
            options={[["", "Choose a key"], ...others]}
            bind:value={
              () => copyFrom,
              (v) => {
                copyFrom = v;
                if (v) copySettings(v);
              }
            }
          />
        </Row>
      {/if}
      <Row label="Try this widget">
        <Button onclick={() => (demoOpen = true)}>
          <Icon name="eye" size={14} />
          Open demo
        </Button>
      </Row>
    </Group>

    <Limits bind:form bind:originBad {errors} />

    <Advanced bind:form {errors} {baseline} />
  </form>

  {#if hooks}
    <Webhooks siteKey={app.key.siteKey} bind:hooks onchange={loadHooks} />
  {/if}

  <ShareLinks />

  <DangerZone />
</div>
</div>

<WidgetDemo bind:open={demoOpen} {dirty} onsave={save} />

<svelte:window
  onkeydown={(e) => {
    if (e.key !== "s" || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    if (!dirty || document.querySelector("[role=dialog]")) return;
    e.preventDefault();
    save();
  }}
  onbeforeunload={(e) => {
    if (dirty) e.preventDefault();
  }}
/>

{#if dirty}
  <SaveBar
    bind:bar
    {items}
    invalid={Object.keys(errors).length > 0}
    saving={!!saving}
    onsave={save}
    ondiscard={() => {
      const kept = $state.snapshot(form);
      form = formFrom(app.key);
      errors = {};
      originBad = {};
      undoable({
        message: "Changes discarded",
        commit: () => null,
        undo: () => {
          form = kept;
        },
      });
    }}
  />
{/if}
