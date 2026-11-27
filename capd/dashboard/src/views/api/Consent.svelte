<script>
import { untrack } from "svelte";
import { slide } from "svelte/transition";
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import ConnectSplash from "../../components/cap/ConnectSplash.svelte";
import {
  Button,
  Checkbox,
  Icon,
  Segmented,
  Spinner,
} from "../../components/cap/index.js";
import { agentIconId } from "../../lib/agents.js";
import { api } from "../../lib/api.js";
import { app } from "../../lib/state.svelte.js";
import LoginBackdrop from "../login/LoginBackdrop.svelte";
import { loadTools } from "./tools.js";

let { id } = $props();

let request = $state(null);
let error = $state("");
let access = $state("full");
let reach = $state("all");
let siteKeys = $state([]);
let busy = $state(false);
let done = $state(null);
let invalid = $state(false);
let tools = $state([]);
let linkedAt = $state(0);
let linked = $state(false);
let charged = $state(0);
let card = $state();
let press = null;

loadTools().then((t) => {
  tools = t;
});
const reads = $derived(tools.filter((t) => !t.write).length);

api("GET", `/oauth/requests/${untrack(() => id)}`).then((r) => {
  if (!r?.clientName) {
    error = r?.error || "This sign-in request expired.";
    return;
  }
  request = r;
  access = r.readOnly ? "read" : "full";
});

const answer = async (allow, button) => {
  if (allow && reach === "some" && !siteKeys.length) {
    invalid = true;
    return;
  }
  busy = true;
  const cb = card.getBoundingClientRect();
  const bb = button?.getBoundingClientRect();
  press = bb
    ? [bb.left - cb.left + bb.width / 2, bb.top - cb.top + bb.height / 2]
    : null;
  const r = await api("POST", `/oauth/requests/${id}`, {
    allow,
    access,
    siteKeys: reach === "some" ? siteKeys : undefined,
  });
  if (!r?.redirect) {
    busy = false;
    error = r?.error || "Couldn't finish the sign-in.";
    return;
  }
  done = allow ? "allowed" : "denied";
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!allow || still) {
    location.href = r.redirect;
    return;
  }
  linkedAt = performance.now();
  setTimeout(() => {
    location.href = r.redirect;
  }, 4000);
};

const phase = $derived(
  done === "allowed" && !linkedAt
    ? "allowed"
    : error || done === "denied"
      ? "denied"
      : "pending",
);
</script>

<main class="relative isolate grid min-h-dvh place-items-center bg-sidebar px-4 py-12">
  <LoginBackdrop />
  <div bind:this={card} class="consent-card relative flex w-full max-w-sm flex-col gap-6 rounded-3xl bg-background px-6 pt-8 pb-6 ring-1 ring-border">
    <div class="flex items-center justify-center gap-2" aria-hidden="true">
      <span class:joined={linked} style:--join="{charged - 100}ms" class="consent-tile from-start grid size-14 place-items-center rounded-2xl bg-muted ring-1 ring-foreground/10">
        {#if request}<AgentIcon id={agentIconId(request.clientName)} size={28} />{/if}
      </span>
      <span class:opacity-0={linked} style:transition-delay={linked ? `${charged + 200}ms` : null} class="consent-link flex items-center gap-2 transition-[color,opacity] {phase === 'allowed' ? 'text-success' : 'text-faint-foreground'} duration-300">
        <span class="consent-wire origin-left w-4 border-t border-current {phase === 'allowed' ? '' : 'border-dashed'}"></span>
        <span class="grid size-6 place-items-center">
          {#key phase}
            <span class="consent-mark col-start-1 row-start-1 grid place-items-center {phase === 'denied' ? 'text-destructive' : phase === 'pending' ? 'text-muted-foreground' : ''}" style:animation-delay={phase === "pending" ? "420ms" : null}>
              <Icon name={phase === "allowed" ? "check" : phase === "denied" ? "x" : "link"} size={20} />
            </span>
          {/key}
        </span>
        <span class="consent-wire origin-right w-4 border-t border-current {phase === 'allowed' ? '' : 'border-dashed'}"></span>
      </span>
      <span class:joined={linked} style:--join="{charged - 100}ms" class="consent-tile from-end grid size-14 place-items-center rounded-2xl bg-muted ring-1 ring-foreground/10">
        <img src="./public/logo-small.webp" alt="" width="30" height="30" />
      </span>
    </div>

    {#if error}
      <div class="flex flex-col gap-1 text-center">
        <h1 class="text-lg font-semibold text-balance">Couldn't connect</h1>
        <p class="text-sm text-pretty text-muted-foreground">{error}</p>
      </div>
    {:else if request}
      {#if done}
        <div class="flex flex-col gap-1 text-center" role="status">
          <h1 class="consent-done text-lg font-semibold text-balance" style:--d="{linkedAt ? charged + 900 : 0}ms">{done === "allowed" ? `${request.clientName} is connected` : "Access denied"}</h1>
        </div>
      {:else}
        <div class="flex flex-col gap-1 text-center">
          <h1 class="text-lg font-semibold text-balance">Connect {request.clientName} to Cap</h1>
          <p class="text-[13px] [overflow-wrap:anywhere] text-pretty text-muted-foreground" title={request.redirectTo}>Returns to <span class="font-medium text-foreground">{request.redirectTo}</span></p>
        </div>
      {/if}

      {#if !done}
      <div out:slide={{ duration: 280 }} class="-mt-6 flex flex-col gap-6 pt-6">
      <div class="flex flex-col rounded-2xl bg-muted/50 ring-1 ring-foreground/5">
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <div class="flex min-w-0 flex-col gap-0.5">
            <span id="consent-access" class="text-sm font-medium">Access</span>
            <span class="grid text-xs text-muted-foreground">
              <span class="col-start-1 row-start-1 transition-opacity duration-150 {access === 'full' ? '' : 'opacity-0'}" aria-hidden={access !== "full"}>{tools.length ? `All ${tools.length} tools` : "Can view and change"}</span>
              <span class="col-start-1 row-start-1 transition-opacity duration-150 {access === 'read' ? '' : 'opacity-0'}" aria-hidden={access !== "read"}>{tools.length ? `${reads} view-only tools` : "Can view, not change"}</span>
            </span>
          </div>
          <Segmented
            size="sm"
            label="Access"
            bind:value={access}
            options={[
              ["full", "Full"],
              ["read", "Read only"],
            ]}
          />
        </div>
        <div class="flex flex-col gap-2 border-t border-border px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <span id="consent-keys" class="text-sm font-medium">Site keys</span>
            <Segmented
              size="sm"
              label="Site keys"
              bind:value={reach}
              options={[
                ["all", "All"],
                ["some", "Some"],
              ]}
            />
          </div>
          {#if reach === "some"}
            <div class="consent-keys flex max-h-44 flex-col overflow-y-auto" role="group" aria-labelledby="consent-keys" aria-describedby={invalid ? "consent-keys-error" : undefined}>
              {#each app.keys as k (k.siteKey)}
                <div class="flex h-9 items-center gap-2.5">
                  <Checkbox
                    id="consent-{k.siteKey}"
                    checked={siteKeys.includes(k.siteKey)}
                    onchange={(on) => {
                      invalid = false;
                      siteKeys = on ? [...siteKeys, k.siteKey] : siteKeys.filter((x) => x !== k.siteKey);
                    }}
                  />
                  <label for="consent-{k.siteKey}" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                    <span class="truncate">{k.name}</span>
                    <code class="ms-auto truncate font-mono text-xs text-muted-foreground" title={k.siteKey}>{k.siteKey}</code>
                  </label>
                </div>
              {:else}
                <p class="py-1 text-sm text-muted-foreground">No site keys yet.</p>
              {/each}
            </div>
            {#if invalid}
              <p id="consent-keys-error" class="text-sm text-destructive" role="alert">Pick at least one.</p>
            {/if}
          {/if}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <Button disabled={busy} onclick={() => answer(false)}>Deny</Button>
        <Button variant="primary" disabled={busy} onclick={(e) => answer(true, e.currentTarget)}>
          {#if busy}<Spinner label="Connecting" />{/if}
          Allow
        </Button>
      </div>
      </div>
      {/if}
    {:else}
      <div class="grid place-items-center py-4"><Spinner label="Loading the sign-in request" /></div>
    {/if}
    {#if linkedAt}
      <ConnectSplash
        origin={linkedAt}
        {press}
        onready={(t) => {
          charged = t;
          linked = true;
        }}
      />
    {/if}
  </div>
</main>

<style>
  @media (prefers-reduced-motion: no-preference) {

    .consent-tile {
      animation: consent-tile 620ms var(--ease-out) 80ms backwards;
    }

    .consent-tile.from-start {
      --from: 12px;
    }

    .consent-tile.from-end {
      --from: -12px;
    }

    .consent-wire {
      animation: consent-wire 360ms var(--ease-out) 360ms backwards;
    }

    .consent-mark {
      animation: consent-mark 300ms var(--ease-out) backwards;
    }

    .consent-keys {
      animation: consent-keys 200ms var(--ease-out);
    }

    .consent-tile.joined {
      animation: consent-join 1100ms var(--ease-out) var(--join, 0ms);
    }

    .consent-tile.joined.from-start {
      --pull: -10px;
    }

    .consent-tile.joined.from-end {
      --pull: 10px;
    }

    .consent-done {
      animation: consent-done 460ms var(--ease-out) var(--d, 0ms) backwards;
    }
  }

  @keyframes consent-tile {
    from {
      opacity: 0;
      transform: translateX(var(--from));
    }
  }

  @keyframes consent-wire {
    from {
      transform: scaleX(0);
    }
  }

  @keyframes consent-mark {
    from {
      opacity: 0;
      filter: blur(4px);
      transform: scale(0.25);
    }
  }

  @keyframes consent-join {
    30% {
      translate: var(--pull) 0;
    }

    62% {
      translate: calc(var(--pull) * -0.35) 0;
    }
  }

  @keyframes consent-done {
    from {
      opacity: 0;
      filter: blur(4px);
      translate: 0 4px;
    }
  }

  @keyframes consent-keys {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
</style>
