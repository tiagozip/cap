<script>
import Dialog from "../../components/cap/Dialog.svelte";
import Input from "../../components/cap/Input.svelte";

let { open = $bindable(false), title, rows, header, row } = $props();

let query = $state("");

const filtered = $derived.by(() => {
  const q = query.trim().toLowerCase();
  if (!q) return rows ?? [];
  return (rows ?? []).filter((r) => r.name.toLowerCase().includes(q));
});
</script>

<Dialog bind:open {title} size="md" onclose={() => (query = "")}>
  <Input icon="search" type="search" placeholder="Search {title.toLowerCase()}" aria-label="Search {title.toLowerCase()}" bind:value={query} />
  <div class="-mx-2 overflow-y-auto" style:height={rows.length > 8 ? "min(60dvh, 26rem)" : undefined}>
    {@render header()}
    <ul class="flex flex-col gap-0.5">
      {#each filtered as r, i (r.value)}{@render row(r, i)}{/each}
    </ul>
    {#if !filtered.length}
      <p class="py-8 text-center text-sm text-muted-foreground">Nothing matches "{query}"</p>
    {/if}
  </div>
</Dialog>
