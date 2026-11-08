<script>
import { Button, Icon, Input } from "../../components/cap/index.js";
import { normalizeOrigin } from "./origins.js";

let { values = $bindable(), bad = $bindable({}), id, describedby } = $props();

const tidy = () => {
  const empties = values.flatMap((v, i) => (v.trim() ? [] : [i]));
  if (!empties.length) {
    values.push("");
    return;
  }
  if (empties.length > 1)
    values = values.filter((v, i) => v.trim() || i === empties[0]);
};

tidy();
</script>

<div class="flex flex-col gap-2">
  {#each values as _, i}
    <div class="flex items-center gap-2">
      <Input
        id="{id}-{i}"
        type="text"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        mono
        aria-label="Allowed website {i + 1}"
        invalid={!!bad[i]}
        aria-describedby={bad[i] ? describedby : undefined}
        placeholder="example.com"
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
      />
      <Button
        variant="ghost"
        icon
        aria-label={values[i]?.trim() ? `Remove ${values[i]}` : "Clear this row"}
        onclick={() => {
          values = values.filter((_, j) => j !== i);
          bad = {};
          tidy();
        }}
      >
        <Icon name="x" size={15} />
      </Button>
    </div>
  {/each}
  <p class="text-xs text-pretty text-muted-foreground">*.example.com covers every subdomain of example.com. A * inside a name, as in app*.example.com, stands for any letters, digits or dashes.</p>
</div>
