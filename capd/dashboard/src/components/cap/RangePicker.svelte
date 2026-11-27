<script>
import Icon from "../Icon.svelte";
import DropdownMenu from "../ui/dropdown-menu/DropdownMenu.svelte";
import DropdownMenuContent from "../ui/dropdown-menu/DropdownMenuContent.svelte";
import DropdownMenuRadioGroup from "../ui/dropdown-menu/DropdownMenuRadioGroup.svelte";
import DropdownMenuRadioItem from "../ui/dropdown-menu/DropdownMenuRadioItem.svelte";
import DropdownMenuShortcut from "../ui/dropdown-menu/DropdownMenuShortcut.svelte";
import DropdownMenuTrigger from "../ui/dropdown-menu/DropdownMenuTrigger.svelte";
import Button from "./Button.svelte";

let { value, ranges, onchange, class: className = "" } = $props();

const current = $derived(ranges.find((r) => r.id === value) ?? ranges[0]);
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} class="focus-visible:z-10 {className}" aria-label="Time range: {current.label}">
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
