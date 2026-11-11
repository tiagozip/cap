<script>
import { onMount, untrack } from "svelte";
import { Group, PageHeader, Skeleton } from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { t } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { scrollToTop } from "../../lib/utils.js";
import ApiKeys from "./ApiKeys.svelte";
import Appearance from "./Appearance.svelte";
import Location from "./Location.svelte";
import Protection from "./Protection.svelte";
import ProxySignIn from "./ProxySignIn.svelte";
import Sessions from "./Sessions.svelte";
import SharedLists from "./SharedLists.svelte";
import Storage from "./Storage.svelte";
import WidgetFiles from "./WidgetFiles.svelte";

let { section } = $props();

const SECTIONS = $derived([
  {
    id: "security",
    title: t("Default protection"),
    text: t("A key's own settings win over these."),
    view: Protection,
  },
  {
    id: "ipdata",
    title: t("Visitor location"),
    view: Location,
  },
  {
    id: "analytics",
    title: t("Data and storage"),
    view: Storage,
  },
  {
    id: "widget",
    title: t("Widget files"),
    view: WidgetFiles,
  },
  {
    id: "lists",
    title: t("Shared lists"),
    view: SharedLists,
  },
  {
    id: "apikeys",
    title: t("API keys"),
    view: ApiKeys,
  },
  {
    id: "proxy",
    title: t("Proxy sign-in"),
    view: ProxySignIn,
  },
  {
    id: "sessions",
    title: t("Sign-in sessions"),
    view: Sessions,
  },
  {
    id: "appearance",
    title: t("Appearance"),
    view: Appearance,
  },
  {
    id: "about",
    title: t("About"),
  },
]);

let about = $state(null);
let current = $state(untrack(() => section) ?? "security");

api("GET", "/about").then((r) => {
  if (r?.ver) about = r;
});

onMount(() => {
  const root = document.getElementById("main");
  const target = section && document.getElementById(`settings-${section}`);
  const pin = new ResizeObserver(() => scrollToTop(target));
  if (target) {
    pin.observe(document.getElementById("settingsBody"));
    setTimeout(() => pin.disconnect(), 1500);
    root.addEventListener("wheel", () => pin.disconnect(), { once: true });
  }
  const seen = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = SECTIONS.find((s) => seen.get(`settings-${s.id}`));
      if (first) current = first.id;
    },
    { root, rootMargin: "-96px 0px -55% 0px" },
  );
  for (const s of SECTIONS) {
    const el = document.getElementById(`settings-${s.id}`);
    if (el) io.observe(el);
  }
  return () => {
    io.disconnect();
    pin.disconnect();
  };
});
</script>

<PageHeader title={t("Instance settings")} />

<div id="settingsBody" class="flex items-start gap-10 px-4 pt-5 pb-12 md:px-5">
  <nav class="sticky top-16 w-44 shrink-0 max-lg:hidden" aria-label={t("Settings sections")}>
    <ul class="flex flex-col gap-0.5">
      {#each SECTIONS as s (s.id)}
        <li>
          <a
            href="#/settings/{s.id}"
            aria-current={current === s.id ? "true" : undefined}
            class="flex h-8 items-center rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring {current === s.id
              ? 'bg-nav-active font-medium text-foreground'
              : 'text-muted-foreground [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground'}"
            onclick={(e) => {
              e.preventDefault();
              history.replaceState(null, "", `#/settings/${s.id}`);
              scrollToTop(document.getElementById(`settings-${s.id}`), true);
            }}
          >
            {s.title}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <div class="flex max-w-3xl min-w-0 flex-1 flex-col gap-6">
    {#each SECTIONS as s (s.id)}
      <div id="settings-{s.id}" class="scroll-mt-16">
        <Group id="settings-{s.id}-title" title={s.title} description={s.text}>
          {#if s.view}
            <s.view />
          {:else}
            <Skeleton data={about} sample={samples.about} label={t("Loading version details")}>
              {#snippet children(a)}
                <dl class="grid grid-cols-[8rem_1fr] gap-y-2 py-4 text-sm">
                  <dt class="text-muted-foreground">Cap</dt>
                  <dd class="tabular-nums">v{a.ver}</dd>
                  <dt class="text-muted-foreground">Bun</dt>
                  <dd class="tabular-nums">v{a.bun}</dd>
                </dl>
              {/snippet}
            </Skeleton>
          {/if}
        </Group>
      </div>
    {/each}
  </div>
</div>
