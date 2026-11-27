<script>
import { tick } from "svelte";
import { Button, Icon, Input } from "../../components/cap/index.js";
import { glide } from "../../polish/config-general/motion.js";
import { normalizeOrigin } from "./origins.js";

let { values = $bindable(), bad = $bindable({}), id, describedby } = $props();

let seq = 0;
let ids = $state([]);
let list;

const tidy = () => {
  if (ids.length !== values.length) ids = values.map(() => seq++);
  const empties = values.flatMap((v, i) => (v.trim() ? [] : [i]));
  if (!empties.length) {
    values.push("");
    ids.push(seq++);
    return;
  }
  if (empties.length > 1) {
    const keep = (v, i) => v.trim() || i === empties[0];
    ids = ids.filter((_, i) => keep(values[i], i));
    values = values.filter(keep);
  }
};

$effect.pre(() => {
  values.length;
  tidy();
});

const rows = $derived(values.map((_, i) => ({ id: ids[i] ?? `r${i}`, i })));
const invalid = $derived(Object.keys(bad).length > 0);
</script>

<div class="flex flex-col gap-2" bind:this={list}>
  {#each rows as row (row.id)}
    {@const i = row.i}
    {@const filled = !!values[i]?.trim()}
    <div
      class="flex items-center"
      data-origin-row
      animate:glide
    >
      <Input
        id="{id}-{i}"
        type="text"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        mono
        aria-label="Allowed website {i + 1}"
        invalid={!!bad[i]}
        aria-describedby={bad[i] ? (describedby ?? `${id}-hint`) : undefined}
        placeholder={filled || i === 0 ? "example.com" : "Add another"}
        bind:value={values[i]}
        oninput={() => {
          bad = {};
          tidy();
        }}
        onblur={() => {
          const raw = values[i]?.trim();
          if (!raw) return;
          const normalized = normalizeOrigin(raw);
          if (!normalized) {
            bad = { ...bad, [i]: true };
            return;
          }
          values[i] = normalized;
        }}
      >
        {#snippet suffix()}
          {#if filled}
            <Button
              variant="ghost"
              size="sm"
              icon
              class="size-7 text-muted-foreground transition-[color,scale] duration-150 ease-(--ease-out) hover:text-foreground active:scale-[0.94] motion-reduce:transition-none"
              aria-label="Remove {values[i]}"
              onclick={async (e) => {
                e.currentTarget.closest("[data-origin-row]").inert = true;
                values = values.filter((_, j) => j !== i);
                ids = ids.filter((_, j) => j !== i);
                bad = {};
                tidy();
                await tick();
                const inputs = list.querySelectorAll("[data-origin-row]:not([inert]) input");
                inputs[Math.min(i, inputs.length - 1)]?.focus();
              }}
            >
              <Icon name="x" size={14} />
            </Button>
          {/if}
        {/snippet}
      </Input>
    </div>
  {/each}
  {#if invalid}
    {#if !describedby}<p id="{id}-hint" class="text-sm text-destructive">Enter a website like example.com or *.example.com.</p>{/if}
  {:else}
    <p class="text-xs text-pretty text-muted-foreground">*.example.com allows every subdomain. app*.example.com allows app1, app-eu and so on.</p>
  {/if}
</div>
