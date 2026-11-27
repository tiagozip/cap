<script>
import { Icon } from "../../components/cap/index.js";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../components/ui/index.js";
import { watchKeyCounts } from "../../lib/live-keys.svelte.js";
import { app, navigate } from "../../lib/state.svelte.js";
import SwitchTrigger from "../../polish/shell/SwitchTrigger.svelte";
import NavPill from "../../polish/sidebar/NavPill.svelte";
import { KEY_TABS, keyTab } from "../keyTabs.js";
import UpdateNotice from "./UpdateNotice.svelte";

const LETTERS = {
  activity: "o",
  events: "e",
  protection: "p",
  configuration: "s",
};

const ICONS = {
  activity: "dashboard",
  events: "activity",
  protection: "shield",
  configuration: "settings",
};

const NAV =
  "h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] focus-visible:ring-inset text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-transparent data-active:font-normal data-active:text-foreground data-active:hover:bg-transparent data-active:active:bg-transparent [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground";

const sidebar = useSidebar();
const onKey = $derived(app.route.view === "key");
const current = $derived(
  app.keys.find((k) => k.siteKey === app.key?.siteKey) ?? app.keys[0],
);
const tab = $derived(onKey ? keyTab(app.route.tab) : null);

let switcher = $state(false);
let KeySwitcher = $state(null);
let loading;

const loadSwitcher = () => {
  loading ??= import("../../polish/shell/KeySwitcher.svelte")
    .then((m) => {
      KeySwitcher = m.default;
    })
    .catch(() => {
      loading = null;
    });
  return loading;
};

$effect(() => {
  if (switcher) loadSwitcher();
});

$effect(() => {
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  idle(loadSwitcher);
});
$effect(() => {
  if (switcher) return watchKeyCounts(10_000);
});

let leader = $state(false);
let leaderTimer;

const shortcut = (e) => {
  const key = e.key.toLowerCase();
  const was = leader;
  leader = false;
  clearTimeout(leaderTimer);
  if (
    e.defaultPrevented ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.isComposing ||
    e.target.closest?.(
      "input, textarea, select, [contenteditable]:not([contenteditable=false])",
    ) ||
    document.querySelector(
      "[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=menu][data-state=open], [role=listbox]:not([hidden])",
    )
  )
    return;
  if (was) {
    if (key !== "k" || !app.keys.length) return;
    e.preventDefault();
    switcher = true;
    return;
  }
  if (key !== "g" || e.shiftKey) return;
  leader = true;
  leaderTimer = setTimeout(() => {
    leader = false;
  }, 1200);
};

const go = (e, route) => {
  e?.preventDefault();
  navigate(route);
  sidebar.openMobile = false;
};
</script>

<svelte:window onkeydown={shortcut} onblur={() => (leader = false)} />

{#snippet hint(letter, alert = false)}
  <span class="sb-end">
    {#if alert}
      <span class="sb-alert" class:on={leader} title="Secret key needs a reset"><span class="sr-only">, secret key needs a reset</span></span>
    {/if}
    <kbd class="sb-hint" class:on={leader} aria-hidden="true">{letter.toUpperCase()}</kbd>
  </span>
{/snippet}

<SidebarHeader class="gap-3 p-0">
  <div class="flex h-9 items-center gap-2 px-2">
    <img src="./public/logo-small.webp" alt="" width="22" height="22" />
    <span class="text-[15px] font-semibold">Cap</span>
  </div>

  {#if app.keys.length}
    {#if KeySwitcher}
      <KeySwitcher
        keys={app.keys}
        {current}
        bind:open={switcher}
        hint={leader}
        tab={tab ?? "activity"}
        onpick={(k) => go(null, { view: "key", siteKey: k.siteKey, tab: tab ?? "activity" })}
        oncreate={() => (app.createKeyOpen = true)}
      />
    {:else}
      <SwitchTrigger
        name={current?.name}
        hint={leader}
        aria-haspopup="dialog"
        aria-expanded="false"
        onpointerenter={loadSwitcher}
        onfocus={loadSwitcher}
        onclick={() => (switcher = true)}
      />
    {/if}
  {/if}
</SidebarHeader>

<SidebarContent class="gap-5 p-0 pt-3">
  {#if current}
    <SidebarGroup class="p-0">
      <SidebarGroupLabel class="h-7 px-2 text-xs text-faint-foreground">Key</SidebarGroupLabel>
      <SidebarMenu class="relative gap-px">
        <NavPill active={tab} />
        {#each KEY_TABS as t (t.id)}
          <SidebarMenuItem>
            <SidebarMenuButton
              href="#/keys/{current.siteKey}/{t.id}"
              isActive={onKey && tab === t.id}
              class={NAV}
              onclick={(e) => go(e, { view: "key", siteKey: current.siteKey, tab: t.id })}
            >
              <Icon name={ICONS[t.id]} size={18} />
              <span class="flex-1">{t.label}</span>
              {@render hint(LETTERS[t.id], t.id === "configuration" && current.secretOutdated)}
            </SidebarMenuButton>
          </SidebarMenuItem>
        {/each}
      </SidebarMenu>
    </SidebarGroup>
  {:else}
    <SidebarGroup class="p-0">
      <SidebarMenu class="gap-px">
        <SidebarMenuItem>
          <SidebarMenuButton class={NAV} onclick={() => (app.createKeyOpen = true)}>
            <Icon name="plus" size={18} />
            <span>Create your first key</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  {/if}

  <SidebarGroup class="mt-auto p-0">
    <UpdateNotice />
    <SidebarMenu class="relative gap-px">
      <NavPill active={app.route.view} />
      <SidebarMenuItem>
        <SidebarMenuButton
          href="#/settings"
          isActive={app.route.view === "settings"}
          class={NAV}
          onclick={(e) => go(e, { view: "settings" })}
        >
          <Icon name="server" size={18} />
          <span class="flex-1">Instance settings</span>
          {@render hint("i")}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          href="#/api"
          isActive={app.route.view === "api"}
          class={NAV}
          onclick={(e) => go(e, { view: "api" })}
        >
          <Icon name="code" size={18} />
          <span class="flex-1">API and MCP</span>
          {@render hint("a")}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton class="{NAV} sb-docs" href="https://trycap.dev/guide/capd/" target="_blank" rel="noopener">
          <Icon name="book" size={18} />
          <span class="flex-1">Docs</span>
          <Icon name="external" size={13} class="sb-docs-arrow" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</SidebarContent>

<style>
  .sb-end {
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .sb-end > * {
    grid-area: 1 / 1;
  }

  .sb-alert {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--destructive);
  }

  .sb-alert.on {
    opacity: 0;
    scale: 0.5;
  }

  .sb-hint {
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding-inline: 4px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--muted);
    font: 500 11px/1 var(--font-sans);
    color: var(--muted-foreground);
    opacity: 0;
    scale: 0.9;
    pointer-events: none;
  }

  .sb-hint.on {
    opacity: 1;
    scale: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .sb-end {
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .sb-end > * {
    grid-area: 1 / 1;
  }

  .sb-alert {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--destructive);
  }

  .sb-alert.on {
    opacity: 0;
    scale: 0.5;
  }

  .sb-hint {
      transition:
        opacity 120ms ease-out,
        scale 120ms ease-out;
    }

    .sb-hint.on {
      transition-duration: 160ms;
      transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    :global(.sb-switcher) {
      transition: scale 160ms ease-out;
    }

    :global(.sb-switcher:active) {
      scale: 0.98;
    }

    :global(.sb-docs-arrow) {
      transition: translate 160ms ease-out;
    }

    @media (hover: hover) {
      :global(.sb-docs:hover .sb-docs-arrow) {
        translate: 1px -1px;
      }
    }
  }
</style>
