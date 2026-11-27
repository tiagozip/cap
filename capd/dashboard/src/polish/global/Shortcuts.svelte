<script>
import { Dialog } from "bits-ui";
import DialogOverlay from "../../components/ui/dialog/DialogOverlay.svelte";
import { palette } from "../../lib/ui.svelte.js";

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

const GROUPS = [
  {
    name: "General",
    items: [
      ["Open command menu", [mod, "K"]],
      ["Show keyboard shortcuts", ["?"]],
      ["Focus search", ["/"]],
      ["Toggle sidebar", [mod, "B"]],
      ["Undo last change", [mod, "Z"]],
      ["Create site key", ["C"]],
    ],
  },
  {
    name: "Go to",
    chord: true,
    items: [
      ["Overview", ["G", "O"]],
      ["Events", ["G", "E"]],
      ["Protection", ["G", "P"]],
      ["Key settings", ["G", "S"]],
      ["Instance settings", ["G", "I"]],
      ["API and MCP", ["G", "A"]],
      ["Switch site key", ["G", "K"]],
    ],
  },
  {
    name: "Overview",
    items: [
      ["Chart metric", ["1", "5"], "to"],
      ["Previous or next range", ["[", "]"], "or"],
    ],
  },
  {
    name: "Events",
    items: [
      ["Next or previous event", ["J", "K"], "or"],
      ["Expand or collapse a group", ["L", "H"], "or"],
    ],
  },
];
</script>

<Dialog.Root bind:open={palette.shortcuts}>
  <Dialog.Portal>
    <DialogOverlay />
    <Dialog.Content
      data-slot="dialog-content"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        e.currentTarget?.focus?.();
      }}
      class="fixed top-1/2 left-1/2 z-[91] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[30rem] sm:max-w-[46rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground outline-none"
    >
      <div class="flex shrink-0 items-center justify-between px-6 pt-6 pb-2">
        <Dialog.Title class="text-[17px] font-semibold">Keyboard shortcuts</Dialog.Title>
        <Dialog.Close class="inline-flex h-7 cursor-pointer items-center rounded-md border border-border px-2 text-[12px] text-muted-foreground transition-[background-color,color] duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">Esc</Dialog.Close>
      </div>
      <div class="overflow-y-auto px-6 pb-6 sm:grid sm:grid-cols-2 sm:gap-x-10">
        {#each GROUPS as g}
          <section class="mt-4 first:mt-2 sm:[&:nth-child(2)]:mt-2">
            <h3 class="mb-1 text-[13px] font-medium text-muted-foreground">{g.name}</h3>
            <dl>
              {#each g.items as [label, keys, joiner]}
                <div class="flex h-10 items-center justify-between gap-4 border-b border-border/60 last:border-b-0">
                  <dt class="text-[14px]">{label}</dt>
                  <dd class="flex items-center gap-1 text-[12px] text-muted-foreground">
                    {#each keys as k, i}
                      {#if i && (g.chord || joiner)}<span class="px-0.5 text-faint-foreground">{joiner ?? "then"}</span>{/if}
                      <kbd class="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted/50 px-1.5 font-sans text-[12px] text-foreground">{k}</kbd>
                    {/each}
                  </dd>
                </div>
              {/each}
            </dl>
          </section>
        {/each}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
