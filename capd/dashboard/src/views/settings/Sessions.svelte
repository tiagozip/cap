<script>
import {
  Button,
  Empty,
  Skeleton,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { api, signOut } from "../../lib/api.js";
import { until } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { confirm, toast } from "../../lib/ui.svelte.js";

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

const revoke = async (s) => {
  const current = isCurrent(s);
  if (!current) {
    const ok = await confirm({
      title: "Sign out this browser?",
      message: `The browser using session ${s.token} will have to sign in again.`,
      confirmText: "Sign out browser",
      danger: true,
    });
    if (!ok) return;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Browser</TableHead>
          <TableHead>Signs out in</TableHead>
          <TableHead class="w-10"><span class="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each rows as s (s.token)}
          {@const current = isCurrent(s)}
          <TableRow>
            <TableCell>
              <span class="flex items-center gap-2">
                {#if current}<span class="font-medium">This browser</span>{/if}
                <code class="font-mono text-sm {current ? 'text-muted-foreground' : ''}">{s.token}</code>
                {#if current}<Tag tone="brand">Current</Tag>{/if}
              </span>
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">{until(Date.parse(s.expires))}</TableCell>
            <TableCell class="text-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === s.token}
                aria-label={current ? "Sign out of this browser" : `Sign out session ${s.token}`}
                onclick={() => revoke(s)}
              >
                Sign out
              </Button>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
  </Table>
  {/snippet}
</Skeleton>
