<script>
import { untrack } from "svelte";
import {
  Button,
  Dialog,
  Field,
  Icon,
  Input,
  Segmented,
  Select,
} from "../../components/cap/index.js";
import { catalog, fieldLabel } from "../../lib/catalog.svelte.js";
import { t, tx } from "../../lib/i18n.svelte.js";
import ListEditor from "../lists/ListEditor.svelte";
import {
  ACTION_HELP,
  ACTION_LABELS,
  NO_VALUE_OPS,
  OP_LABELS,
  VERDICTS,
} from "./rules.js";

let { rule, editing, lists: initialLists, onsave, onclose } = $props();

let lists = $state(
  untrack(() => initialLists.filter((l) => !l.id.startsWith("blk_"))),
);
let listEditor = $state(null);
let lastList = "";

const blank = () => ({ field: "country", op: "eq", value: "" });
let draft = $state(
  untrack(() =>
    structuredClone(
      $state.snapshot(rule) ?? {
        name: "",
        enabled: true,
        match: "all",
        action: "block",
        conditions: [blank()],
      },
    ),
  ),
);
draft.factor ??= 2;
for (const c of draft.conditions)
  if (Array.isArray(c.value)) c.value = c.value.join(", ");

let error = $state("");
let busy = $state(false);
let nameError = $state("");
let nameInput = $state(null);
let condsEl = $state(null);

const STAGES = $derived([
  ["request", t("About the request")],
  ["result", t("About the solve")],
]);
const typeOf = (c) => catalog.fields[c.field]?.type ?? "string";

const datalistFor = (c) =>
  typeOf(c) === "flag"
    ? "ruleFlagOptions"
    : c.field === "agent"
      ? "ruleAgentOptions"
      : c.field === "verdict"
        ? "ruleVerdictOptions"
        : c.field === "agent_confidence"
          ? "ruleConfOptions"
          : undefined;

const placeholderFor = (c) =>
  c.op === "in" || c.op === "not_in"
    ? c.field === "ip"
      ? "1.2.3.4, 10.0.0.0/8"
      : t("Values separated by commas")
    : typeOf(c) === "flag"
      ? t("bh_linear_path, or bh_* for a prefix")
      : c.field === "agent"
        ? t("Any agent")
        : c.field === "country"
          ? t("Two-letter code, like US")
          : t("Value");

function setField(c, field) {
  c.field = field;
  const type = catalog.fields[field].type;
  c.op = catalog.ops[type][0];
  c.value = type === "list" ? (lists[0]?.id ?? "") : "";
  if (type !== "header") delete c.header;
}

function addCondition() {
  draft.conditions.push(blank());
  requestAnimationFrame(() =>
    condsEl?.querySelector("li:last-child select")?.focus(),
  );
}

async function save() {
  if (!draft.name.trim()) {
    nameError = "Give the rule a name so you can find it later.";
    nameInput?.focus();
    return;
  }
  busy = true;
  error = "";
  const res = await onsave({
    ...$state.snapshot(draft),
    name: draft.name.trim(),
    factor: Number(draft.factor) || 2,
  });
  busy = false;
  if (!res.success) error = res.error || "Couldn't save this rule";
}
</script>

<Dialog title={editing ? t("Edit rule") : t("New rule")} size="md" {onclose}>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-1.5 text-sm">
      <label for="ruleMatch">{tx("rule", "When")}</label>
      <Select
        id="ruleMatch"
        size="sm"
        bind:value={draft.match}
        options={[
          ["all", tx("rule", "all")],
          ["any", tx("rule", "any")],
        ]}
      />
      <span>{t("of these match")}</span>
    </div>

    <ol class="flex flex-col gap-1.5" bind:this={condsEl}>
      {#each draft.conditions as c, i (c)}
        {@const type = typeOf(c)}
        <li class="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-1.5">
          <span class="flex h-9 items-center justify-end text-sm text-muted-foreground">{i === 0 ? tx("rule", "where") : draft.match === "any" ? t("or") : t("and")}</span>
          <div class="flex min-w-0 flex-wrap items-center gap-1 rounded-lg bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]">
            <Select
              id="condField{i}"
              size="sm"
              class="w-44 max-w-full"
              aria-label={t("Condition {n} field", { n: i + 1 })}
              value={c.field}
              onchange={(e) => setField(c, e.currentTarget.value)}
            >
              {#each STAGES as [stage, label] (stage)}
                <optgroup {label}>
                  {#each Object.entries(catalog.fields).filter(([, f]) => f.stage === stage) as [id, f] (id)}
                    <option value={id}>{fieldLabel(id)}</option>
                  {/each}
                </optgroup>
              {/each}
            </Select>
            {#if type === "header"}
              <div class="w-32"><Input id="condHeader{i}" size="sm" mono aria-label={t("Header name")} placeholder="header-name" bind:value={c.header} /></div>
            {/if}
            <Select
              id="condOp{i}"
              size="sm"
              class="w-32 max-w-full"
              aria-label={t("Condition {n} comparison", { n: i + 1 })}
              bind:value={c.op}
              options={(catalog.ops[type] ?? []).map((o) => [o, OP_LABELS[o]])}
            />
            {#if !NO_VALUE_OPS.includes(c.op)}
              {#if type === "list"}
                {#if lists.length}
                  <Select
                    id="condValue{i}"
                    size="sm"
                    class="max-w-full min-w-0 shrink"
                    aria-label={t("List")}
                    bind:value={c.value}
                    options={[...lists.map((l) => [l.id, `${l.name} (${l.count})`]), ["__new", t("New list…")]]}
                    onfocus={() => (lastList = c.value)}
                    onchange={() => {
                      if (c.value !== "__new") return;
                      c.value = lastList;
                      listEditor = { cond: c, id: null };
                    }}
                  />
                  <Button size="sm" variant="ghost" onclick={() => (listEditor = { cond: c, id: c.value })}>{t("Edit list")}</Button>
                {:else}
                  <Button size="sm" onclick={() => (listEditor = { cond: c, id: null })}>
                    <Icon name="plus" size={14} />
                    {t("New list")}
                  </Button>
                {/if}
              {:else if type === "number"}
                <div class="min-w-20 flex-1">
                  <Input
                    id="condValue{i}"
                    size="sm"
                    aria-label={t("Condition {n} value", { n: i + 1 })}
                    type="number"
                    step="any"
                    inputmode="decimal"
                    bind:value={c.value}
                  />
                </div>
              {:else}
                <div class="min-w-28 flex-1">
                  <Input
                    id="condValue{i}"
                    size="sm"
                    mono={["ip", "ua", "header", "visitor"].includes(c.field) || type === "flag"}
                    aria-label={t("Condition {n} value", { n: i + 1 })}
                    list={datalistFor(c)}
                    placeholder={placeholderFor(c)}
                    bind:value={c.value}
                  />
                </div>
              {/if}
            {/if}
          </div>
          <Button
            variant="ghost"
            icon
            class="mt-0.5"
            aria-label={t("Remove condition {n}", { n: i + 1 })}
            disabled={draft.conditions.length === 1}
            onclick={() => draft.conditions.splice(i, 1)}
          >
            <Icon name="x" size={15} />
          </Button>
        </li>
      {/each}
    </ol>

    <div class="pl-[3.125rem]">
      <Button variant="ghost" size="sm" class="-ml-2 pl-1.5" onclick={addCondition}>
        <Icon name="plus" size={14} />
        {t("Add a condition")}
      </Button>
    </div>
  </div>

  <div class="flex flex-col gap-2 border-t border-border pt-4">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span aria-hidden="true">{t("Then")}</span>
      <Segmented
        label={t("Then")}
        size="sm"
        bind:value={draft.action}
        danger={["block"]}
        options={catalog.actions.map((a) => [a, ACTION_LABELS[a]])}
      />
      {#if draft.action === "harder"}
        <span class="flex items-center gap-1.5">
          <label for="ruleFactor">{tx("rule", "by")}</label>
          <div class="w-16"><Input type="number" id="ruleFactor" size="sm" min="1.5" max="10" step="0.5" inputmode="decimal" bind:value={draft.factor} /></div>
          <span>{tx("rule", "times")}</span>
        </span>
      {/if}
    </div>
    <p class="text-sm text-pretty text-muted-foreground">{ACTION_HELP[draft.action]}</p>
  </div>

  <Field label={t("Name")} for="ruleName" error={t(nameError)}>
    <Input
      id="ruleName"
      maxlength={80}
      placeholder={t("Block datacenter traffic")}
      bind:ref={nameInput}
      bind:value={draft.name}
      invalid={!!nameError}
      aria-describedby={nameError ? "ruleName-error" : undefined}
      oninput={() => (nameError = "")}
    />
  </Field>

  {#if error}
    <p class="text-sm text-destructive" role="alert">{t(error)}</p>
  {/if}

  <datalist id="ruleFlagOptions">
    {#each catalog.signals.flatMap((g) => g.signals) as [id] (id)}
      <option value={id}></option>
    {/each}
    <option value="agent:*"></option>
    <option value="rule:*"></option>
  </datalist>
  <datalist id="ruleAgentOptions">
    {#each catalog.agents as [id, n] (id)}
      <option value={id}>{n}</option>
    {/each}
  </datalist>
  <datalist id="ruleVerdictOptions">
    {#each VERDICTS as v (v)}
      <option value={v}></option>
    {/each}
  </datalist>
  <datalist id="ruleConfOptions">
    <option value="high"></option>
    <option value="medium"></option>
    <option value="low"></option>
  </datalist>

  {#snippet footer()}
    <Button onclick={onclose}>{t("Cancel")}</Button>
    <Button variant="primary" disabled={busy} onclick={save}>{editing ? t("Save rule") : t("Add rule")}</Button>
  {/snippet}
</Dialog>

{#if listEditor}
  <ListEditor
    stacked
    id={listEditor.id}
    onchange={(l) => {
      const { cond } = listEditor;
      if (!l) {
        lists = lists.filter((x) => x.id !== listEditor.id);
        cond.value = lists[0]?.id ?? "";
        return;
      }
      const entry = { id: l.id, name: l.name, count: l.items.length };
      lists = lists.some((x) => x.id === l.id)
        ? lists.map((x) => (x.id === l.id ? entry : x))
        : [entry, ...lists];
      cond.value = l.id;
    }}
    onclose={() => (listEditor = null)}
  />
{/if}
