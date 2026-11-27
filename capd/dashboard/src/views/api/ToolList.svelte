<script>
import { Button, Icon, Input, Tag } from "../../components/cap/index.js";
import { loadTools } from "./tools.js";

let tools = $state(null);
let open = $state(false);
let query = $state("");

loadTools().then((t) => {
  tools = t;
});

const words = (text) => text.toLowerCase().split(/[^a-z0-9]+/);
const matches = $derived.by(() => {
  const q = words(query).filter(Boolean);
  if (!q.length) return tools ?? [];
  return (tools ?? []).filter((t) => {
    const hay = words(`${t.title} ${t.name} ${t.description}`);
    return q.every((w) => hay.some((h) => h.startsWith(w)));
  });
});
const groups = $derived(
  [
    ["Read", matches.filter((t) => !t.write)],
    ["Change", matches.filter((t) => t.write)],
  ].filter(([, list]) => list.length),
);
const reads = $derived(tools?.filter((t) => !t.write).length ?? 0);
</script>

{#if tools?.length}
  <div class="flex flex-col gap-3 py-5">
    <div class="flex items-center justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-0.5">
        <p class="text-sm font-medium">Tools</p>
        <p class="text-sm text-muted-foreground tabular-nums">
          {tools.length} tools. Read-only apps get the {reads} that only read.
        </p>
      </div>
      <Button size="sm" class="shrink-0" aria-expanded={open} aria-controls="mcp-tools" onclick={() => (open = !open)}>
        <Icon name="down" size={14} class="tools-chevron {open ? 'rotate-180' : ''}" />
        {open ? "Hide" : "Show"}
      </Button>
    </div>
    {#if open}
      <div id="mcp-tools" class="tools flex flex-col gap-4">
      <Input size="sm" type="search" icon="search" class="sm:max-w-xs" placeholder="Filter tools" aria-label="Filter tools" bind:value={query} />
      {#if !groups.length}
        <p class="text-sm text-muted-foreground">No tools match.</p>
      {/if}
      <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {#each groups as [label, list] (label)}
          <section class="flex min-w-0 flex-col gap-2" aria-labelledby="mcp-tools-{label}">
            <h3 id="mcp-tools-{label}" class="text-xs font-medium text-muted-foreground">{label}</h3>
            <ul class="flex flex-col gap-2.5">
              {#each list as t (t.name)}
                <li class="flex min-w-0 flex-col gap-0.5">
                  <span class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-sm font-medium" title={t.name}>{t.title}</span>
                    {#if t.destructive}<Tag tone="danger">Deletes</Tag>{/if}
                  </span>
                  <span class="text-xs text-pretty text-muted-foreground">{t.description}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(.tools-chevron) {
    transition-property: transform;
    transition-duration: 200ms;
    transition-timing-function: var(--ease-out);
  }

  @media (prefers-reduced-motion: no-preference) {
    .tools {
      animation: tools-in 240ms var(--ease-out);
    }
  }

  @keyframes tools-in {
    from {
      opacity: 0;
      filter: blur(3px);
      transform: translateY(-4px);
    }
  }
</style>
