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
import { t } from "../../lib/i18n.svelte.js";
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
      title: t("Sign out this browser?"),
      message: t(
        "The browser using session {token} will have to sign in again.",
        { token: s.token },
      ),
      confirmText: t("Sign out browser"),
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
    toast(t(res.error || "Couldn't sign out that browser"), "error");
    return;
  }
  sessions = sessions.filter((x) => x.token !== s.token);
  toast(t("Browser signed out"));
};
</script>

<Skeleton data={sessions} sample={samples.sessions} {error} empty={sessions?.length === 0} label={t("Loading sessions")}>
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{t(error)}</p>
  {/snippet}
  {#snippet emptyMessage()}
    <Empty title={t("No one is signed in")}>
      {t("Browsers show up here after someone signs in with the admin key.")}
    </Empty>
  {/snippet}
  {#snippet children(rows)}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("Browser")}</TableHead>
          <TableHead>{t("Signs out in")}</TableHead>
          <TableHead class="w-10"><span class="sr-only">{t("Actions")}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each rows as s (s.token)}
          {@const current = isCurrent(s)}
          <TableRow>
            <TableCell>
              <span class="flex items-center gap-2">
                {#if current}<span class="font-medium">{t("This browser")}</span>{/if}
                <code class="font-mono text-sm {current ? 'text-muted-foreground' : ''}">{s.token}</code>
                {#if current}<Tag tone="brand">{t("Current")}</Tag>{/if}
              </span>
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">{until(Date.parse(s.expires))}</TableCell>
            <TableCell class="text-end">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === s.token}
                aria-label={current ? t("Sign out of this browser") : t("Sign out session {token}", { token: s.token })}
                onclick={() => revoke(s)}
              >
                {t("Sign out")}
              </Button>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
  </Table>
  {/snippet}
</Skeleton>
