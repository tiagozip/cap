<script>
import { onMount } from "svelte";
import { Button, Empty, Spinner } from "./components/cap/index.js";
import NotchFilter from "./components/cap/NotchFilter.svelte";
import Toasts from "./components/Toasts.svelte";
import {
  Sidebar as KSidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/index.js";
import { app, init, navigate } from "./lib/state.svelte.js";
import { palette, pushRecent } from "./lib/ui.svelte.js";
import KeyDetail from "./views/KeyDetail.svelte";
import { keyTab } from "./views/keyTabs.js";
import Sidebar from "./views/shell/Sidebar.svelte";

const LAZY = {
  settings: () => import("./views/settings/Settings.svelte"),
  api: () => import("./views/api/Api.svelte"),
  home: () => import("./views/shell/Home.svelte"),
  createKey: () => import("./views/CreateKey.svelte"),
};
const views = $state({});
const failed = $state({});
const requested = {};
const want = (name) => {
  requested[name] ??= LAZY[name]().then(
    (m) => {
      failed[name] = false;
      views[name] = m.default;
    },
    () => {
      delete requested[name];
      failed[name] = true;
    },
  );
};
const Consent = () => import("./views/api/Consent.svelte");
const Palette = () => import("./polish/global/Palette.svelte");
const Shortcuts = () => import("./polish/global/Shortcuts.svelte");

init();

const onKey = $derived(app.route.view === "key" && !!app.key);
const loading = $derived(
  !app.ready || (app.route.view === "key" && app.loadingKey && !app.key),
);
const screen = $derived(
  loading
    ? "loading"
    : app.route.view in LAZY
      ? views[app.route.view]
        ? app.route.view
        : "pending"
      : onKey
        ? "key"
        : views.home
          ? "home"
          : "pending-home",
);

$effect(() => {
  const r = app.route;
  if (r.view === "key" && app.key?.siteKey === r.siteKey)
    pushRecent(`key:${r.siteKey}:${keyTab(r.tab)}`);
  else if (r.view === "settings")
    pushRecent(`settings:${r.section ?? "security"}`);
  else if (r.view === "api") pushRecent("view:api");
});

$effect(() => {
  if (app.route.view in LAZY) want(app.route.view);
  if (screen === "home" || screen === "pending-home") want("home");
  if (app.createKeyOpen) want("createKey");
});

const TOP = 52;
let main = $state();
let bar = $state({ top: TOP, height: 0 });
let dragging = $state(false);

const sync = () => {
  if (!main) return;
  const { scrollTop, scrollHeight, clientHeight } = main;
  const track = clientHeight - TOP - 6;
  if (scrollHeight <= clientHeight + 1 || track <= 0) {
    bar = { top: TOP, height: 0 };
    return;
  }
  const height = Math.max(32, (track * clientHeight) / scrollHeight);
  bar = {
    top: TOP + ((track - height) * scrollTop) / (scrollHeight - clientHeight),
    height,
  };
};

onMount(() => {
  let frame = 0;
  const queue = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sync);
  };
  const ro = new ResizeObserver(queue);
  ro.observe(main);
  const mo = new MutationObserver(queue);
  mo.observe(main, { childList: true, subtree: true });
  queue();
  return () => {
    ro.disconnect();
    mo.disconnect();
    cancelAnimationFrame(frame);
  };
});

let paletteMounted = $state(false);
let shortcutsMounted = $state(false);
let chord = null;
let chordTimer;

$effect(() => {
  if (!app.ready) return;
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  idle(() => {
    paletteMounted = true;
    for (const name in LAZY) want(name);
  });
});

$effect(() => {
  if (palette.open) paletteMounted = true;
  if (palette.shortcuts) shortcutsMounted = true;
});

const GO = {
  o: "activity",
  e: "events",
  p: "protection",
  s: "configuration",
  i: "settings",
  a: "api",
};

const go = (target) => {
  if (target === "settings" || target === "api") {
    navigate({ view: target });
    return;
  }
  const siteKey = app.key?.siteKey ?? app.keys[0]?.siteKey;
  if (siteKey) navigate({ view: "key", siteKey, tab: target });
};

const focusSearch = () => {
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById("evSearch");
    if (el) return el.focus();
    if (++tries < 60) requestAnimationFrame(attempt);
  };
  if (!document.getElementById("evSearch")) go("events");
  attempt();
};

const onKeydown = (e) => {
  if (!app.ready || app.route.view === "oauth") return;
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && key === "k") {
    e.preventDefault();
    palette.shortcuts = false;
    palette.open = !palette.open;
    return;
  }
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
  ) {
    chord = null;
    return;
  }
  if (chord === "g") {
    chord = null;
    clearTimeout(chordTimer);
    if (GO[key]) {
      e.preventDefault();
      go(GO[key]);
    }
    return;
  }
  if (e.key === "?") {
    e.preventDefault();
    palette.shortcuts = true;
  } else if (e.key === "/") {
    e.preventDefault();
    focusSearch();
  } else if (key === "g" && !e.shiftKey) {
    chord = "g";
    clearTimeout(chordTimer);
    chordTimer = setTimeout(() => {
      chord = null;
    }, 1200);
  } else if (key === "c" && !e.shiftKey && !app.createKeyOpen) {
    e.preventDefault();
    app.createKeyOpen = true;
  }
};

const grab = (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  dragging = true;
  const startY = e.clientY;
  const startTop = main.scrollTop;
  const ratio =
    (main.scrollHeight - main.clientHeight) /
    (main.clientHeight - TOP - 6 - bar.height);
  const move = (ev) => {
    main.scrollTop = startTop + (ev.clientY - startY) * ratio;
  };
  const up = () => {
    dragging = false;
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
};
</script>

<svelte:window onkeydown={onKeydown} />

<a
  class="fixed start-3 top-3 z-[200] -translate-y-24 rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-overlay focus-visible:translate-y-0 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]"
  href="#main">Skip to content</a>

<NotchFilter />

{#if app.route.view === "oauth"}
  {#key app.route.id}
    {#await Consent() then { default: View }}<View id={app.route.id} />{/await}
  {/key}
{:else}
<SidebarProvider class="h-dvh min-h-0 text-foreground" style="--sidebar-width: 15rem;">
  <KSidebar variant="inset" label="Main">
    {#if app.ready}
      <Sidebar />
    {:else}
      <SidebarHeader class="gap-3 p-0">
        <div class="flex h-9 items-center gap-2 px-2">
          <img src="./public/logo-small.webp" alt="" width="22" height="22" />
          <span class="text-[15px] font-semibold">Cap</span>
        </div>
      </SidebarHeader>
      <div class="cap-view-pending flex flex-col px-2 pt-[0.875rem]" aria-hidden="true">
        <span class="sk-bone h-5 w-32"></span>
        <span class="sk-bone mt-[1.375rem] mb-[0.6875rem] h-3 w-8"></span>
        {#each [20, 16, 22, 18] as w}
          <span class="flex h-[2.3125rem] items-center gap-2.5">
            <span class="sk-bone size-4"></span>
            <span class="sk-bone h-3" style:width="{w * 0.25}rem"></span>
          </span>
        {/each}
      </div>
    {/if}
  </KSidebar>

  <SidebarInset class="min-h-0 overflow-hidden md:peer-data-[variant=inset]:shadow-none">
    <div id="main" tabindex="-1" bind:this={main} onscroll={sync} class="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
    <div class="flex flex-1 flex-col [&>*]:shrink-0">
    {#if loading || screen.startsWith("pending")}
      <header class="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:hidden">
        <SidebarTrigger label="Open menu" />
      </header>
      {@const lazy = app.route.view in LAZY ? app.route.view : "home"}
      {#if !loading && failed[lazy]}
        <div class="grid flex-1 place-items-center p-6">
          <Empty title="Couldn't load this page">
            Check your connection, then reload. If capd was just updated, a reload picks up the new version.
            {#snippet action()}
              <Button onclick={() => location.reload()}>Reload</Button>
            {/snippet}
          </Empty>
        </div>
      {:else}
        <div class="cap-view-pending grid flex-1 place-items-center" role="status">
          <Spinner label={loading ? "Loading dashboard" : "Loading page"} />
        </div>
      {/if}
    {:else if screen === "settings"}
      <views.settings section={app.route.section} />
    {:else if screen === "api"}
      <views.api />
    {:else if onKey}
      <KeyDetail />
    {:else}
      <views.home />
    {/if}
    </div>
    </div>
    {#if bar.height}
      <div
        class="group absolute end-0.5 z-30 hidden w-3 cursor-default touch-none md:flex md:justify-center"
        style:top="{bar.top}px"
        style:height="{bar.height}px"
        onpointerdown={grab}
        aria-hidden="true"
      >
        <span class="w-1.5 rounded-full bg-foreground/20 transition-[width,background-color] duration-150 ease-out group-hover:w-2 group-hover:bg-foreground/35 {dragging ? 'w-2 bg-foreground/45' : ''}"></span>
      </div>
    {/if}
    <div class="pointer-events-none absolute inset-0 z-50 hidden rounded-[inherit] shadow-[inset_0_0_0_1px_var(--border)] md:block" aria-hidden="true"></div>
  </SidebarInset>
</SidebarProvider>
{/if}

{#if app.createKeyOpen && views.createKey}
  <views.createKey />
{/if}
<Toasts />
{#if paletteMounted}
  {#await Palette() then { default: View }}<View />{/await}
{/if}
{#if shortcutsMounted}
  {#await Shortcuts() then { default: View }}<View />{/await}
{/if}
