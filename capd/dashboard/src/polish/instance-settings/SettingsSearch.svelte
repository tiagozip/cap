<script>
import { onMount } from "svelte";
import { Input } from "../../components/cap/index.js";
import Kbd from "../../components/ui/kbd/Kbd.svelte";

let { sections, onpick, children } = $props();

let query = $state("");
let active = $state(0);
let input = $state(null);
let focused = $state(false);
let narrow = $state(false);

const words = (text) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const entries = $derived(
  sections.flatMap((s) =>
    (s.items ?? [[s.title, ""]]).map(([label, terms = ""]) => ({
      key: `${s.id}:${label}`,
      section: s.id,
      sectionTitle: s.title,
      label,
      own: words(label),
      all: words(`${label} ${s.title} ${terms}`),
    })),
  ),
);

const tokens = $derived(words(query));

const browsing = $derived(!tokens.length && focused && narrow);

const results = $derived.by(() => {
  if (browsing)
    return sections.map((s) => ({
      key: s.id,
      section: s.id,
      sectionTitle: s.title,
      label: s.title,
    }));
  if (!tokens.length) return [];
  return entries
    .filter((e) => tokens.every((t) => e.all.some((w) => w.startsWith(t))))
    .map((e) => ({
      ...e,
      score: tokens.filter((t) => !e.own.some((w) => w.startsWith(t))).length,
    }))
    .toSorted((a, b) => a.score - b.score)
    .slice(0, 8);
});

const parts = (label) => {
  const lower = label.toLowerCase();
  const marks = tokens
    .map((t) => {
      const m = new RegExp(`(^|[^a-z0-9])${t}`).exec(lower);
      return m && [m.index + m[1].length, m.index + m[0].length];
    })
    .filter(Boolean)
    .toSorted((a, b) => a[0] - b[0]);
  const out = [];
  let at = 0;
  for (const [from, to] of marks) {
    if (from < at) continue;
    out.push([label.slice(at, from), false], [label.slice(from, to), true]);
    at = to;
  }
  out.push([label.slice(at), false]);
  return out.filter(([text]) => text);
};

const pick = (r) => {
  if (!r) return;
  query = "";
  input?.blur();
  onpick(r.section, r.label);
};

const onkeydown = (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!results.length) return;
    e.preventDefault();
    const step = e.key === "ArrowDown" ? 1 : -1;
    active =
      active < 0 && step < 0
        ? results.length - 1
        : (active + step + results.length) % results.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    pick(results[active]);
  } else if (e.key === "Escape" && query) {
    e.preventDefault();
    e.stopPropagation();
    query = "";
  }
};

onMount(() => {
  const media = matchMedia("(max-width: 1023px)");
  const fit = () => {
    narrow = media.matches;
  };
  fit();
  media.addEventListener("change", fit);
  const focusKey = (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (
      t?.isContentEditable ||
      /^(input|textarea|select)$/i.test(t?.tagName ?? "")
    )
      return;
    if (
      document.querySelector(
        "[role=dialog][data-state=open], [role=alertdialog][data-state=open]",
      )
    )
      return;
    e.preventDefault();
    input?.focus();
  };
  window.addEventListener("keydown", focusKey, true);
  return () => {
    window.removeEventListener("keydown", focusKey, true);
    media.removeEventListener("change", fit);
  };
});
</script>

<div class="flex flex-col gap-3">
  <Input
    bind:ref={input}
    bind:value={query}
    icon="search"
    size="sm"
    type="search"
    role="combobox"
    autocomplete="off"
    spellcheck="false"
    placeholder="Search settings"
    aria-label="Search settings"
    aria-expanded={tokens.length > 0 || browsing}
    onfocus={() => {
      focused = true;
      active = narrow && !tokens.length ? -1 : 0;
    }}
    onblur={() => (focused = false)}
    aria-controls="settings-search-results"
    aria-activedescendant={results.length && active >= 0 ? `settings-search-${active}` : undefined}
    aria-keyshortcuts="/"
    oninput={() => (active = 0)}
    {onkeydown}
  >
    {#snippet suffix()}
      {#if !query}
        <span class="flex pe-1 max-lg:hidden" aria-hidden="true"><Kbd size="sm">/</Kbd></span>
      {/if}
    {/snippet}
  </Input>

  {#if tokens.length || browsing}
    <ul id="settings-search-results" role="listbox" aria-label={browsing ? "Settings sections" : "Matching settings"} class="flex flex-col gap-0.5">
      {#each results as r, i (r.key)}

        <li
          id="settings-search-{i}"
          role="option"
          aria-selected={i === active}
          class="result flex min-h-8 cursor-pointer max-lg:min-h-11 flex-col justify-center rounded-md px-2 py-1.5 text-sm {i === active ? 'bg-nav-active text-foreground' : 'text-muted-foreground'}"
          onpointermove={() => (active = i)}
          onpointerdown={(e) => e.preventDefault()}
          onpointerup={() => pick(r)}
        >
          <span class="leading-5 text-pretty">{#each parts(r.label) as [text, hit], j (j)}{#if hit}<span class="text-foreground">{text}</span>{:else}{text}{/if}{/each}</span>
          {#if r.sectionTitle !== r.label}<span class="text-xs leading-4 text-muted-foreground">{r.sectionTitle}</span>{/if}
        </li>
      {:else}
        <li class="px-2 py-1.5 text-sm text-muted-foreground" role="presentation">No settings match</li>
      {/each}
    </ul>
    <p class="sr-only" role="status">{browsing ? "" : results.length ? `${results.length} ${results.length === 1 ? "setting" : "settings"} found` : "No settings match"}</p>
  {:else}
    {@render children?.()}
  {/if}
</div>
