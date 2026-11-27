<script>
import {
  Button,
  CodeBlock,
  Dialog as ConfirmDialog,
  Icon,
  Select,
  Switch,
  Tag,
} from "../../components/cap/index.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { ago, until } from "../../lib/format.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import Health from "../../polish/settings-c/Health.svelte";
import { highlight } from "../integration/highlight.js";
import UpdatesHero from "./UpdatesHero.svelte";

const INTERVALS = [
  ["daily", "Every day", "daily"],
  ["4d", "Every 4 days", "every 4 days"],
  ["weekly", "Every week", "weekly"],
  ["monthly", "Every month", "monthly"],
];

let status = $state(null);
let notices = $state(null);
let open = $state(false);
let saving = $state(false);
let details = $state(false);
let interval = $state("daily");
let choice = $state("daily");
let never = $state(false);
let slide = $state(0);
let stopped = false;

const loadNotices = () =>
  api("GET", "/settings/updates").then((r) => {
    if (r && "advisories" in r) notices = r;
  });

api("GET", "/settings/update-check").then((r) => {
  if (!r?.report) return;
  status = r;
  interval = r.interval ?? "daily";
  choice = r.enabled ? interval : "never";
});
loadNotices();

const report = $derived(status ? JSON.stringify(status.report, null, 2) : "");
const advisories = $derived(notices?.advisories ?? []);
const cadence = $derived(
  INTERVALS.find(([v]) => v === status?.interval)?.[2] ?? "daily",
);
const state = $derived(
  !status?.enabled
    ? "Checks are off"
    : advisories.length
      ? advisories.length === 1
        ? "Security fix available"
        : `${advisories.length} security fixes available`
      : notices?.latest
        ? `${notices.latest.version} is out`
        : notices?.checkedAt
          ? "Up to date"
          : "First check in a minute",
);

const health = $derived(
  !status?.enabled
    ? ["off", "Off"]
    : advisories.length
      ? ["bad", "Security fix available"]
      : notices?.latest
        ? ["info", `${notices.latest.version} available`]
        : ["ok", `Checked ${cadence}`],
);

const save = async (body) => {
  saving = true;
  const r = await api("PUT", "/settings/update-check", body);
  saving = false;
  if (!r?.success) {
    status = { ...status };
    interval = status.interval ?? "daily";
    choice = status.enabled ? interval : "never";
    toast(r?.error || "Couldn't save the setting", "error");
    return;
  }
  status = r;
  interval = r.interval ?? interval;
  choice = r.enabled ? interval : "never";
  setTimeout(loadNotices, 1500);
};

const pick = () => {
  if (choice === "never") {
    slide = 0;
    stopped = false;
    never = true;
    return;
  }
  interval = choice;
  save(status.enabled ? { interval } : { enabled: true, interval });
};

let noticeHooks = $state(null);

$effect(() => {
  if (!open) return;
  api("GET", "/settings/webhooks").then((h) => {
    noticeHooks = Array.isArray(h)
      ? h.filter(
          (x) =>
            x.enabled &&
            x.triggers.some((t) => t === "update" || t === "security"),
        ).length
      : null;
  });
});

const createHook = () => {
  open = false;
  if (!noticeHooks)
    app.webhookPreset = { scope: "instance", triggers: ["update", "security"] };
  navigate({ view: "settings", section: "webhooks" });
};

const keepChecking = () => {
  never = false;
  choice = status.enabled ? interval : "never";
};

const springBack = () => {
  const from = slide;
  if (!from) return;
  if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    slide = 0;
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 280);
    slide = Math.round(from * (1 - p) ** 3);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const release = () => {
  if (slide < 95) {
    springBack();
    return;
  }
  stopped = true;
  never = false;
  save({ enabled: false });
};
</script>

{#if status}
  <dt class="text-muted-foreground">Updates</dt>
  <dd class="flex flex-wrap items-center gap-x-3">
    <Health tone={health[0]} live={health[0] === "bad"}>{health[1]}</Health>
    <button
      type="button"
      class="cursor-pointer text-muted-foreground underline decoration-border underline-offset-4 [@media(hover:hover)]:hover:text-foreground"
      onclick={() => (open = true)}
    >
      Manage
    </button>
  </dd>

  <Dialog bind:open onOpenChange={(v) => !v && (details = false)}>
    <DialogContent
      size="xl"
      class="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-2 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:overflow-hidden"
    >
      <UpdatesHero class="h-44 md:h-auto md:min-h-[32rem]" mood={!status.enabled ? "off" : advisories.length ? "alert" : notices?.latest ? "update" : "ok"}>
        {#key state}
          <span class="hero-in text-[13px] text-white/65 tabular-nums">capd {notices?.version ?? ""}</span>
          <span class="hero-in flex items-center gap-1.5 text-base font-medium text-balance text-white" style:--delay="70ms">
            {#if advisories.length && status.enabled}<Icon name="shield" size={15} />{/if}
            {state}
          </span>
        {/key}
      </UpdatesHero>

      <div class="flex min-w-0 flex-col gap-6 px-5 pt-5 pb-4 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:px-6 md:pt-6">
        <div class="flex flex-col gap-1.5 pe-10">
          <DialogTitle class="text-balance">Stay up to date</DialogTitle>
          <DialogDescription class="text-pretty">
            capd asks trycap.dev about new releases and security fixes, and shows a notice in the sidebar when one affects this server.
          </DialogDescription>
        </div>

        <dl class="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-sm">
          <dt class="text-muted-foreground">Installed</dt>
          <dd class="tabular-nums">{notices?.version ?? "Unknown"}</dd>
          <dt class="text-muted-foreground">Latest release</dt>
          <dd class="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            {#if notices?.latest}
              {notices.latest.version}
              <a class="text-muted-foreground underline decoration-border underline-offset-4 [@media(hover:hover)]:hover:text-foreground" href={notices.latest.url} target="_blank" rel="noopener">Release notes</a>
            {:else if notices?.checkedAt}
              {notices.version}, you're on it
            {:else}
              <span class="text-muted-foreground">Not checked yet</span>
            {/if}
          </dd>
          <dt class="text-muted-foreground">Security</dt>
          <dd>
            {#if !notices?.checkedAt}
              <span class="text-muted-foreground">Not checked yet</span>
            {:else if advisories.length}
              <span class="font-medium text-destructive">{advisories.length === 1 ? "1 advisory affects" : `${advisories.length} advisories affect`} this version</span>
            {:else}
              No known advisories
            {/if}
          </dd>
          <dt class="text-muted-foreground">Last check</dt>
          <dd class="tabular-nums">{notices?.checkedAt ? ago(notices.checkedAt) : "Never"}</dd>
          <dt class="text-muted-foreground">Next check</dt>
          <dd class="tabular-nums">
            {#if !status.enabled}
              <span class="text-muted-foreground">Off</span>
            {:else if status.nextCheck && status.nextCheck > Date.now()}
              In {until(status.nextCheck)}
            {:else}
              Within the hour
            {/if}
          </dd>
        </dl>

        {#if advisories.length && status.enabled}
          <ul class="flex flex-col gap-2">
            {#each advisories as a, i (a.id || a.url)}
              <li style:--delay="{i * 50}ms" class="advisory flex flex-col gap-1.5 rounded-xl bg-destructive/5 px-3.5 py-3 ring-1 ring-destructive/20">
                <div class="flex items-center gap-2">
                  {#if a.severity}<Tag tone={a.severity === "low" ? "warning" : "danger"}>{a.severity[0].toUpperCase() + a.severity.slice(1)}</Tag>{/if}
                  {#if a.fixedIn}<span class="text-[13px] text-muted-foreground tabular-nums">Fixed in {a.fixedIn}</span>{/if}
                </div>
                <p class="text-sm text-pretty">{a.summary}</p>
                <a class="self-start text-[13px] text-muted-foreground underline decoration-border underline-offset-4 [@media(hover:hover)]:hover:text-foreground" href={a.url} target="_blank" rel="noopener">Read the advisory</a>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="flex flex-col gap-4 border-t border-border pt-5">
          <div class="flex min-h-8 items-center justify-between gap-4">
            <label for="usage-interval" class="text-sm font-medium">How often</label>
            <Select
              id="usage-interval"
              size="sm"
              class="w-36"
              options={[...INTERVALS.map(([v, l]) => [v, l]), ["never", "Never"]]}
              bind:value={choice}
              disabled={saving || status.lockedByEnv}
              onchange={pick}
            />
          </div>
          {#if status.lockedByEnv}
            <p class="-mt-2 text-sm text-pretty text-muted-foreground">Turned off by CAP_UPDATE_CHECK in this server's environment.</p>
          {/if}
          <div class="flex min-h-8 items-center justify-between gap-4">
            <label for="update-sidebar" class="text-sm font-medium {status.enabled ? '' : 'text-muted-foreground'}">Show pending updates and<br class="max-sm:hidden" /> security notices in the sidebar</label>
            <span class="flex w-36 shrink-0 justify-end">
              <Switch
                id="update-sidebar"
                checked={status.sidebar}
                disabled={saving || !status.enabled}
                onchange={(sidebar) => save({ sidebar })}
              />
            </span>
          </div>
          <div class="flex min-h-8 items-center justify-between gap-4">
            <span class="text-sm font-medium {status.enabled ? '' : 'text-muted-foreground'}">
              {noticeHooks ? `Also sent to ${noticeHooks} ${noticeHooks === 1 ? "webhook" : "webhooks"}` : "Send them to a webhook too"}
            </span>
            <Button size="sm" class="w-36 shrink-0" disabled={!status.enabled} onclick={createHook}>
              {#if !noticeHooks}<Icon name="plus" size={14} />{/if}
              {noticeHooks ? "Manage webhooks" : "Add webhook"}
            </Button>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-3">
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1 self-start text-start text-[13px] text-muted-foreground [@media(hover:hover)]:hover:text-foreground"
            aria-expanded={details}
            onclick={() => (details = !details)}
          >
            See what's sent
            <Icon name="down" size={13} class="uc-chevron {details ? 'rotate-180' : ''}" />
          </button>
          <div class="disclosure -mt-3 grid {details ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}" inert={!details}>
            <div class="flex min-h-0 flex-col gap-3 overflow-hidden">
              <p class="pt-3 text-[13px] text-pretty text-muted-foreground">No IPs, hostnames, keys or visitor data. Each check sends only this:</p>
              <CodeBlock class="min-w-0" filename="Sent with each check" language="json" download={false} code={report} html={highlight(report)} />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <ConfirmDialog
    bind:open={never}
    title="Stop checking for security fixes?"
    dim
    onclose={() => !stopped && keepChecking()}
  >
    <ul class="flex flex-col gap-4 pt-1">
      {#each [["shield", "You won't hear about security holes", "If a flaw lets bots past your captcha or into this dashboard, capd stays silent about it."], ["bot", "Bots keep getting smarter", "New solvers and scrapers appear all the time. Fixes for them only reach servers that update."], ["clock", "Nothing will remind you", "This server stays on its current version until someone checks by hand."]] as [icon, head, body] (icon)}
        <li class="flex gap-3">
          <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/12 text-destructive" aria-hidden="true"><Icon name={icon} size={16} /></span>
          <span class="flex flex-col gap-0.5">
            <span class="text-sm font-medium text-foreground">{head}</span>
            <span class="text-sm text-pretty text-muted-foreground">{body}</span>
          </span>
        </li>
      {/each}
    </ul>
    <p class="text-[13px] text-pretty text-muted-foreground">Checks send no IPs, hostnames, keys or visitor data.</p>
    {#snippet footer()}
      <div class="flex w-full flex-col gap-3">
        <Button variant="primary" class="w-full" onclick={keepChecking}>Keep checking for updates</Button>
        <div class="slide relative h-9 overflow-hidden rounded-lg ring-1 ring-destructive/25 ring-inset" style:--slide={slide / 100}>
          <div class="slide-fill pointer-events-none absolute inset-y-[3px] start-[3px] rounded-[7px] bg-destructive/15"></div>
          <span class="pointer-events-none absolute inset-0 grid place-items-center ps-9 text-sm font-medium text-destructive" style:opacity={1 - slide / 80}>Slide to stop checking</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            aria-label="Slide to the end to stop checking for updates"
            class="slide-input absolute inset-[3px] cursor-grab appearance-none bg-transparent active:cursor-grabbing"
            bind:value={slide}
            onpointerup={release}
            onkeyup={() => slide === 100 && release()}
            onblur={() => slide < 95 && springBack()}
          />
          <span class="slide-arrow pointer-events-none absolute inset-y-[3px] z-10 grid w-[30px] place-items-center text-white">
            <Icon name="right" size={16} />
          </span>
        </div>
      </div>
    {/snippet}
  </ConfirmDialog>
{/if}

<style>
  .slide-fill {
    width: calc(var(--slide) * (100% - 36px) + 30px);
  }

  .slide-arrow {
    inset-inline-start: calc(var(--slide) * (100% - 36px) + 3px);
  }

  .slide-input::-webkit-slider-thumb {
    appearance: none;
    width: 30px;
    height: 30px;
    border-radius: calc(var(--radius-lg) - 3px);
    background: var(--destructive);
  }

  .slide-input::-moz-range-thumb {
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: calc(var(--radius-lg) - 3px);
    background: var(--destructive);
  }

  .slide-input:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: no-preference) {


    .disclosure {
      transition:
        grid-template-rows 320ms cubic-bezier(0.16, 1, 0.3, 1),
        opacity 220ms ease-out;
    }

    :global(.uc-chevron) {
      transition: rotate 200ms ease-out;
    }
  }

</style>
