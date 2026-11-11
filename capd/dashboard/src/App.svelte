<script>
import { onMount } from "svelte";
import { Spinner } from "./components/cap/index.js";
import NotchFilter from "./components/cap/NotchFilter.svelte";
import Toasts from "./components/Toasts.svelte";
import {
  Sidebar as KSidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/index.js";
import { t } from "./lib/i18n.svelte.js";
import { app, init } from "./lib/state.svelte.js";
import CreateKey from "./views/CreateKey.svelte";
import KeyDetail from "./views/KeyDetail.svelte";
import Settings from "./views/settings/Settings.svelte";
import Home from "./views/shell/Home.svelte";
import Sidebar from "./views/shell/Sidebar.svelte";

init();

const onKey = $derived(app.route.view === "key" && !!app.key);

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

<a
  class="fixed start-3 -top-24 z-[200] rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-overlay transition-[top] duration-150 focus-visible:top-3"
  href="#main">{t("Skip to content")}</a>

<NotchFilter />

<SidebarProvider class="h-dvh min-h-0 text-foreground" style="--sidebar-width: 15rem;">
  <KSidebar variant="inset" label={t("Main")}>
    {#if app.ready}<Sidebar />{/if}
  </KSidebar>

  <SidebarInset class="min-h-0 overflow-hidden md:peer-data-[variant=inset]:shadow-none">
    <div id="main" tabindex="-1" bind:this={main} onscroll={sync} class="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
    {#if !app.ready || (app.route.view === "key" && app.loadingKey && !app.key)}
      <header class="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-2 md:hidden">
        <SidebarTrigger label={t("Open menu")} />
      </header>
      <div class="grid flex-1 place-items-center" role="status">
        <Spinner label={t("Loading dashboard")} />
      </div>
    {:else if app.route.view === "settings"}
      <Settings section={app.route.section} />
    {:else if onKey}
      <KeyDetail />
    {:else}
      <Home />
    {/if}
    </div>
    {#if bar.height}
      <div
        class="group absolute end-0.5 z-30 hidden w-3 cursor-default touch-none md:flex md:justify-center"
        style:top="{bar.top}px"
        style:height="{bar.height}px"
        onpointerdown={grab}
        aria-hidden="true"
      >
        <span class="w-1.5 rounded-full bg-foreground/20 transition-[width] duration-150 group-hover:w-2 group-hover:bg-foreground/35 {dragging ? 'w-2 bg-foreground/45' : ''}"></span>
      </div>
    {/if}
    <div class="pointer-events-none absolute inset-0 z-50 hidden rounded-[inherit] shadow-[inset_0_0_0_1px_var(--border)] md:block" aria-hidden="true"></div>
  </SidebarInset>
</SidebarProvider>

{#if app.createKeyOpen}
  <CreateKey />
{/if}
<Toasts />
