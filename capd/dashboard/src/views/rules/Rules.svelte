<script>
import {
  Button,
  Empty,
  Group,
  Icon,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Skeleton,
  Switch,
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
import { api, qs } from "../../lib/api.js";
import { loadCatalog } from "../../lib/catalog.svelte.js";
import { compact } from "../../lib/format.js";
import { t, tx } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { app, openEvents } from "../../lib/state.svelte.js";
import { confirm, toast } from "../../lib/ui.svelte.js";
import RuleEditor from "./RuleEditor.svelte";
import {
  ACTION_TONES,
  actionLabel,
  conditionParts,
  TEMPLATES,
} from "./rules.js";

const sk = app.key.siteKey;
let loading = $state(true);
let failed = $state(false);
let rules = $state([]);
let lists = $state([]);
let counts = $state({});
let editor = $state(null);

async function refresh() {
  await loadCatalog();
  const [r, l, hits] = await Promise.all([
    api("GET", `/keys/${sk}/rules`),
    api("GET", "/lists"),
    api(
      "GET",
      `/keys/${sk}/analytics/top${qs({ range: "24h", dims: "rule", limit: 100 })}`,
    ),
  ]);
  failed = !Array.isArray(r);
  rules = Array.isArray(r) ? r : [];
  lists = Array.isArray(l) ? l : [];
  counts = Object.fromEntries((hits?.rule ?? []).map((x) => [x.value, x.n]));
  loading = false;
}
refresh();

async function save(next) {
  const res = await api("PUT", `/keys/${sk}/rules`, { rules: next });
  if (res.success) await refresh();
  return res;
}

async function quickSave(next) {
  const res = await save(next);
  if (res.success) return;
  toast(t(res.error || "Couldn't save rules"), "error");
  refresh();
}

const current = () => $state.snapshot(rules).map(({ stage, ...r }) => r);

function move(i, dir) {
  const next = current();
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  quickSave(next);
}

async function remove(i) {
  const ok = await confirm({
    title: t('Delete "{name}"?', { name: rules[i].name }),
    message: t("Traffic it matched stops being blocked, allowed or flagged."),
    confirmText: t("Delete rule"),
    danger: true,
  });
  if (ok) quickSave(current().filter((_, j) => j !== i));
}

const fromTemplate = (tpl) => {
  editor = { rule: { ...tpl, name: tpl.name, enabled: true }, index: -1 };
};

async function saveFromEditor(rule) {
  const all = current();
  const next =
    editor.index >= 0
      ? all.map((r, i) => (i === editor.index ? rule : r))
      : [...all, rule];
  const res = await save(next);
  if (res.success) {
    toast(editor.index >= 0 ? t("Rule saved") : t("Rule added"));
    editor = null;
  }
  return res;
}
</script>

{#snippet ruleLine(r)}
  <span class="flex flex-wrap items-center gap-1.5">
    <Tag tone={ACTION_TONES[r.action]}>{actionLabel(r)}</Tag>
    {#each r.conditions as c, j (j)}
      {@const p = conditionParts(c, lists)}
      {#if j}<span class="text-xs text-muted-foreground">{r.match === "any" ? t("or") : t("and")}</span>{/if}
      <span class="inline-flex min-h-6 max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 py-0.5 rounded-md bg-muted pr-0.5 pl-1.5 text-xs shadow-[inset_0_0_0_1px_var(--border)] {p.value ? '' : 'pr-1.5'}">
        <span class="min-w-0 break-words">{p.field}</span>
        <span class="shrink-0 whitespace-nowrap text-muted-foreground">{p.op}</span>
        {#if p.value}
          <span class="inline-flex h-5 min-w-0 items-center rounded-[5px] bg-card px-1.5 shadow-[0_0_0_1px_var(--border),0_1px_1px_rgb(0_0_0/0.04)] {p.mono ? 'font-mono text-[11px]' : ''}">
            <span class="truncate" title={p.value}>{p.value}</span>
          </span>
        {/if}
      </span>
    {/each}
  </span>
{/snippet}

<Group
  id="rules"
  title={t("Rules")}
  flush
>
  {#snippet action()}
    {#if rules?.length}
    <Menu width="w-72">
      {#snippet trigger(props)}
        <Button {...props} size="sm">
          {t("Use a template")}
          <Icon name="down" size={13} class="-mr-0.5 text-muted-foreground" />
        </Button>
      {/snippet}
      <MenuLabel>{t("Templates")}</MenuLabel>
      {#each TEMPLATES as tpl, idx (idx)}
        <MenuItem onselect={() => fromTemplate(tpl)}>{tpl.name}</MenuItem>
      {/each}
    </Menu>
    {/if}
    <Button variant="primary" size="sm" class="pl-2" onclick={() => (editor = { rule: null, index: -1 })}>
      <Icon name="plus" size={14} />
      {t("New rule")}
    </Button>
  {/snippet}

  <Skeleton data={loading ? null : rules} sample={samples.rules} error={failed} empty={!loading && !failed && !rules.length} label={t("Loading rules")}>
    {#snippet errorMessage()}
      <p class="px-5 py-5 text-sm text-destructive" role="alert">{t("Couldn't load the rules for this key.")}</p>
    {/snippet}
    {#snippet emptyMessage()}
      <Empty title={t("No rules yet")}>
        {t("Rules block, allow, flag or slow down visitors based on where they come from and what Cap noticed. Start from one of these.")}
        {#snippet action()}
          <div class="flex flex-wrap justify-center gap-2">
            {#each TEMPLATES.slice(0, 4) as tpl, idx (idx)}
              <Button size="sm" onclick={() => fromTemplate(tpl)}>{tpl.name}</Button>
            {/each}
          </div>
        {/snippet}
      </Empty>
    {/snippet}
    {#snippet children(list)}
      <Table flush>
        <TableHeader>
          <TableRow>
            <TableHead class="md:w-56">{t("Name")}</TableHead>
            <TableHead class="max-md:hidden">{t("Rule")}</TableHead>
            <TableHead class="w-px text-right! whitespace-nowrap max-sm:hidden">{t("Matches, 24 hours")}</TableHead>
            <TableHead class="w-px"><span class="sr-only">{tx("rule", "On")}</span></TableHead>
            <TableHead class="w-px"><span class="sr-only">{t("Actions")}</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each list as r, i (r.id)}
            <TableRow class={r.enabled ? "" : "[&>td:not(:nth-last-child(-n+2))]:opacity-55"}>
              <TableCell class="py-2.5! max-md:w-full max-md:max-w-0">
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="font-medium break-words">{r.name}</span>
                  <span class="text-xs text-muted-foreground">
                    {r.enabled ? (r.stage === "challenge" ? t("Before the puzzle") : r.stage === "redeem" ? t("After the solve") : t("Rule {id}", { id: i + 1 })) : t("Off")}
                  </span>
                  <span class="mt-1.5 md:hidden">{@render ruleLine(r)}</span>
                </span>
              </TableCell>
              <TableCell class="py-2.5! max-md:hidden">{@render ruleLine(r)}</TableCell>
              <TableCell class="text-right whitespace-nowrap max-sm:hidden">
                {#if counts[r.id]}
                  <button
                    type="button"
                    class="cursor-pointer rounded-sm font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
                    title={t("Show the events this rule matched")}
                    onclick={() => openEvents([`rule:${r.id}`])}
                  >{compact(counts[r.id])}</button>
                {:else}
                  <span class="text-faint-foreground tabular-nums">0</span>
                {/if}
              </TableCell>
              <TableCell>
                <Switch
                  checked={r.enabled}
                  label={t("Turn on {name}", { name: r.name })}
                  onchange={(v) => quickSave(current().map((x, j) => (j === i ? { ...x, enabled: v } : x)))}
                />
              </TableCell>
              <TableCell>
                <Menu width="w-44">
                  {#snippet trigger(props)}
                    <Button {...props} variant="ghost" size="sm" icon aria-label={t("More for {name}", { name: r.name })}>
                      <Icon name="more" size={16} stroke={3} />
                    </Button>
                  {/snippet}
                  <MenuItem icon="edit" onselect={() => (editor = { rule: r, index: i })}>{t("Edit")}</MenuItem>
                  <MenuItem icon="events" onselect={() => openEvents([`rule:${r.id}`])}>{t("Show matches")}</MenuItem>
                  {#if i > 0}
                    <MenuItem icon="up" onselect={() => move(i, -1)}>{t("Move up")}</MenuItem>
                  {/if}
                  {#if i < list.length - 1}
                    <MenuItem icon="down" onselect={() => move(i, 1)}>{t("Move down")}</MenuItem>
                  {/if}
                  <MenuSeparator />
                  <MenuItem icon="trash" danger onselect={() => remove(i)}>{t("Delete")}</MenuItem>
                </Menu>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
    </Table>
    {/snippet}
  </Skeleton>
</Group>

{#if editor}
  <RuleEditor rule={editor.rule} editing={editor.index >= 0} {lists} onsave={saveFromEditor} onclose={() => (editor = null)} />
{/if}
