<script>
import { ago, compact } from "../../lib/format.js";
import { t } from "../../lib/i18n.svelte.js";
import { openEvents } from "../../lib/state.svelte.js";

let { rows } = $props();
</script>

{#if !rows.length}
  <p class="m-auto max-w-72 py-8 text-center text-sm text-balance text-muted-foreground">{t("No browser showed up from three or more IP addresses in this period.")}</p>
{:else}
  <div class="-mx-2 overflow-x-auto">
    <table class="w-full min-w-[34rem] text-sm">
      <thead>
        <tr class="text-left text-[11px] text-muted-foreground">
          <th class="px-2 pb-1.5 font-medium">{t("Browser")}</th>
          <th class="w-20 px-2 pb-1.5 text-end font-medium">{t("Events")}</th>
          <th class="w-20 px-2 pb-1.5 text-end font-medium">{t("IPs")}</th>
          <th class="w-20 px-2 pb-1.5 text-end font-medium">{t("Networks")}</th>
          <th class="w-20 px-2 pb-1.5 text-end font-medium">{t("Countries")}</th>
          <th class="w-24 px-2 pb-1.5 text-end font-medium">{t("Flagged")}</th>
          <th class="w-24 px-2 pb-1.5 text-end font-medium">{t("Last seen")}</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as r (r.fp)}
          {@const bad = r.flagged + r.blocked}
          <tr class="group cursor-pointer [@media(hover:hover)]:hover:bg-nav-hover" onclick={() => openEvents([`fp:${r.fp}`])}>
            <td class="rounded-s-md px-2 py-1.5">
              <button type="button" class="flex cursor-pointer flex-col items-start text-left outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring" onclick={(e) => (e.stopPropagation(), openEvents([`fp:${r.fp}`]))}>
                <span>{t("{browser} on {os}", { browser: r.browser || t("Unknown"), os: r.os || t("unknown") })}</span>
                <span class="text-xs text-muted-foreground tabular-nums">{r.fp}</span>
              </button>
            </td>
            <td class="px-2 py-1.5 text-end tabular-nums">{compact(r.n)}</td>
            <td class="px-2 py-1.5 text-end font-medium tabular-nums">{r.ips}</td>
            <td class="px-2 py-1.5 text-end tabular-nums">{r.networks}</td>
            <td class="px-2 py-1.5 text-end tabular-nums">{r.countries}</td>
            <td class="px-2 py-1.5 text-end tabular-nums {bad / r.n >= 0.25 ? 'font-medium text-destructive' : 'text-muted-foreground'}">{bad ? `${Math.round((bad / r.n) * 100)}%` : ""}</td>
            <td class="rounded-e-md px-2 py-1.5 text-end text-muted-foreground tabular-nums">{ago(r.last)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="mt-3 border-t border-border pt-3 text-sm text-pretty text-muted-foreground">{t("The same browser fingerprint behind many addresses usually means one bot rotating proxies. Pick one to see its events.")}</p>
{/if}
