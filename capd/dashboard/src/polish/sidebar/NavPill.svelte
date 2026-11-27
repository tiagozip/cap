<script>
import { untrack } from "svelte";

let { active } = $props();

let el = $state();
let y = $state(0);
let h = $state(0);
let shown = $state(false);
let slide = $state(false);
let ready = $state(false);

$effect(() => {
  active;
  const list = el.parentElement;
  const btn = list.querySelector("[data-active]");
  const was = untrack(() => shown);
  slide = was && !!btn;
  shown = !!btn;
  if (!btn) return;
  y = btn.closest("li").offsetTop + btn.offsetTop;
  h = btn.offsetHeight;
});

$effect(() => {
  const id = requestAnimationFrame(() => {
    ready = true;
  });
  return () => cancelAnimationFrame(id);
});
</script>

<li
  bind:this={el}
  class="pill"
  class:ready
  class:slide
  class:shown
  style:height="{h}px"
  style:transform="translateY({y}px)"
  role="presentation"
  aria-hidden="true"
></li>

<style>
  .pill {
    position: absolute;
    inset-inline: 0;
    top: 0;
    border-radius: var(--radius-md);
    background: var(--nav-active);
    pointer-events: none;
    opacity: 0;
  }

  .shown {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .ready {
      transition: opacity 150ms ease-out;
    }

    .ready.slide {
      transition:
        transform 260ms cubic-bezier(0.32, 0.72, 0, 1),
        opacity 150ms ease-out;
    }
  }
</style>
