<script>
import {
  Button,
  Checkbox,
  Icon,
  Input,
  Row,
  Switch,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { app, refreshSettings } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";

const HEADERS = [
  "accept-encoding",
  "accept-language",
  "cache-control",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
];

const normalizeOrigin = (raw) => {
  const val = (raw || "").trim();
  if (!val) return "";
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(val) && !/^https?:\/\//i.test(val))
    return "";
  const isLocal =
    /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(val);
  const withScheme = /^https?:\/\//i.test(val)
    ? val
    : `${isLocal ? "http" : "https"}://${val}`;
  try {
    const parsed = new URL(withScheme);
    return ["http:", "https:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.origin
      : "";
  } catch {
    return "";
  }
};

const rl = app.settings.ratelimit ?? { max: 30, duration: 5000 };
const fl = app.settings.filtering ?? {
  blockNonBrowserUA: false,
  requiredHeaders: [],
};
const initial = {
  max: rl.max,
  duration: rl.duration,
  origins: app.settings.cors?.origins ?? [],
  blockUA: !!fl.blockNonBrowserUA,
  headers: HEADERS.filter((h) => fl.requiredHeaders?.includes(h)),
};
let saved = $state(initial);

let max = $state(initial.max);
let seconds = $state(initial.duration / 1000);
let corsOn = $state(initial.origins.length > 0);
let nextId = 0;
const row = (value = "") => ({ id: nextId++, value, invalid: false });
let rows = $state([...initial.origins.map((o) => row(o)), row()]);
let blockUA = $state(initial.blockUA);
let headersOn = $state(initial.headers.length > 0);
let headers = $state([...initial.headers]);
let saving = $state(false);
let error = $state("");

const duration = $derived(Math.round((Number(seconds) || 0) * 1000));
const origins = $derived(
  corsOn ? rows.map((r) => normalizeOrigin(r.value)).filter(Boolean) : [],
);
const required = $derived(
  headersOn ? HEADERS.filter((h) => headers.includes(h)) : [],
);
const dirty = $derived({
  ratelimit: Number(max) !== saved.max || duration !== saved.duration,
  cors: JSON.stringify(origins) !== JSON.stringify(saved.origins),
  filtering:
    blockUA !== saved.blockUA ||
    JSON.stringify(required) !== JSON.stringify(saved.headers),
});
const anyDirty = $derived(dirty.ratelimit || dirty.cors || dirty.filtering);

const ensureEmptyRow = () => {
  const empties = rows.filter((r) => !r.value.trim());
  if (!empties.length) {
    rows.push(row());
    return;
  }
  const extra = new Set(empties.slice(1).map((r) => r.id));
  if (extra.size) rows = rows.filter((r) => !extra.has(r.id));
};

const save = async () => {
  error = "";
  const m = Number(max);
  if (dirty.ratelimit && (!Number.isInteger(m) || m < 1 || m > 10000)) {
    error = "Allow between 1 and 10,000 challenges per window.";
    return;
  }
  if (dirty.ratelimit && (duration < 1000 || duration > 3_600_000)) {
    error = "Pick a window between 1 and 3,600 seconds.";
    return;
  }
  if (corsOn && rows.some((r) => r.invalid)) {
    error =
      "Fix the highlighted website addresses, for example https://example.com.";
    return;
  }
  saving = true;
  const jobs = [];
  if (dirty.ratelimit)
    jobs.push(api("PUT", "/settings/ratelimit", { max: m, duration }));
  if (dirty.cors)
    jobs.push(
      api("PUT", "/settings/cors", {
        origins: origins.length ? origins : null,
      }),
    );
  if (dirty.filtering)
    jobs.push(
      api("PUT", "/settings/filtering", {
        blockNonBrowserUA: blockUA,
        requiredHeaders: required,
      }),
    );
  const results = await Promise.all(jobs);
  saving = false;
  const failed = results.find((r) => !r?.success);
  if (failed) {
    error = failed.error || "Couldn't save every change. Try again.";
    return;
  }
  saved = {
    max: m,
    duration,
    origins: [...origins],
    blockUA,
    headers: [...required],
  };
  rows = [...origins.map((o) => row(o)), row()];
  await refreshSettings();
  toast("Protection defaults saved");
};
</script>

<div class="flex flex-col divide-y divide-border">
  <Row label="Challenges per visitor" help="A visitor who goes over this waits before they get another challenge.">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <label for="rl-max" class="sr-only">Challenges allowed</label>
      <div class="w-20"><Input id="rl-max" type="number" inputmode="numeric" min="1" max="10000" bind:value={max} /></div>
      <label for="rl-window" class="text-muted-foreground">every</label>
      <div class="w-20"><Input id="rl-window" type="number" inputmode="decimal" min="1" max="3600" step="any" bind:value={seconds} /></div>
      <span class="text-muted-foreground">seconds</span>
    </div>
  </Row>

  <Row label="Only allow my websites" for="cors-on" help="Challenges load only on the sites you list, so nobody else can use your keys.">
    <Switch
      id="cors-on"
      bind:checked={corsOn}
      onchange={(on) => {
        if (on) ensureEmptyRow();
      }}
    />
    {#snippet below()}
      {#if corsOn}
        <div class="flex w-full flex-col gap-2 md:max-w-xs" role="group" aria-label="Allowed websites">
          {#each rows as r (r.id)}
            <Input
              type="text"
              inputmode="url"
              aria-label="Allowed website"
              placeholder="example.com"
              invalid={r.invalid}
              bind:value={r.value}
              oninput={() => {
                r.invalid = false;
                ensureEmptyRow();
              }}
              onblur={() => {
                const n = normalizeOrigin(r.value);
                r.invalid = !!r.value.trim() && !n;
                if (n) r.value = n;
              }}
            >
              {#snippet suffix()}
                {#if r.value}
                  <Button
                    variant="ghost"
                    icon
                    size="sm"
                    class="size-7"
                    aria-label="Remove {r.value}"
                    onclick={() => {
                      rows = rows.filter((x) => x.id !== r.id);
                      ensureEmptyRow();
                    }}
                  >
                    <Icon name="x" size={14} />
                  </Button>
                {/if}
              {/snippet}
            </Input>
          {/each}
        </div>
      {/if}
    {/snippet}
  </Row>

  <Row label="Block scripts and command-line tools" for="block-ua" help="Turns away clients like curl and python-requests before they get a challenge.">
    <Switch id="block-ua" bind:checked={blockUA} />
  </Row>

  <Row label="Block requests that don't look like a browser" for="req-headers" help="Every real browser sends certain headers. Requests missing any you check here are blocked.">
    <Switch
      id="req-headers"
      bind:checked={headersOn}
      onchange={(on) => {
        if (on && !headers.length) headers = ["accept-encoding", "accept-language"];
      }}
    />
    {#snippet below()}
      {#if headersOn}
        <div class="grid gap-x-6 gap-y-2.5 sm:grid-cols-2" role="group" aria-label="Required headers">
          {#each HEADERS as h (h)}
            <div class="flex items-center gap-2.5">
              <Checkbox
                id="hdr-{h}"
                checked={headers.includes(h)}
                onchange={(on) => {
                  headers = on ? [...headers, h] : headers.filter((x) => x !== h);
                }}
              />
              <label for="hdr-{h}" class="cursor-pointer font-mono text-sm">{h}</label>
            </div>
          {/each}
        </div>
      {/if}
    {/snippet}
  </Row>

  <div class="flex flex-wrap items-center justify-end gap-3 py-5">
    {#if error}
      <p class="me-auto text-sm text-destructive" role="alert">{error}</p>
    {:else if anyDirty}
      <span class="text-sm text-muted-foreground" role="status">Unsaved changes</span>
    {/if}
    <Button variant="primary" disabled={!anyDirty || saving} onclick={save}>{saving ? "Saving" : "Save changes"}</Button>
  </div>
</div>
