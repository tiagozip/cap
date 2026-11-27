<script>
import { tick } from "svelte";
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
import Odometer from "../../components/cap/Odometer.svelte";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tip,
} from "../../components/ui/index.js";
import { toast as kitToast } from "../../components/ui/toast.svelte.js";
import { api, qs } from "../../lib/api.js";
import { loadCatalog } from "../../lib/catalog.svelte.js";
import { ago, compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { app, openEvents } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import {
  compileRule,
  estimate,
  listIdsOf,
  loadLists,
  loadSample,
  stageOf,
} from "../../polish/protection/impact.js";
import RuleSpark from "../../polish/protection/RuleSpark.svelte";
import RuleEditor from "./RuleEditor.svelte";
import {
  ACTION_TONES,
  actionLabel,
  conditionParts,
  TEMPLATES,
} from "./rules.js";

const sk = app.key.siteKey;
const TONE_VARS = {
  danger: "var(--destructive)",
  success: "var(--success)",
  warning: "var(--warning)",
  brand: "var(--info)",
};
let loading = $state(true);
let failed = $state(false);
let rules = $state([]);
let lists = $state([]);
let counts = $state({});
let activity = $state({});

const rowTotal = (row) =>
  (row.challenges ?? 0) +
  (row.solved ?? 0) +
  (row.failed ?? 0) +
  (row.blocked ?? 0) +
  (row.limited ?? 0) +
  (row.verified ?? 0);

async function loadActivity(list, all = false) {
  const stats = await api(
    "GET",
    `/keys/${sk}/rules/stats${qs({ range: "24h" })}`,
  );
  if (stats?.rules) {
    activity = stats.rules;
    return;
  }
  const missing = all ? list : list.filter((r) => !activity[r.id]);
  if (!missing.length) return;
  const got = await Promise.all(
    missing.map((r) =>
      api(
        "GET",
        `/keys/${sk}/analytics${qs({ range: "24h", f: r.action === "flag" ? `flag:rule:${r.id}` : `rule:${r.id}` })}`,
      ).then((o) =>
        o?.summary
          ? [
              r.id,
              {
                hits: o.summary.total,
                previous: o.previous?.total ?? 0,
                series: (o.series ?? []).map(rowTotal),
              },
            ]
          : null,
      ),
    ),
  );
  activity = { ...activity, ...Object.fromEntries(got.filter(Boolean)) };
}

$effect(() => {
  const tick = setInterval(() => {
    if (document.visibilityState === "visible" && !loading && !failed)
      loadActivity($state.snapshot(rules), true);
  }, 30_000);
  return () => clearInterval(tick);
});

let templateHits = $state({});
$effect(() => {
  if (loading || failed) return;
  Promise.all(
    TEMPLATES.map(async (t) => {
      const { test } = compileRule(t);
      if (!test) return null;
      const sample = await loadSample(sk, stageOf(t));
      return [t.name, estimate(sample, test).matched];
    }),
  ).then(
    (got) => {
      templateHits = Object.fromEntries(got.filter(Boolean));
    },
    () => {},
  );
});

let idle = $state({});
$effect(() => {
  const off = rules.filter((r) => !r.enabled);
  if (!off.length) return;
  const snapshot = $state.snapshot(off);
  Promise.all(
    snapshot.map(async (r) => {
      const [sample, lists] = await Promise.all([
        loadSample(sk, stageOf(r)),
        loadLists(listIdsOf(r)),
      ]);
      const { test } = compileRule(r, lists);
      return test ? [r.id, estimate(sample, test)] : null;
    }),
  ).then(
    (got) => {
      idle = { ...idle, ...Object.fromEntries(got.filter(Boolean)) };
    },
    () => {},
  );
});

const hitsOf = (id) => activity[id]?.hits ?? counts[id] ?? 0;

const trendText = (a) => {
  if (!a) return "";
  const parts = [`${a.hits.toLocaleString()} in the last 24 hours`];
  if (a.previous != null)
    parts.push(`${a.previous.toLocaleString()} the day before`);
  if (a.last) parts.push(`last hit ${ago(a.last)}`);
  return parts.join(", ");
};
let editor = $state(null);
let body = $state(null);

const rows = () => [...(body?.querySelectorAll("tr[data-rule]") ?? [])];
const moving = () =>
  matchMedia("(prefers-reduced-motion: no-preference)").matches;

async function animated(work) {
  const before =
    moving() &&
    new Map(
      rows().map((el) => [el.dataset.rule, el.getBoundingClientRect().top]),
    );
  const result = await work();
  if (!before) return result;
  await tick();
  for (const el of rows()) {
    const from = before.get(el.dataset.rule);
    if (from == null) {
      if (!before.size) continue;
      el.animate(
        [
          { opacity: 0, transform: "translateY(-6px)", filter: "blur(3px)" },
          { opacity: 1, transform: "none", filter: "blur(0)" },
        ],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      continue;
    }
    const dy = from - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 1) continue;
    el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], {
      duration: 320,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }
  return result;
}

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
  loadActivity(rules);
}
refresh();

async function save(next) {
  const res = await api("PUT", `/keys/${sk}/rules`, { rules: next });
  if (res.success) await refresh();
  return res;
}

async function quickSave(next) {
  const res = await animated(() => save(next));
  if (res.success) return;
  toast(res.error || "Couldn't save rules", "error");
  refresh();
}

const current = () => $state.snapshot(rules).map(({ stage, ...r }) => r);

function move(i, dir) {
  const next = current();
  [next[i], next[i + dir]] = [next[i + dir], next[i]];
  quickSave(next);
}

async function remove(i) {
  const all = current();
  const [gone] = all.splice(i, 1);
  const exit = moving()
    ? rows()
        .find((el) => el.dataset.rule === gone.id)
        ?.animate(
          [
            { opacity: 1, filter: "blur(0)" },
            { opacity: 0, filter: "blur(4px)" },
          ],
          { duration: 160, easing: "ease-in", fill: "forwards" },
        )
    : null;
  const [res] = await animated(() => Promise.all([save(all), exit?.finished]));
  exit?.cancel();
  if (!res.success) {
    toast(res.error || "Couldn't delete the rule", "error");
    refresh();
    return;
  }
  kitToast.success(`${gone.name} deleted`, {
    action: {
      label: "Undo",
      run: () => quickSave(current().toSpliced(i, 0, gone)),
    },
  });
}

let drag = $state(null);
let announce = $state("");

const focusGrip = async (id) => {
  await tick();
  body?.querySelector(`tr[data-rule="${id}"] [data-grip]`)?.focus();
};

async function reorder(from, to) {
  const next = current();
  const [r] = next.splice(from, 1);
  next.splice(to, 0, r);
  rules = next.map((x) => ({
    ...x,
    stage: rules.find((y) => y.id === x.id)?.stage,
  }));
  announce = `${r.name} moved to position ${to + 1} of ${next.length}`;
  const res = await save(next);
  if (res.success) return;
  toast(res.error || "Couldn't reorder the rules", "error");
  refresh();
}

function startDrag(e, i) {
  if (e.button !== 0 || rules.length < 2) return;
  e.preventDefault();
  const grip = e.currentTarget;
  const els = rows();
  const el = els[i];
  const rects = els.map((r) => r.getBoundingClientRect());
  const h = rects[i].height;
  const startY = e.clientY;
  const smooth = moving();
  const min = rects[0].top - rects[i].top;
  const max = rects.at(-1).bottom - rects[i].bottom;
  let to = i;
  grip.setPointerCapture(e.pointerId);
  drag = { id: el.dataset.rule };
  for (const r of els)
    if (r !== el)
      r.style.transition = smooth
        ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
  const onMove = (ev) => {
    const dy = Math.min(max, Math.max(min, ev.clientY - startY));
    el.style.transform = `translateY(${dy}px)`;
    const mid = rects[i].top + h / 2 + dy;
    to = i;
    els.forEach((r, j) => {
      const m = rects[j].top + rects[j].height / 2;
      const shift = j < i && mid < m ? h : j > i && mid > m ? -h : 0;
      if (shift > 0) to = Math.min(to, j);
      if (shift < 0) to = Math.max(to, j);
      if (r !== el) r.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  };
  const onEnd = async () => {
    grip.removeEventListener("pointermove", onMove);
    grip.removeEventListener("pointerup", onEnd);
    grip.removeEventListener("pointercancel", onEnd);
    const before = el.getBoundingClientRect().top;
    for (const r of els) {
      r.style.transition = "none";
      r.style.transform = "";
    }
    const id = drag?.id;
    drag = null;
    if (to !== i) {
      const pending = reorder(i, to);
      await tick();
      const moved = body?.querySelector(`tr[data-rule="${id}"]`);
      const dy = before - (moved?.getBoundingClientRect().top ?? before);
      if (smooth && Math.abs(dy) >= 1)
        moved.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
          { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        );
      await pending;
    } else if (smooth && Math.abs(before - rects[i].top) >= 1) {
      el.animate(
        [
          { transform: `translateY(${before - rects[i].top}px)` },
          { transform: "none" },
        ],
        { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    for (const r of els) r.style.transition = "";
  };
  grip.addEventListener("pointermove", onMove);
  grip.addEventListener("pointerup", onEnd);
  grip.addEventListener("pointercancel", onEnd);
}

async function keyMove(e, i) {
  const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
  if (!dir || i + dir < 0 || i + dir >= rules.length) return;
  e.preventDefault();
  const id = rules[i].id;
  let pending;
  await animated(() => {
    pending = reorder(i, i + dir);
  });
  focusGrip(id);
  await pending;
}

const fromTemplate = (t) => {
  editor = { rule: { ...t, enabled: true }, index: -1 };
};

async function saveFromEditor(rule) {
  const all = current();
  const next =
    editor.index >= 0
      ? all.map((r, i) => (i === editor.index ? rule : r))
      : all.toSpliced(editor.at ?? all.length, 0, rule);
  const res = await animated(() => save(next));
  if (res.success) {
    toast(editor.index >= 0 ? "Rule saved" : "Rule added");
    editor = null;
  }
  return res;
}
</script>

{#snippet chip(c)}
  {@const p = conditionParts(c, lists)}
  <span class="inline-flex min-h-6 max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 py-0.5 rounded-md bg-muted pr-0.5 pl-1.5 text-xs shadow-[inset_0_0_0_1px_var(--border)] {p.value ? '' : 'pr-1.5'}">
    <span class="min-w-0 break-words">{p.field}</span>
    <span class="shrink-0 whitespace-nowrap text-muted-foreground">{p.op}</span>
    {#if p.value}
      <span class="inline-flex h-5 min-w-0 items-center rounded-[5px] bg-card px-1.5 shadow-[0_0_0_1px_var(--border),0_1px_1px_rgb(0_0_0/0.04)] {p.mono ? 'font-mono text-[11px]' : ''}">
        <span class="truncate" title={p.value}>{p.value}</span>
      </span>
    {/if}
  </span>
{/snippet}

{#snippet ruleLine(r)}
  <span class="flex flex-wrap items-center gap-1.5">
    <span class="flex max-w-full min-w-0 flex-wrap items-center gap-1.5 md:flex-nowrap">
      <Tag tone={ACTION_TONES[r.action]} class="shrink-0">{actionLabel(r)}</Tag>
      {#if r.conditions[0]}{@render chip(r.conditions[0])}{/if}
    </span>
    {#each r.conditions.slice(1) as c, j (j)}
      <span class="text-xs text-muted-foreground">{r.match === "any" ? "or" : "and"}</span>
      {@render chip(c)}
    {/each}
  </span>
{/snippet}

<Group
  id="rules"
  title="Rules"
  flush
>
  {#snippet action()}
    {#if rules?.length}
    <Menu width="w-80">
      {#snippet trigger(props)}
        <Button {...props} size="sm">
          Use a template
          <Icon name="down" size={13} class="-mr-0.5 text-muted-foreground" />
        </Button>
      {/snippet}
      <MenuLabel>Templates</MenuLabel>
      {#each TEMPLATES as t (t.name)}
        <MenuItem onselect={() => fromTemplate(t)} hint={templateHits[t.name] != null ? `${compact(templateHits[t.name])} a day` : undefined}>{t.name}</MenuItem>
      {/each}
    </Menu>
    {/if}
    <Button variant="primary" size="sm" class="pl-2" onclick={() => (editor = { rule: null, index: -1 })}>
      <Icon name="plus" size={14} />
      New rule
    </Button>
  {/snippet}

  <Skeleton data={loading ? null : rules} sample={samples.rules} error={failed} empty={!loading && !failed && !rules.length} label="Loading rules">
    {#snippet errorMessage()}
      <p class="px-5 py-5 text-sm text-destructive" role="alert">Couldn't load the rules for this key.</p>
    {/snippet}
    {#snippet emptyMessage()}
      <Empty title="No rules yet">
        Start from one of these, or make your own.
        {#snippet action()}
          <div class="grid w-full gap-2 text-left sm:grid-cols-2">
            {#each TEMPLATES.slice(0, 4) as t (t.name)}
              <button
                type="button"
                class="flex cursor-pointer flex-col items-start gap-2 rounded-lg bg-card p-3 shadow-[0_0_0_1px_var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-safe:transition-[scale] motion-safe:duration-150 motion-safe:ease-out [@media(hover:hover)]:hover:bg-muted/60"
                onclick={() => fromTemplate(t)}
              >
                <Tag tone={ACTION_TONES[t.action]}>{actionLabel(t)}</Tag>
                <span class="text-sm font-medium text-pretty">{t.name}</span>
                {#if templateHits[t.name] != null}
                  <span class="-mt-1 text-xs text-muted-foreground tabular-nums">Matches about {compact(templateHits[t.name])} a day</span>
                {/if}
              </button>
            {/each}
          </div>
        {/snippet}
      </Empty>
    {/snippet}
    {#snippet children(list)}
      <Table flush>
        <TableHeader>
          <TableRow>
            <TableHead class="w-px pe-0!"><span class="sr-only">Order</span></TableHead>
            <TableHead class="md:w-56">Name</TableHead>
            <TableHead class="max-md:hidden">Rule</TableHead>
            <TableHead class="w-px text-right! whitespace-nowrap max-sm:hidden">Matches, 24 hours</TableHead>
            <TableHead class="w-px"><span class="sr-only">On</span></TableHead>
            <TableHead class="w-px"><span class="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody bind:ref={body}>
          {#each list as r, i (r.id)}
            <TableRow data-rule={r.id} data-dragging={drag?.id === r.id || undefined} class="relative data-dragging:z-10 data-dragging:bg-popover data-dragging:shadow-overlay {r.enabled ? '' : '[&>td:not(:nth-last-child(-n+2))]:opacity-55'}">
              <TableCell class="w-px py-2.5! pe-0! align-top">
                <button
                  type="button"
                  data-grip
                  class="-ms-2 flex h-6 w-5 touch-none items-center justify-center rounded-sm text-faint-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:invisible {drag ? 'cursor-grabbing' : 'cursor-grab'} [@media(hover:hover)]:hover:text-muted-foreground"
                  aria-label="Reorder {r.name}"
                  aria-describedby="ruleGripHelp"
                  disabled={list.length < 2}
                  onpointerdown={(e) => startDrag(e, i)}
                  onkeydown={(e) => keyMove(e, i)}
                >
                  <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" fill="currentColor">
                    {#each [3, 8, 13] as y (y)}<circle cx="2.5" cy={y} r="1.25" /><circle cx="7.5" cy={y} r="1.25" />{/each}
                  </svg>
                </button>
              </TableCell>
              <TableCell class="py-2.5! max-md:w-full max-md:max-w-0">
                <span class="flex min-w-0 flex-col gap-0.5 whitespace-normal md:max-w-64 md:min-w-48">
                  <span class="font-medium break-words">{r.name}</span>
                  <span class="text-xs text-muted-foreground">
                    {r.enabled ? (r.stage === "challenge" ? "Before the puzzle" : r.stage === "redeem" ? "After the solve" : `Rule ${i + 1}`) : "Off"}
                  </span>
                  <span class="mt-1.5 md:hidden">{@render ruleLine(r)}</span>
                </span>
              </TableCell>
              <TableCell class="py-2.5! max-md:hidden">{@render ruleLine(r)}</TableCell>
              <TableCell class="text-right whitespace-nowrap max-sm:hidden">
                <span class="inline-flex items-center gap-3">
                  {#if !r.enabled && idle[r.id]}
                    <RuleSpark series={idle[r.id].bars.flatMap((b) => [b.matched, b.matched])} />
                    <span class="min-w-8 text-muted-foreground tabular-nums">{compact(idle[r.id].matched)} if on</span>
                  {:else}
                  {#if activity[r.id]?.series?.length}
                    <RuleSpark series={activity[r.id].series} tone={TONE_VARS[ACTION_TONES[r.action]]} />
                  {/if}
                  {#if hitsOf(r.id)}
                    <Tip label={trendText(activity[r.id]) || "Show the events this rule matched"}>
                      {#snippet children(props)}
                        <button
                          {...props}
                          type="button"
                          class="min-w-8 cursor-pointer rounded-sm text-right font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
                          aria-label="Show the {hitsOf(r.id).toLocaleString()} events {r.name} matched"
                          onclick={() => openEvents([`rule:${r.id}`])}
                        ><Odometer value={hitsOf(r.id)} format={compact} /></button>
                      {/snippet}
                    </Tip>
                  {:else}
                    <span class="min-w-8 text-faint-foreground tabular-nums">0</span>
                  {/if}
                  {/if}
                </span>
              </TableCell>
              <TableCell>
                <Switch
                  checked={r.enabled}
                  label="Turn on {r.name}"
                  onchange={(v) => quickSave(current().map((x, j) => (j === i ? { ...x, enabled: v } : x)))}
                />
              </TableCell>
              <TableCell>
                <Menu width="w-44">
                  {#snippet trigger(props)}
                    <Button {...props} variant="ghost" size="sm" icon aria-label="More for {r.name}">
                      <Icon name="more" size={16} stroke={3} />
                    </Button>
                  {/snippet}
                  <MenuItem icon="edit" onselect={() => (editor = { rule: r, index: i })}>Edit</MenuItem>
                  <MenuItem
                    icon="copy"
                    onselect={() => {
                      const { id, stage, ...copy } = $state.snapshot(r);
                      editor = { rule: { ...copy, name: `${r.name} copy`.slice(0, 80) }, index: -1, at: i + 1 };
                    }}
                  >Duplicate</MenuItem>
                  <MenuItem icon="events" onselect={() => openEvents([`rule:${r.id}`])}>Show matches</MenuItem>
                  {#if i > 0}
                    <MenuItem icon="up" onselect={() => move(i, -1)}>Move up</MenuItem>
                  {/if}
                  {#if i < list.length - 1}
                    <MenuItem icon="down" onselect={() => move(i, 1)}>Move down</MenuItem>
                  {/if}
                  <MenuSeparator />
                  <MenuItem icon="trash" danger onselect={() => remove(i)}>Delete</MenuItem>
                </Menu>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
    </Table>
      <p id="ruleGripHelp" class="sr-only">Drag, or press the up and down arrow keys, to change the order. Rules run from the top.</p>
      <p class="sr-only" aria-live="polite">{announce}</p>
    {/snippet}
  </Skeleton>
</Group>

{#if editor}
  <RuleEditor rule={editor.rule} editing={editor.index >= 0} ahead={current().slice(0, editor.index >= 0 ? editor.index : (editor.at ?? Infinity))} {lists} onsave={saveFromEditor} onclose={() => (editor = null)} />
{/if}
