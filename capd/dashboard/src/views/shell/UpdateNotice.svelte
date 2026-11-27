<script>
import { cubicOut } from "svelte/easing";
import { Icon } from "../../components/cap/index.js";
import { api } from "../../lib/api.js";

let notices = $state(null);
let dismissed = $state(null);

try {
  dismissed = localStorage.getItem("cap_dismissed_update");
} catch {}

api("GET", "/settings/updates").then((r) => {
  if (r && "advisories" in r) notices = r;
});

const advisory = $derived(notices?.advisories?.[0] ?? null);
const update = $derived(
  !advisory && notices?.latest && notices.latest.version !== dismissed
    ? notices.latest
    : null,
);

const settle = (_node, { out = false } = {}) =>
  matchMedia("(prefers-reduced-motion: no-preference)").matches
    ? {
        duration: out ? 160 : 320,
        easing: cubicOut,
        css: (t, u) =>
          `opacity: ${t}; transform: translateY(${u * (out ? 2 : 6)}px); filter: blur(${u * 4}px)`,
      }
    : { duration: 0 };

const dismiss = () => {
  dismissed = update.version;
  try {
    localStorage.setItem("cap_dismissed_update", update.version);
  } catch {}
};
</script>

{#if advisory}
  <div class="mb-2 flex flex-col gap-1.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-[13px] ring-1 ring-destructive/30" role="status">
    <p class="flex items-center gap-1.5 font-medium text-destructive">
      <Icon name="shield" size={14} />
      {notices.advisories.length === 1 ? "Security fix available" : `${notices.advisories.length} security fixes available`}
    </p>
    <p class="text-pretty text-muted-foreground">
      {advisory.summary}. {advisory.fixedIn ? `Update to ${advisory.fixedIn} or later.` : `It affects capd ${notices.version}.`}
    </p>
    <a class="self-start text-foreground underline decoration-border underline-offset-4 [text-underline-position:from-font] [@media(hover:hover)]:hover:decoration-muted-foreground" href={advisory.url} target="_blank" rel="noopener">Read the advisory</a>
  </div>
{:else if update}
  <div class="mb-2 flex flex-col gap-1 rounded-lg bg-sidebar-accent/60 px-3 py-2.5 text-[13px] ring-1 ring-border" role="status">
    <div class="flex items-start justify-between gap-2">
      <p class="font-medium">capd {update.version} is out</p>
      <button type="button" class="-me-1 -mt-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-faint-foreground [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground" aria-label="Dismiss update notice" onclick={dismiss}>
        <Icon name="x" size={13} />
      </button>
    </div>
    <p class="text-muted-foreground">You're on {notices.version}.</p>
    <a class="self-start text-foreground underline decoration-border underline-offset-4 [text-underline-position:from-font] [@media(hover:hover)]:hover:decoration-muted-foreground" href={update.url} target="_blank" rel="noopener">See what's new</a>
  </div>
{/if}
