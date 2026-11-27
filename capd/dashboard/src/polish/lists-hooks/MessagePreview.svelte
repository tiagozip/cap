<script>
import { MESSAGE_COLORS } from "../../../../src/policy/webhook-services.js";
import { highlight } from "../../views/integration/highlight.js";
import ServiceIcon from "./ServiceIcon.svelte";

let { service, name, items = [], url = "", config = {} } = $props();

const FAMILIES = {
  discord: "embed",
  notifiarr: "embed",
  slack: "slack",
  rocketchat: "slack",
  mattermost: "slack",
  teams: "card",
  googlechat: "card",
  telegram: "bubble",
  matrix: "bubble",
  zulip: "bubble",
  lark: "bubble",
  ntfy: "push",
  pushover: "push",
  gotify: "push",
  bark: "push",
  join: "push",
  pushbullet: "push",
  ifttt: "push",
  opsgenie: "incident",
  pagerduty: "incident",
  twilio: "sms",
};

const family = $derived(FAMILIES[service] ?? "json");
const surface = $derived(!["json", "incident"].includes(family));
const accentOf = (m) =>
  `#${(MESSAGE_COLORS[m.level] ?? MESSAGE_COLORS.info).toString(16).padStart(6, "0")}`;
const logo = new URL("public/logo-small.webp", document.baseURI).toString();
const timeOf = (m) =>
  new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const host = $derived.by(() => {
  try {
    return new URL(url).host;
  } catch {
    return "your-server.example";
  }
});
const SEVERITY = {
  critical: ["Critical", "danger"],
  error: ["Error", "danger"],
  warning: ["Warning", "warning"],
  info: ["Info", "info"],
  P1: ["P1", "danger"],
  P2: ["P2", "danger"],
  P3: ["P3", "warning"],
  P4: ["P4", "info"],
  P5: ["P5", "info"],
};
const severity = $derived(
  SEVERITY[
    service === "pagerduty"
      ? config.severity || "warning"
      : config.priority || "P3"
  ] ?? SEVERITY.P3,
);
const severityColor = $derived(
  `#${MESSAGE_COLORS[severity[1]].toString(16).padStart(6, "0")}`,
);
</script>

{#snippet avatar(round = true)}
  <img src={logo} alt="" class="size-9 shrink-0 bg-foreground/5 object-cover outline-1 -outline-offset-1 outline-foreground/8 {round ? 'rounded-full' : 'rounded-lg'}" />
{/snippet}

{#snippet sender(time, tag = "App")}
  <span class="flex items-baseline gap-1.5">
    <span class="font-semibold">Cap</span>
    <span class="rounded-[4px] bg-foreground/8 px-1 py-px text-[10px] font-semibold text-muted-foreground">{tag}</span>
    <span class="text-xs text-muted-foreground tabular-nums">{time}</span>
  </span>
{/snippet}

<div class="flex flex-col gap-4 text-[13px] leading-snug {surface ? 'rounded-xl bg-muted/60 p-4' : ''}">
  {#each items as { message, payload }, i (i)}
    {@const accent = accentOf(message)}
    {@const time = timeOf(message)}
    <div class="wh-msg flex min-w-0 flex-col">
      {@render one(message, payload, accent, time)}
    </div>
  {/each}
</div>

{#snippet one(message, payload, accent, time)}
  {#if family === "embed"}
    <div class="flex gap-3">
      {@render avatar()}
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        {@render sender(time)}
        <div class="flex flex-col gap-2 rounded-[4px] border-s-4 bg-foreground/[0.045] py-2.5 ps-3 pe-3.5" style:border-color={accent}>
          <span class="font-semibold">{message.title}</span>
          <span class="text-pretty text-foreground/85">{message.plain}</span>
          {#if message.fields.length}
            <div class="grid grid-cols-2 gap-x-3 gap-y-2">
              {#each message.fields.slice(0, 8) as [k, v] (k + v)}
                <span class="flex min-w-0 flex-col">
                  <span class="text-xs font-semibold">{k}</span>
                  <span class="break-words text-foreground/85">{v}</span>
                </span>
              {/each}
            </div>
          {/if}
          <span class="text-[11px] text-muted-foreground">{message.footer} • Today at {time}</span>
        </div>
      </div>
    </div>
  {:else if family === "slack"}
    <div class="flex gap-2.5">
      {@render avatar(false)}
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        {@render sender(time)}
        <span class="font-semibold">{message.title}</span>
        <span class="text-pretty text-foreground/85">{message.plain}</span>
        {#if message.fields.length}
          <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 border-s-[3px] ps-3" style:border-color={accent}>
            {#each message.fields.slice(0, 8) as [k, v] (k + v)}
              <span class="flex min-w-0 flex-col">
                <span class="font-semibold">{k}</span>
                <span class="break-words text-foreground/85">{v}</span>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if family === "card"}
    <div class="flex gap-2.5">
      {@render avatar()}
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        {@render sender(time, "Bot")}
        <div class="flex flex-col gap-2 overflow-hidden rounded-lg bg-background">
          <span class="h-1 w-full" style:background={accent}></span>
          <div class="flex flex-col gap-2 px-3.5 pb-3">
            <span class="text-[15px] font-semibold">{message.title}</span>
            <span class="text-pretty text-foreground/85">{message.plain}</span>
            {#if message.fields.length}
              <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                {#each message.fields.slice(0, 8) as [k, v] (k + v)}
                  <dt class="font-semibold">{k}</dt>
                  <dd class="break-words text-foreground/85">{v}</dd>
                {/each}
              </dl>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else if family === "bubble"}
    <div class="flex items-end gap-2">
      {@render avatar()}
      <div class="flex max-w-[92%] min-w-0 flex-col gap-1 rounded-2xl rounded-bl-md bg-foreground/[0.06] px-3.5 py-2.5">
        <span class="text-xs font-semibold" style:color={accent}>Cap</span>
        <span class="font-semibold">{message.title}</span>
        <span class="text-pretty text-foreground/85">{message.plain}</span>
        {#if message.fields.length}
          <span class="mt-1 flex flex-col">
            {#each message.fields.slice(0, 8) as [k, v] (k + v)}
              <span class="break-words"><span class="font-medium">{k}:</span> <span class="text-foreground/85">{v}</span></span>
            {/each}
          </span>
        {/if}
        <span class="self-end text-[11px] text-muted-foreground tabular-nums">{time}</span>
      </div>
    </div>
  {:else if family === "push"}
    <div class="flex flex-col gap-1 rounded-[20px] bg-background/80 p-3">
      <div class="flex items-center gap-2">
        <span class="grid size-5 place-items-center"><ServiceIcon {service} size={18} /></span>
        <span class="flex-1 text-xs font-medium text-muted-foreground">{name}</span>
        <span class="text-xs text-muted-foreground">now</span>
      </div>
      <span class="font-semibold">{message.title}</span>
      <span class="line-clamp-4 text-pretty whitespace-pre-line text-foreground/85">{service === "ifttt" ? message.plain : message.body}</span>
    </div>
  {:else if family === "incident"}
    <div class="flex flex-col gap-2.5 rounded-lg border border-border bg-background p-3.5">
      <div class="flex items-center gap-2">
        <span class="rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold text-white" style:background={severityColor}>{severity[0]}</span>
        <span class="rounded-[4px] bg-foreground/8 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Open</span>
        <span class="ms-auto text-xs text-muted-foreground tabular-nums">{time}</span>
      </div>
      <span class="font-semibold">{service === "pagerduty" ? `${message.title}: ${message.plain}` : message.title}</span>
      <span class="text-xs text-muted-foreground">Source: {message.source}</span>
      {#if message.fields.length}
        <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-border pt-2.5">
          {#each message.fields.slice(0, 8) as [k, v] (k + v)}
            <dt class="text-muted-foreground">{k}</dt>
            <dd class="break-words">{v}</dd>
          {/each}
        </dl>
      {/if}
    </div>
  {:else if family === "sms"}
    <div class="flex flex-col items-start gap-1">
      <span class="ps-1 text-xs text-muted-foreground">Text Message, Today {time}</span>
      <span class="max-w-[88%] rounded-[18px] rounded-bl-md bg-foreground/[0.08] px-3.5 py-2 text-pretty whitespace-pre-line">{message.title}{"\n"}{message.plain}</span>
    </div>
  {:else}
    <div class="flex flex-col overflow-hidden rounded-lg border border-border bg-background font-mono text-xs">
      <div class="flex flex-col gap-0.5 border-b border-border px-3 py-2 text-muted-foreground">
        <span class="truncate"><span class="font-semibold text-foreground">POST</span> {host}</span>
        <span class="truncate">cap-signature: t={Math.floor(message.at / 1000)},v1=…</span>
      </div>
      <pre class="max-h-[22rem] overflow-auto px-3 py-2.5 leading-relaxed">{@html highlight(JSON.stringify(payload, null, 2))}</pre>
    </div>
  {/if}
{/snippet}
