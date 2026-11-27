<script>
import { untrack } from "svelte";
import { cubicOut } from "svelte/easing";
import Icon from "../../components/Icon.svelte";
import {
  Badge,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/index.js";
import { EVENT_TYPES } from "../../lib/catalog.svelte.js";
import { compact } from "../../lib/format.js";
import { FILTER_LABELS, filterValueLabel, splitFilter } from "./labels.js";

let {
  filters,
  query = "",
  busy = false,
  onadd,
  onremove,
  ontoggle,
  onquery,
  suggest,
  onreplace,
  storeKey = "",
} = $props();

const FIELDS = [
  ["type", "challenge, redeem or siteverify"],
  ["outcome", "pass, flagged, fail, block or limit"],
  ["ip", "203.0.113.7"],
  ["country", "Two-letter code, like US"],
  ["city", "City name, like Lisbon"],
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
let moved = $state(false);
let input = $state(null);
let timer;
let sent = untrack(() => query);
let slow = $state(false);
let dyn = $state(null);
const recentKey = untrack(() => `cap_events_recent:${storeKey}`);
let recent = $state(
  (() => {
    try {
      const list = JSON.parse(localStorage.getItem(recentKey) ?? "[]");
      return Array.isArray(list) ? list.slice(0, 5) : [];
    } catch {
      return [];
    }
  })(),
);
const sameSearch = (a, b) =>
  a.q === b.q &&
  a.filters.length === b.filters.length &&
  a.filters.every((f) => b.filters.includes(f));

$effect(() => {
  const now = { filters: [...filters], q: query };
  if (!now.filters.length && !now.q) return;
  const t = setTimeout(() => {
    recent = [now, ...recent.filter((r) => !sameSearch(r, now))].slice(0, 5);
    try {
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch {}
  }, 1500);
  return () => clearTimeout(t);
});

const describe = (r) =>
  [
    ...r.filters.map((f) => {
      const c = splitFilter(f);
      return `${FILTER_LABELS[c.field] ?? c.field}${c.neg ? " is not" : ""} ${filterValueLabel(c.field, c.value)}`;
    }),
    ...(r.q ? [`"${r.q}"`] : []),
  ].join(", ");
let asked = 0;

const fetchValues = async () => {
  const my = ++asked;
  const res = await suggest?.();
  if (my === asked && res) dyn = res;
};

$effect(() => {
  if (!busy) {
    slow = false;
    return;
  }
  const t = setTimeout(() => {
    slow = true;
  }, 180);
  return () => clearTimeout(t);
});

$effect(() => {
  filters.length;
  query;
  untrack(() => {
    if (focused) fetchValues();
  });
});

const settle = () =>
  matchMedia("(prefers-reduced-motion: no-preference)").matches
    ? {
        duration: 180,
        easing: cubicOut,
        css: (t) =>
          `opacity:${t};transform:scale(${0.94 + t * 0.06});filter:blur(${(1 - t) * 2}px)`,
      }
    : {};

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
const valueRow = (f, v, n, neg) => ({
  kind: "value",
  f,
  v,
  n,
  neg,
  label: filterValueLabel(f, v),
});
const suggestions = $derived.by(() => {
  const m = word.match(/^(-?)([a-z_]+):(.*)$/i);
  if (m) {
    const f = field(m[2]);
    if (!f) return [];
    const want = m[3].replace(/^"/, "").toLowerCase();
    const live = (dyn?.[f] ?? []).filter(
      (r) => r.value !== "" && r.value != null,
    );
    const opts = live.length
      ? live.map((r) => valueRow(f, String(r.value), r.n, m[1]))
      : (VALUES[f] ?? []).map((v) => valueRow(f, v, null, m[1]));
    return opts
      .filter(
        (o) =>
          o.v.toLowerCase().startsWith(want) ||
          (want && o.label.toLowerCase().includes(want)),
      )
      .slice(0, 8);
  }
  const w = word.replace(/^-/, "").toLowerCase();
  const neg = word.startsWith("-") ? "-" : "";
  const fields = FIELDS.filter(
    ([k]) => k.startsWith(w) || FILTER_LABELS[k].toLowerCase().startsWith(w),
  ).map(([k, hint]) => ({
    kind: "field",
    f: k,
    neg,
    label: FILTER_LABELS[k],
    hint,
  }));
  if (!text && onreplace) {
    const now = { filters, q: query };
    const past = recent
      .filter((r) => !sameSearch(r, now))
      .slice(0, 4)
      .map((r, i) => ({
        kind: "recent",
        any: true,
        f: "recent",
        v: String(i),
        r,
        label: describe(r),
      }));
    return [...past, ...fields];
  }
  if (w.length < 2 || !dyn) return fields;
  const hits = Object.entries(dyn)
    .flatMap(([f, list]) =>
      (Array.isArray(list) ? list : [])
        .filter((r) => r.value !== "" && r.value != null)
        .map((r) => valueRow(f, String(r.value), r.n, neg)),
    )
    .filter(
      (o) =>
        o.v.toLowerCase().startsWith(w) ||
        o.label
          .toLowerCase()
          .split(/[\s.,()-]+/)
          .some((x) => x.startsWith(w)),
    )
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((o) => ({ ...o, any: true }));
  return [...fields.slice(0, hits.length ? 3 : fields.length), ...hits];
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
  if (s.kind === "recent") {
    text = "";
    onreplace(s.r.filters, s.r.q);
  } else if (s.kind === "field") {
    text = `${head}${s.neg}${SHOWN[s.f] ?? s.f}:`;
  } else {
    text = head;
    onadd(`${s.neg}${s.f}:${s.v}`);
    commit(true);
  }
  active = 0;
  moved = false;
  input?.focus();
};

const keydown = (e) => {
  if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    const n = suggestions.length;
    active = moved
      ? (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n
      : e.key === "ArrowDown"
        ? suggestions[0]?.any
          ? 0
          : Math.min(1, n - 1)
        : n - 1;
    moved = true;
    return;
  }
  if (
    open &&
    (word || moved) &&
    (e.key === "Tab" ||
      (e.key === "Enter" && (moved || !suggestions[active]?.any)))
  ) {
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
      <span class="relative grid size-[15px] place-items-center" aria-hidden="true">
        <Icon name="search" size={15} class="ev-swap col-start-1 row-start-1 {slow ? 'off' : ''}" />
        {#if busy}<Icon name="loader" size={15} class="ev-swap col-start-1 row-start-1 {slow ? '' : 'off'}" />{/if}
      </span>
    </InputGroupAddon>
    {#each filters as f (f)}
      {@const c = splitFilter(f)}
      <span class="flex max-w-full" in:settle>
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
      </span>
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
      aria-activedescendant={open && (moved || !suggestions[active]?.any) ? `evSearchOpt${active}` : undefined}
      class="h-7 min-w-40 px-1"
      placeholder={filters.length ? "Add a filter" : "Search, or filter with country:US"}
      oninput={() => {
        focused = true;
        active = 0;
        moved = false;
        commit();
      }}
      onkeydown={keydown}
      onfocus={() => {
        focused = true;
        fetchValues();
      }}
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
          aria-selected={i === active && (moved || !s.any)}
          class="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 {i === active && (moved || !s.any) ? 'bg-muted' : ''}"
          onpointerdown={(e) => {
            e.preventDefault();
            pick(s);
          }}
          onpointermove={() => {
            active = i;
            moved = true;
          }}
        >
          {#if s.kind === "recent"}
            <Icon name="clock" size={14} class="shrink-0 text-muted-foreground" />
            <span class="truncate">{s.label}</span>
          {:else if s.kind === "field"}
            <span class="w-20 shrink-0 font-mono text-[0.9em]">{SHOWN[s.f] ?? s.f}:</span>
            <span class="truncate text-muted-foreground">{s.hint}</span>
          {:else if s.any}
            <span class="w-20 shrink-0 truncate text-muted-foreground">{FILTER_LABELS[s.f] ?? s.f}</span>
            <span class="truncate">{s.label}</span>
            {#if s.n != null}<span class="ms-auto ps-2 text-xs text-muted-foreground tabular-nums">{compact(s.n)}</span>{/if}
          {:else}
            <span class="truncate font-mono text-[0.9em]"><span class="text-muted-foreground">{SHOWN[s.f] ?? s.f}:</span>{s.v}</span>
            {#if s.label !== s.v}<span class="truncate text-muted-foreground">{s.label}</span>{/if}
            {#if s.n != null}<span class="ms-auto ps-2 text-xs text-muted-foreground tabular-nums">{compact(s.n)}</span>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  :global(.ev-swap) {
    transition: opacity 160ms var(--ease-out);
  }

  :global(.ev-swap.off) {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    :global(.ev-swap) {
      transition-property: opacity, scale, filter;
    }

    :global(.ev-swap.off) {
      scale: 0.25;
      filter: blur(4px);
    }
  }
</style>
