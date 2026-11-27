<script>
import { onMount, untrack } from "svelte";
import {
  Button,
  Group,
  Icon,
  PageHeader,
  Skeleton,
} from "../../components/cap/index.js";
import { api, signOut } from "../../lib/api.js";
import { samples } from "../../lib/samples.js";
import { scrollToTop } from "../../lib/utils.js";
import { unsaved } from "../../polish/instance-settings/dirty.svelte.js";
import SettingsSearch from "../../polish/instance-settings/SettingsSearch.svelte";
import Transfer from "../../polish/instance-settings/Transfer.svelte";
import Appearance from "./Appearance.svelte";
import Location from "./Location.svelte";
import Protection from "./Protection.svelte";
import ProxySignIn from "./ProxySignIn.svelte";
import Sessions from "./Sessions.svelte";
import SharedLists from "./SharedLists.svelte";
import Storage from "./Storage.svelte";
import UpdateCheck from "./UpdateCheck.svelte";
import WidgetFiles from "./WidgetFiles.svelte";

let { section } = $props();

const SECTIONS = [
  {
    id: "security",
    title: "Default protection",
    text: "Keys can override these.",
    view: Protection,
    items: [
      [
        "Challenges per visitor",
        "rate limit ratelimit throttle requests window",
      ],
      ["Only allow my websites", "cors origins domains allowed websites"],
      ["Block curl, scripts and other non-browsers", "user agent bots ua"],
      [
        "Block requests missing browser headers",
        "sec-ch-ua accept-language accept-encoding referer",
      ],
    ],
  },
  {
    id: "ipdata",
    title: "Visitor location",
    view: Location,
    items: [
      [
        "Your proxy or CDN",
        "cloudflare vercel nginx ip header x-forwarded-for real ip",
      ],
      ["Where location comes from", "country geoip asn network"],
      ["Location database", "maxmind geolite ipinfo db-ip ip database"],
    ],
  },
  {
    id: "analytics",
    title: "Data and storage",
    view: Storage,
    items: [
      ["ClickHouse database", "storage disk events"],
      ["Keep events for", "retention delete old days"],
      ["Visitor IP addresses", "privacy gdpr anonymize shorten"],
      ["Record every challenge shown", "logging log challenges"],
    ],
  },
  {
    id: "widget",
    title: "Widget files",
    view: WidgetFiles,
    items: [
      ["Serve widget files from this server", "jsdelivr cdn self-host assets"],
      ["Versions", "widget version wasm webassembly"],
    ],
  },
  {
    id: "lists",
    title: "Shared lists",
    view: SharedLists,
    items: [["Shared lists", "ip list allowlist blocklist cidr networks"]],
  },
  {
    id: "proxy",
    title: "Proxy sign-in",
    view: ProxySignIn,
    items: [
      ["Sign in through a proxy", "sso authentik authelia oidc forward auth"],
      ["Header and secret", "caddy secret header name"],
    ],
  },
  {
    id: "sessions",
    title: "Sign-in sessions",
    view: Sessions,
    items: [["Sign-in sessions", "log out sign out browsers devices"]],
  },
  {
    id: "appearance",
    title: "Appearance",
    view: Appearance,
    items: [
      ["Theme", "dark mode light mode system"],
      ["Sign-in background", "login page wallpaper image color"],
    ],
  },
  {
    id: "transfer",
    title: "Backup",
    view: Transfer,
    items: [["Settings file", "export import backup json migrate copy"]],
  },
  {
    id: "about",
    title: "About",
    items: [["About", "version bun updates upgrade release"]],
  },
];

let about = $state(null);
let current = $state(untrack(() => section) ?? "security");
let lock = null;
let flash = $state(null);
let generation = $state(0);
let flashTimer = null;
const index = $derived(SECTIONS.findIndex((s) => s.id === current));

const hold = (id) => {
  clearTimeout(lock);
  lock = setTimeout(() => {
    lock = null;
  }, 1200);
  current = id;
  history.replaceState(null, "", `#/settings/${id}`);
};

const smooth = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

const jump = (id, label) => {
  hold(id);
  const box = document.getElementById(`settings-${id}`);
  const hit =
    box &&
    label !== SECTIONS.find((s) => s.id === id)?.title &&
    [...box.querySelectorAll("label, p, dt, th, span")].find(
      (el) => el.textContent.trim() === label,
    );
  let row = hit;
  while (row && !row.parentElement?.classList.contains("divide-y"))
    row = row.parentElement;
  row ||= hit;
  if (!row || !box.contains(row)) {
    scrollToTop(box, true);
    return;
  }
  row.scrollIntoView({
    block: "center",
    behavior: smooth() ? "smooth" : "auto",
  });
  if (matchMedia("(pointer: fine)").matches)
    row
      .querySelector(
        "input:not([type=hidden]), button, [role=switch], select, textarea, a[href]",
      )
      ?.focus({ preventScroll: true });
  const body = document.getElementById("settingsBody").getBoundingClientRect();
  const r = row.getBoundingClientRect();
  clearTimeout(flashTimer);
  flash = {
    key: Date.now(),
    top: r.top - body.top,
    left: r.left - body.left - 8,
    width: r.width + 16,
    height: r.height,
  };
  flashTimer = setTimeout(() => {
    flash = null;
  }, 1600);
};

api("GET", "/about").then((r) => {
  if (r?.ver) about = r;
});

onMount(() => {
  const root = document.getElementById("main");
  const target = section && document.getElementById(`settings-${section}`);
  const pin = new ResizeObserver(() => scrollToTop(target));
  const unpin = () => pin.disconnect();
  if (target) {
    pin.observe(document.getElementById("settingsBody"));
    setTimeout(() => pin.disconnect(), 1500);
    root.addEventListener("wheel", unpin, { once: true });
  }
  const seen = new Map();
  const spy = () => {
    if (lock) return;
    if (
      root.scrollTop > 0 &&
      root.scrollTop + root.clientHeight >= root.scrollHeight - 4
    ) {
      current = SECTIONS.at(-1).id;
      return;
    }
    const first = SECTIONS.find((s) => seen.get(`settings-${s.id}`));
    if (first) current = first.id;
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      spy();
    },
    { root, rootMargin: "-96px 0px -55% 0px" },
  );
  const release = () => {
    clearTimeout(lock);
    lock = null;
  };
  root.addEventListener("scroll", spy, { passive: true });
  root.addEventListener("scrollend", release);
  root.addEventListener("wheel", release, { passive: true });
  for (const s of SECTIONS) {
    const el = document.getElementById(`settings-${s.id}`);
    if (el) io.observe(el);
  }
  return () => {
    root.removeEventListener("scroll", spy);
    root.removeEventListener("scrollend", release);
    root.removeEventListener("wheel", release);
    root.removeEventListener("wheel", unpin);
    clearTimeout(lock);
    clearTimeout(flashTimer);
    io.disconnect();
    pin.disconnect();
  };
});
</script>

{#snippet signOutAction()}
  <Button onclick={() => signOut({ revoke: true })}>
    <Icon name="logout" size={14} />
    Sign out
  </Button>
{/snippet}

<PageHeader title="Instance settings" />

<div id="settingsBody" class="relative flex items-start gap-10 px-4 pt-5 pb-12 max-lg:flex-col max-lg:gap-5 md:px-5">
  {#if flash}
    {#key flash.key}
      <span
        aria-hidden="true"
        class="flash pointer-events-none absolute rounded-lg bg-primary/8"
        style="top: {flash.top}px; left: {flash.left}px; width: {flash.width}px; height: {flash.height}px"
      ></span>
    {/key}
  {/if}
  <nav class="w-44 shrink-0 max-lg:w-full lg:sticky lg:top-16" aria-label="Settings sections">
    <SettingsSearch sections={SECTIONS} onpick={jump}>
      <ul class="relative flex flex-col gap-0.5 max-lg:hidden">
        <span
          aria-hidden="true"
          class="nav-mark pointer-events-none absolute inset-x-0 top-0 h-8 rounded-md bg-nav-active"
          style="transform: translateY({index * 34}px)"
        ></span>
        {#each SECTIONS as s (s.id)}
          <li>
            <a
              href="#/settings/{s.id}"
              aria-current={current === s.id ? "true" : undefined}
              class="relative flex h-8 items-center rounded-md px-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring {current === s.id
                ? 'text-foreground'
                : 'text-muted-foreground [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground'}"
              onclick={(e) => {
                e.preventDefault();
                hold(s.id);
                scrollToTop(document.getElementById(`settings-${s.id}`), true);
              }}
            >
              {s.title}
              {#if unsaved.has(s.id)}
                <span class="unsaved ms-auto size-1.5 rounded-full bg-primary" aria-hidden="true"></span>
                <span class="sr-only">, unsaved changes</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </SettingsSearch>
  </nav>

  <div class="flex max-w-3xl min-w-0 flex-1 flex-col gap-6 max-lg:w-full">
    {#each SECTIONS as s (s.id)}
      <div id="settings-{s.id}" class="scroll-mt-16">
        <Group id="settings-{s.id}-title" title={s.title} description={s.text} action={s.id === "sessions" ? signOutAction : undefined}>
          {#if s.view}
            {#key s.id === "transfer" ? 0 : generation}
              <s.view onapplied={() => generation++} />
            {/key}
          {:else}
            <Skeleton data={about} sample={samples.about} label="Loading version details">
              {#snippet children(a)}
                <dl class="grid grid-cols-[8rem_1fr] gap-y-2 py-4 text-sm">
                  <dt class="text-muted-foreground">Cap</dt>
                  <dd class="tabular-nums">v{a.ver}</dd>
                  <dt class="text-muted-foreground">Bun</dt>
                  <dd class="tabular-nums">v{a.bun}</dd>
                  <UpdateCheck />
                </dl>
              {/snippet}
            </Skeleton>
          {/if}
        </Group>
      </div>
    {/each}
  </div>
</div>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .nav-mark {
      transition: transform var(--tabs-duration) var(--tabs-ease);
      will-change: transform;
    }
    .unsaved {
      animation: unsaved-in 240ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .flash {
      animation: flash 1.6s cubic-bezier(0.23, 1, 0.32, 1) both;
    }
  }
  @keyframes unsaved-in {
    from {
      opacity: 0;
      transform: scale(0.25);
    }
  }
  @keyframes flash {
    0% {
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    55% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
