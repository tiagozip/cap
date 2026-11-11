<script>
import {
  Button,
  Empty,
  Icon,
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
import { api } from "../../lib/api.js";
import { ago } from "../../lib/format.js";
import { t, tp, tx } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { confirm, toast } from "../../lib/ui.svelte.js";
import CreateApiKey from "./CreateApiKey.svelte";

let keys = $state(null);
let error = $state("");
let creating = $state(false);

const load = async () => {
  const r = await api("GET", "/settings/apikeys");
  if (!Array.isArray(r)) {
    error = r?.error || "Couldn't load API keys";
    return;
  }
  error = "";
  keys = r;
};
load();

const remove = async (k) => {
  const ok = await confirm({
    title: t('Delete "{name}"?', { name: k.name }),
    message: t("Anything using this API key stops working right away."),
    confirmText: t("Delete API key"),
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", `/settings/apikeys/${k.id}`);
  if (!res?.success) {
    toast(t(res?.error || "Couldn't delete the API key"), "error");
    return;
  }
  keys = keys.filter((x) => x.id !== k.id);
  toast(t("API key deleted"));
};
</script>

<Skeleton data={keys} sample={samples.apiKeys} {error} empty={keys?.length === 0} label={t("Loading API keys")}>
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{t(error)}</p>
  {/snippet}
  {#snippet emptyMessage()}
    <Empty title={t("No API keys yet")}>
      {t("Create one to manage site keys from your own scripts.")}
      {#snippet action()}
        <Button variant="primary" onclick={() => (creating = true)}><Icon name="plus" size={15} />{t("Create API key")}</Button>
      {/snippet}
    </Empty>
  {/snippet}
  {#snippet children(list)}
    <div class="flex flex-col gap-4 pb-4">
      {#if list.some((k) => k.outdated)}
        <p class="text-sm text-pretty text-destructive" role="status">
          {t('Keys marked "From an older release" stopped working when Cap moved to SHA-256 hashes. Create a new key for each script that used one, then delete the old one.')}
        </p>
      {/if}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Name")}</TableHead>
            <TableHead>{tx("apikey", "Access")}</TableHead>
            <TableHead class="hidden sm:table-cell">{t("Site keys")}</TableHead>
            <TableHead class="hidden sm:table-cell">{t("Created")}</TableHead>
            <TableHead class="w-10"><span class="sr-only">{t("Actions")}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each list as k (k.id)}
            <TableRow>
              <TableCell class="max-w-56 truncate font-medium" title={k.name}>{k.name}</TableCell>
              <TableCell>
                {#if k.outdated}
                  <Tag tone="danger">{t("From an older release")}</Tag>
                {:else}
                  <Tag tone={k.readonly ? "neutral" : "warning"}>{k.readonly ? t("Read-only") : t("Full access")}</Tag>
                {/if}
              </TableCell>
              <TableCell class="hidden text-muted-foreground tabular-nums sm:table-cell">{k.siteKeys ? tp(k.siteKeys.length, "{count} site key", "{count} site keys") : t("All")}</TableCell>
              <TableCell class="hidden whitespace-nowrap text-muted-foreground sm:table-cell">{ago(Date.parse(k.created))}</TableCell>
              <TableCell class="text-end">
                <Button variant="ghost" size="sm" aria-label={t("Delete API key {name}", { name: k.name })} onclick={() => remove(k)}>{t("Delete")}</Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <div>
        <Button onclick={() => (creating = true)}><Icon name="plus" size={15} />{t("Create API key")}</Button>
      </div>
  </div>
  {/snippet}
</Skeleton>

{#if creating}
  <CreateApiKey
    onclose={() => {
      creating = false;
      load();
    }}
  />
{/if}
