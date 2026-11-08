<script>
import { onMount } from "svelte";
import { scrollToTop } from "../../lib/utils.js";

let { items, label = "Sections" } = $props();
let current = $state(items[0]?.id);

onMount(() => {
  const root = document.getElementById("main");
  if (!root) return;
  const update = () => {
    const top = root.getBoundingClientRect().top + 96;
    let next = items[0]?.id;
    for (const it of items) {
      const el = document.getElementById(it.id);
      if (el && el.getBoundingClientRect().top <= top) next = it.id;
    }
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4)
      next = items.at(-1)?.id;
    current = next;
  };
  update();
  root.addEventListener("scroll", update, { passive: true });
  return () => root.removeEventListener("scroll", update);
});
</script>

<nav class="sticky top-16 w-44 shrink-0 self-start max-lg:hidden" aria-label={label}>
  <ul class="flex flex-col gap-0.5">
    {#each items as it (it.id)}
      <li>
        <a
          href="#{it.id}"
          aria-current={current === it.id ? "true" : undefined}
          class="flex h-8 items-center rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring {current === it.id
            ? 'bg-nav-active font-medium text-foreground'
            : 'text-muted-foreground [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground'}"
          onclick={(e) => {
            e.preventDefault();
            scrollToTop(document.getElementById(it.id), true);
          }}
        >
          {it.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
