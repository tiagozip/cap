<script>
import { onMount } from "svelte";
import { scrollToTop } from "../../lib/utils.js";

let { items, label = "Sections" } = $props();
let current = $state(items[0]?.id);
let list = $state(null);
let y = $state(null);
let settled = $state(false);
let locked = false;
let unlockTimer;

$effect(() => {
  current;
  y = list?.querySelector("[aria-current]")?.parentElement.offsetTop ?? null;
});

const unlock = () => {
  clearTimeout(unlockTimer);
  locked = false;
};

const jump = (id) => {
  current = id;
  locked = true;
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(unlock, 1000);
  scrollToTop(document.getElementById(id), true);
};

onMount(() => {
  const root = document.getElementById("main");
  if (!root) return;
  const update = () => {
    if (locked) return;
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
  requestAnimationFrame(() => {
    settled = true;
  });
  const settle = () => {
    if (!locked) return;
    unlock();
    update();
  };
  root.addEventListener("scroll", update, { passive: true });
  root.addEventListener("scrollend", settle);
  root.addEventListener("wheel", unlock, { passive: true });
  root.addEventListener("touchstart", unlock, { passive: true });
  return () => {
    clearTimeout(unlockTimer);
    root.removeEventListener("scroll", update);
    root.removeEventListener("scrollend", settle);
    root.removeEventListener("wheel", unlock);
    root.removeEventListener("touchstart", unlock);
  };
});
</script>

<nav class="sticky top-16 w-44 shrink-0 self-start max-lg:hidden" aria-label={label}>
  {#if y !== null}
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-md bg-nav-active {settled ? 'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-(--ease-out)' : ''}"
      style:transform="translateY({y}px)"
    ></span>
  {/if}
  <ul bind:this={list} class="flex flex-col gap-0.5">
    {#each items as it (it.id)}
      <li>
        <a
          href="#{it.id}"
          aria-current={current === it.id ? "true" : undefined}
          class="relative flex h-8 items-center rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring {current === it.id
            ? 'font-medium text-foreground'
            : 'text-muted-foreground [@media(hover:hover)]:hover:bg-nav-hover [@media(hover:hover)]:hover:text-foreground'}"
          onclick={(e) => {
            e.preventDefault();
            jump(it.id);
          }}
        >
          {it.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
