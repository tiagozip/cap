<script>
import { t } from "../../lib/i18n.svelte.js";
import Icon from "../Icon.svelte";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/index.js";
import Button from "./Button.svelte";

let { value, ranges, onchange, class: className = "" } = $props();

const current = $derived(ranges.find((r) => r.id === value) ?? ranges[0]);
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} class="focus-visible:z-10 {className}" aria-label={t("Time range: {label}", { label: current.label })}>
        {current.label}
        <Icon name="selector" size={13} class="-mr-0.5 text-muted-foreground" />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="z-[95] w-48 min-w-0">
    <DropdownMenuRadioGroup
      bind:value={
        () => value,
        (id) => {
          if (id !== value) onchange(id);
        }
      }
    >
      {#each ranges as r (r.id)}
        <DropdownMenuRadioItem value={r.id}>
          {r.label}
          <DropdownMenuShortcut>{r.short}</DropdownMenuShortcut>
        </DropdownMenuRadioItem>
      {/each}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
