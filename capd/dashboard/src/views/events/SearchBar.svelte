<script>
import { untrack } from "svelte";
import Icon from "../../components/Icon.svelte";
import {
  Badge,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/index.js";
import { EVENT_TYPES } from "../../lib/catalog.svelte.js";
import { FILTER_LABELS, filterValueLabel, splitFilter } from "./labels.js";

let { filters, query = "", onadd, onremove, ontoggle, onquery } = $props();

const FIELDS = [
  ["type", "challenge, redeem or siteverify"],
  ["outcome", "pass, flagged, fail, block or limit"],
  ["ip", "203.0.113.7"],
  ["country", "Two-letter code, like US"],
  ["asn_org", "Network name, like Hetzner"],
  ["asn", "Network number, like 24940"],
  ["browser", "Chrome, Safari, Firefox"],
  ["os", "Windows, macOS, Android"],
  ["platform", "Desktop, Phone or Tablet"],
  ["origin", "Website the widget ran on"],
  ["flag", "A risk signal id"],
  ["agent", "An AI agent id"],
  ["verdict", "ok, suspicious, automated or agent"],
  ["reason", "Why a solve failed"],
  ["rule", "A rule id"],
  ["fp", "Hashed IP, browser and language"],
  ["token_id", "Token id"],
  ["lang", "Language, like en-US"],
  ["protocol", "hashwx or sha256-pow"],
];
const ALIASES = {
  event: "type",
  network: "asn_org",
  website: "origin",
  visitor: "fp",
  signal: "flag",
  device: "platform",
  system: "os",
  token: "token_id",
  language: "lang",
};
const VALUES = {
  type: Object.keys(EVENT_TYPES),
  outcome: ["pass", "flagged", "fail", "block", "limit"],
  platform: ["Desktop", "Phone", "Tablet"],
  verdict: ["ok", "suspicious", "automated", "agent", "no_interaction"],
  protocol: ["hashwx", "sha256-pow"],
};
const SHOWN = { fp: "visitor", token_id: "token" };
const TOKEN = /(-?)([a-z_]+):("([^"]*)"|\S+)(?=\s|$)/gi;

let text = $state(untrack(() => query));
let focused = $state(false);
let active = $state(0);
let input = $state(null);
let timer;
let sent = untrack(() => query);

$effect(() => {
  const v = query;
  untrack(() => {
    if (v !== sent) text = sent = v;
  });
});

const field = (name) => {
  const k = name.toLowerCase();
  return ALIASES[k] ?? (FILTER_LABELS[k] ? k : null);
};
const clean = (f, v) =>
  f === "country" ? v.toUpperCase() : f === "asn" ? v.replace(/^as/i, "") : v;

const word = $derived(text.split(/\s/).at(-1) ?? "");
const suggestions = $derived.by(() => {
  const m = word.match(/^(-?)([a-z_]+):(.*)$/i);
  if (m) {
    const f = field(m[2]);
    const opts = (f && VALUES[f]) || [];
    return opts
      .filter((v) =>
        v.toLowerCase().startsWith(m[3].replace(/^"/, "").toLowerCase()),
      )
      .map((v) => ({
        kind: "value",
        f,
        v,
        neg: m[1],
        label: filterValueLabel(f, v),
      }));
  }
  const w = word.replace(/^-/, "").toLowerCase();
  return FIELDS.filter(
    ([k]) => k.startsWith(w) || FILTER_LABELS[k].toLowerCase().startsWith(w),
  ).map(([k, hint]) => ({
    kind: "field",
    f: k,
    neg: word.startsWith("-") ? "-" : "",
    label: FILTER_LABELS[k],
    hint,
  }));
});
const open = $derived(
  focused && suggestions.length > 0 && (word.length > 0 || !text),
);

const commit = (final = false) => {
  let rest = text;
  for (const m of [...text.matchAll(TOKEN)]) {
    if (!final && m.index + m[0].length === text.length) continue;
    const f = field(m[2]);
    if (!f) continue;
    onadd(`${m[1]}${f}:${clean(f, m[4] ?? m[3])}`);
    rest = rest.replace(m[0], "");
  }
  rest = rest.replace(/\s+/g, " ").trimStart();
  if (rest !== text) text = final ? rest.trim() : rest;
  const typing =
    !final && suggestions.some((x) => x.kind === "field") ? word : "";
  const q = text
    .slice(0, text.length - typing.length)
    .replace(/-?[a-z_]+:("[^"]*"?|\S*)/gi, (m) =>
      field(m.replace(/^-/, "").split(":")[0]) ? "" : m,
    )
    .replace(/\s+/g, " ")
    .trim();
  clearTimeout(timer);
  const send = () => {
    sent = q;
    onquery(q);
  };
  if (final) send();
  else timer = setTimeout(send, 300);
};

const pick = (s) => {
  const head = text.slice(0, text.length - word.length);
  if (s.kind === "field") {
    text = `${head}${s.neg}${SHOWN[s.f] ?? s.f}:`;
  } else {
    text = head;
    onadd(`${s.neg}${s.f}:${s.v}`);
  }
  active = 0;
  input?.focus();
};

const keydown = (e) => {
  if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    const n = suggestions.length;
    active = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
    return;
  }
  if (open && word && (e.key === "Tab" || e.key === "Enter")) {
    e.preventDefault();
    pick(suggestions[active]);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    commit(true);
    return;
  }
  if (e.key === "Escape") {
    focused = false;
    return;
  }
  if (e.key === "Backspace" && !text && filters.length)
    onremove(filters.at(-1));
};
</script>

<div class="relative w-full">
  <InputGroup
    class="h-auto min-h-9 cursor-text flex-wrap gap-1 bg-card py-1 pe-1"
    onclick={() => input?.focus()}
  >
    <InputGroupAddon class="py-0 pe-1">
      <Icon name="search" size={15} />
    </InputGroupAddon>
    {#each filters as f (f)}
      {@const c = splitFilter(f)}
      <Badge variant="secondary" class="h-7 max-w-full gap-0 rounded-md p-0 font-normal">
        <button
          type="button"
          class="flex h-full min-w-0 cursor-pointer items-center gap-1 rounded-s-md ps-2 pe-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={c.neg ? "Show only these instead" : "Hide these instead"}
          onclick={() => ontoggle(f)}
        >
          <span class="shrink-0 text-muted-foreground">{FILTER_LABELS[c.field] ?? c.field}{c.neg ? " is not" : ""}</span>
          <span class="truncate font-medium">{filterValueLabel(c.field, c.value)}</span>
        </button>
        <button
          type="button"
          class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-e-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:text-foreground"
          aria-label="Remove {FILTER_LABELS[c.field] ?? c.field} filter"
          onclick={() => onremove(f)}
        >
          <Icon name="x" size={12} />
        </button>
      </Badge>
    {/each}
    <InputGroupInput
      bind:ref={input}
      bind:value={text}
      id="evSearch"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-expanded={open}
      aria-controls="evSearchList"
      aria-autocomplete="list"
      aria-activedescendant={open ? `evSearchOpt${active}` : undefined}
      class="h-7 min-w-40 px-1"
      placeholder={filters.length ? "Add a filter" : "Search, or filter with country:US"}
      oninput={() => {
        active = 0;
        commit();
      }}
      onkeydown={keydown}
      onfocus={() => (focused = true)}
      onblur={() => setTimeout(() => (focused = false), 120)}
    />
    {#if filters.length || text}
      <InputGroupAddon align="inline-end" class="py-0">
        <InputGroupButton
          size="icon-xs"
          aria-label="Clear search and filters"
          onclick={(e) => {
            e.stopPropagation();
            text = sent = "";
            for (const f of [...filters]) onremove(f);
            onquery("");
          }}
        >
          <Icon name="x" size={14} />
        </InputGroupButton>
      </InputGroupAddon>
    {/if}
  </InputGroup>
  {#if open}
    <ul
      id="evSearchList"
      role="listbox"
      class="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-overlay"
    >
      {#each suggestions as s, i (`${s.f}:${s.v ?? ""}`)}
        <li
          id="evSearchOpt{i}"
          role="option"
          aria-selected={i === active}
          class="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 {i === active ? 'bg-muted' : ''}"
          onpointerdown={(e) => {
            e.preventDefault();
            pick(s);
          }}
          onpointermove={() => (active = i)}
        >
          {#if s.kind === "field"}
            <span class="font-mono text-[0.9em]">{SHOWN[s.f] ?? s.f}:</span>
            <span class="truncate text-muted-foreground">{s.hint}</span>
          {:else}
            <span class="font-mono text-[0.9em]"><span class="text-muted-foreground">{SHOWN[s.f] ?? s.f}:</span>{s.v}</span>
            {#if s.label !== s.v}<span class="truncate text-muted-foreground">{s.label}</span>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
