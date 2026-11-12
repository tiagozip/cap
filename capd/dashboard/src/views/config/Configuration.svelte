<script>
import {
  Button,
  Group,
  Icon,
  Input,
  PageHeader,
  Row,
  SectionNav,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { loadCatalog } from "../../lib/catalog.svelte.js";
import { app, loadKeys } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import Integration from "../integration/Integration.svelte";
import Webhooks from "../rules/Webhooks.svelte";
import Advanced from "./Advanced.svelte";
import DangerZone from "./DangerZone.svelte";
import { changesOf, formFrom, payloadOf } from "./form.js";
import Limits from "./Limits.svelte";
import { normalizeOrigin } from "./origins.js";
import ShareLinks from "./ShareLinks.svelte";
import WidgetDemo from "./WidgetDemo.svelte";

let form = $state(formFrom(app.key));
let errors = $state({});
let originBad = $state({});
let saving = $state("");
let hooks = $state(null);
let demoOpen = $state(false);

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
    next.origins =
      "Enter a valid website, such as https://example.com or *.example.com.";
  }
  if (form.corsOn && badOrigin < 0 && !p.corsOrigins)
    next.origins =
      "Add at least one website, or turn off the website restriction.";
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
  return false;
}

async function save() {
  if (!validate()) return;
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
    { id: "cfgGeneral", label: "General" },
    { id: "cfgAccess", label: "Access" },
    { id: "cfgPuzzle", label: "Puzzle" },
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
      <Row label="Key name" for="cfgName" help="Only you see it, in the sidebar.">
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
      <Row label="Demo" help="Try this key's widget on your device and style it.">
        <Button onclick={() => (demoOpen = true)}>
          <Icon name="eye" size={14} />
          Open demo
        </Button>
      </Row>
    </Group>

    <Limits bind:form bind:originBad {errors} />

    <Advanced bind:form {errors} />
  </form>

  {#if hooks}
    <Webhooks siteKey={app.key.siteKey} bind:hooks onchange={loadHooks} />
  {/if}

  <ShareLinks />

  <DangerZone />
</div>
</div>

<WidgetDemo bind:open={demoOpen} {dirty} />

{#if dirty}
  <div
    class="sticky bottom-5 z-40 mx-auto -mt-6 mb-6 flex w-[calc(100%-1.5rem)] max-w-md items-center gap-2 rounded-xl bg-popover py-2 ps-4 pe-2 text-sm text-popover-foreground shadow-overlay transition-[translate,opacity] duration-200 ease-(--ease-out) starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none"
    role="status"
  >
    <span class="me-auto">{Object.keys(errors).length ? "Fix the marked fields to save" : "You have unsaved changes"}</span>
    <Button
      variant="ghost"
      size="sm"
      onclick={() => {
        form = formFrom(app.key);
        errors = {};
        originBad = {};
      }}
    >
      Discard
    </Button>
    <Button variant="primary" size="sm" disabled={!!saving} onclick={save}>{saving || "Save changes"}</Button>
  </div>
{/if}
