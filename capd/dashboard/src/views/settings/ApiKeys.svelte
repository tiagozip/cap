<script>
import {
  Button,
  Empty,
  Icon,
  Skeleton,
  Tag,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { ago } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { undoable } from "../../lib/ui.svelte.js";
import { leave } from "../../polish/settings-b/motion.js";
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

const rowOf = (k) =>
  document.querySelector(`[data-apikey="${CSS.escape(k.id)}"]`);
load();

const remove = async (k) => {
  await leave(rowOf(k));
  const at = keys.indexOf(k);
  if (at < 0) return;
  keys = keys.filter((x) => x.id !== k.id);
  undoable({
    message: `${k.name} deleted`,
    commit: async () => {
      const res = await api("DELETE", `/settings/apikeys/${k.id}`);
      return res?.success ? null : res?.error || "Couldn't delete the API key";
    },
    undo: async () => {
      keys = keys.toSpliced(at, 0, k);
    },
  });
};
</script>

<Skeleton data={keys} sample={samples.apiKeys} {error} empty={keys?.length === 0} label="Loading API keys">
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{error}</p>
  {/snippet}
  {#snippet emptyMessage()}
    <Empty title="No API keys yet">
      {#snippet action()}
        <Button variant="primary" onclick={() => (creating = true)}><Icon name="plus" size={15} />Create API key</Button>
      {/snippet}
    </Empty>
  {/snippet}
  {#snippet children(list)}
    <div class="flex flex-col gap-2 pb-4">
      {#if list.some((k) => k.outdated)}
        <p class="text-sm text-pretty text-destructive" role="status">
          Keys marked "From an older release" stopped working when Cap moved to SHA-256 hashes. Create a new key for each script that used one, then delete the old one.
        </p>
      {/if}
      <ul class="flex flex-col divide-y divide-border" aria-label="API keys">
        {#each list as k (k.id)}
          <li data-apikey={k.id} class="flex min-h-16 items-center gap-3 py-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
              <Icon name="key" size={16} />
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <p class="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span class="truncate" title={k.name}>{k.name}</span>
                {#if k.outdated}
                  <Tag tone="danger" class="shrink-0">From an older release</Tag>
                {:else}
                  <Tag tone={k.readonly ? "neutral" : "warning"} class="shrink-0">{k.readonly ? "Read-only" : "Full access"}</Tag>
                {/if}
              </p>
              <p class="truncate text-sm text-muted-foreground tabular-nums">
                {k.siteKeys ? `${k.siteKeys.length} site key${k.siteKeys.length === 1 ? "" : "s"}` : "All site keys"}, created {ago(Date.parse(k.created))}
              </p>
            </div>
            <Button variant="ghost" size="sm" class="shrink-0" aria-label="Delete API key {k.name}" onclick={() => remove(k)}>Delete</Button>
          </li>
        {/each}
      </ul>
      <div class="flex h-9">
        <Button onclick={() => (creating = true)}><Icon name="plus" size={15} />Create API key</Button>
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
