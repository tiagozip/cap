<script>
import {
  CodeBlock,
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

const loadNotices = () =>
  api("GET", "/settings/updates").then((r) => {
    if (r && "advisories" in r) notices = r;
  });

api("GET", "/settings/update-check").then((r) => {
  if (!r?.report) return;
  status = r;
  interval = r.interval ?? "daily";
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
    toast(r?.error || "Couldn't save the setting", "error");
    return;
  }
  status = r;
  interval = r.interval ?? interval;
  setTimeout(loadNotices, 1500);
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

        <div class="flex flex-col gap-3 border-t border-border pt-5">
          <div class="flex items-center justify-between gap-4">
            <label for="update-check" class="text-sm font-medium">Check for updates and security notices</label>
            <Switch
              id="update-check"
              checked={status.enabled}
              disabled={saving || status.lockedByEnv}
              onchange={(enabled) => save({ enabled })}
            />
          </div>
          {#if status.lockedByEnv}
            <p class="text-sm text-pretty text-muted-foreground">Turned off by CAP_UPDATE_CHECK in this server's environment.</p>
          {/if}
          <div class="flex items-center justify-between gap-4">
            <label for="usage-interval" class="text-sm font-medium {status.enabled ? '' : 'text-muted-foreground'}">How often</label>
            <Select
              id="usage-interval"
              size="sm"
              class="w-36"
              options={INTERVALS.map(([v, l]) => [v, l])}
              bind:value={interval}
              disabled={saving || !status.enabled}
              onchange={() => save({ interval })}
            />
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
{/if}

<style>
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
