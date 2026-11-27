<script>
import {
  Button,
  Empty,
  Icon,
  Skeleton,
  Tag,
} from "../../components/cap/index.js";
import { api, signOut } from "../../lib/api.js";
import { ago, fullFmt, until } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import { toast, undoable } from "../../lib/ui.svelte.js";
import { device } from "../../polish/instance-settings/device.js";
import { leave } from "../../polish/settings-b/motion.js";

let sessions = $state(null);
let error = $state("");
let busy = $state(null);

const currentHash = (() => {
  try {
    return JSON.parse(localStorage.getItem("cap_auth"))?.hash || "";
  } catch {
    return "";
  }
})();
const isCurrent = (s) => !!currentHash && currentHash.endsWith(s.token);

api("GET", "/settings/sessions").then((r) => {
  if (!Array.isArray(r)) {
    error = r?.error || "Couldn't load sessions";
    return;
  }
  sessions = r.toSorted((a, b) => isCurrent(b) - isCurrent(a));
});

const others = $derived(sessions?.filter((s) => !isCurrent(s)) ?? []);

const details = (s) => {
  const parts = [];
  if (s.seen) parts.push(`active ${ago(Date.parse(s.seen))}`);
  else if (s.created) parts.push(`signed in ${ago(Date.parse(s.created))}`);
  parts.push(`signs out in ${until(Date.parse(s.expires))}`);
  const text = parts.join(", ");
  return s.country ? text : text.charAt(0).toUpperCase() + text.slice(1);
};

const stamp = (s) =>
  [
    s.created && `Signed in ${fullFmt.format(new Date(s.created))}`,
    s.seen && `Last active ${fullFmt.format(new Date(s.seen))}`,
    `Signs out ${fullFmt.format(new Date(s.expires))}`,
  ]
    .filter(Boolean)
    .join("\n");

const revokeOthers = async () => {
  const gone = others;
  if (!gone.length) return;
  const before = sessions;
  await Promise.all(gone.map((s) => leave(rowOf(s))));
  const tokens = new Set(gone.map((s) => s.token));
  sessions = sessions.filter((s) => !tokens.has(s.token));
  undoable({
    message:
      gone.length === 1
        ? "Signed out 1 other browser"
        : `Signed out ${gone.length} other browsers`,
    commit: async () => {
      const results = await Promise.all(
        gone.map((s) => api("POST", "/logout", { session: s.token })),
      );
      const failed = gone.filter(
        (_, i) => results[i]?.success === false || results[i]?.error,
      );
      if (!failed.length) return null;
      const kept = new Set(failed.map((s) => s.token));
      sessions = before.filter(
        (s) => kept.has(s.token) || sessions.some((x) => x.token === s.token),
      );
      return failed.length === gone.length
        ? "Couldn't sign out those browsers"
        : `Couldn't sign out ${failed.length} of them`;
    },
    undo: async () => {
      const now = new Set(sessions.map((s) => s.token));
      sessions = before.filter((s) => now.has(s.token) || tokens.has(s.token));
    },
  });
};

const rowOf = (s) =>
  document.querySelector(`[data-session="${CSS.escape(s.token)}"]`);

const revoke = async (s) => {
  const current = isCurrent(s);
  if (!current) {
    await leave(rowOf(s));
    const at = sessions.indexOf(s);
    if (at < 0) return;
    sessions = sessions.filter((x) => x.token !== s.token);
    undoable({
      message: "Browser signed out",
      commit: async () => {
        const res = await api("POST", "/logout", { session: s.token });
        return res?.success === false || res?.error
          ? res.error || "Couldn't sign out that browser"
          : null;
      },
      undo: async () => {
        sessions = sessions.toSpliced(at, 0, s);
      },
    });
    return;
  }
  busy = s.token;
  const res = await api("POST", "/logout", { session: s.token });
  busy = null;
  if (current) {
    signOut();
    return;
  }
  if (res?.success === false || res?.error) {
    toast(res.error || "Couldn't sign out that browser", "error");
    return;
  }
  sessions = sessions.filter((x) => x.token !== s.token);
  toast("Browser signed out");
};
</script>

<Skeleton data={sessions} sample={samples.sessions} {error} empty={sessions?.length === 0} label="Loading sessions">
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{error}</p>
  {/snippet}
  {#snippet emptyMessage()}
    <Empty title="No one is signed in">
      Browsers show up here after someone signs in with the admin key.
    </Empty>
  {/snippet}
  {#snippet children(rows)}
    <ul class="flex flex-col divide-y divide-border" aria-label="Signed-in browsers">
      {#each rows as s (s.token)}
        {@const current = isCurrent(s)}
        {@const d = device(s)}
        {@const flag = flagUrl(s.country)}
        <li data-session={s.token} class="flex items-center gap-3 py-3.5">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
            {#if d?.phone}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
            {:else}
              <Icon name="monitor" size={16} />
            {/if}
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <p class="flex min-w-0 items-center gap-2 text-sm font-medium">
              {#if d}
                <span class="truncate">{d.name}</span>
              {:else}
                <code class="truncate font-mono text-sm">{s.token}</code>
              {/if}
              {#if current}<Tag tone="brand">This browser</Tag>{/if}
            </p>
            <p class="min-w-0 text-sm text-muted-foreground tabular-nums" title={stamp(s)}>
              {#if s.country}
                <span class="whitespace-nowrap">{#if flag}<img src={flag} alt="" width="16" height="12" class="me-1.5 inline-block h-3 w-4 rounded-[2px] object-cover align-[-1px] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />{/if}{countryName(s.country.toUpperCase())},</span>
              {/if}
              {details(s)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy === s.token}
            aria-label={current ? "Sign out of this browser" : `Sign out ${d?.name ?? "session"} ${s.token}`}
            onclick={() => revoke(s)}
          >
            {busy === s.token ? "Signing out" : "Sign out"}
          </Button>
        </li>
      {/each}
    </ul>
    {#if others.length > 1}
      <div class="flex justify-end py-4">
        <Button onclick={revokeOthers}>Sign out other browsers</Button>
      </div>
    {/if}
  {/snippet}
</Skeleton>
