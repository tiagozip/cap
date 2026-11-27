<script>
import { untrack } from "svelte";

const { name, paths, swap = true, class: className, ...rest } = $props();

let shown = untrack(() => name);
let prev = $state();
let turn = $state(0);

$effect.pre(() => {
  const next = name;
  untrack(() => {
    if (next === shown) return;
    if (swap) {
      prev = shown;
      turn++;
    }
    shown = next;
  });
});
</script>

{#key turn}
  <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class={[className, turn && "swapped"]} {...rest}>
    {#if turn}
      <g class="leave">
        {#each [paths[prev] ?? []].flat() as d (d)}<path {d} />{/each}
      </g>
    {/if}
    <g class={turn ? "enter" : undefined}>
      {#each [paths[name] ?? []].flat() as d (d)}<path {d} />{/each}
    </g>
  </svg>
{/key}

<style>
  g {
    transform-box: view-box;
    transform-origin: center;
  }

  .leave {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .swapped {
      animation: glyph-focus 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .enter {
      animation: glyph-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .leave {
      animation: glyph-leave 140ms ease-in;
    }

    svg:global(.spin) {
      animation: glyph-spin 800ms linear infinite;
    }
  }

  @keyframes glyph-enter {
    from {
      opacity: 0;
      scale: 0.5;
    }
  }

  @keyframes glyph-leave {
    from {
      opacity: 1;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 0.5;
    }
  }

  @keyframes glyph-focus {
    from {
      filter: blur(3px);
    }
  }

  @keyframes glyph-spin {
    to {
      rotate: 360deg;
    }
  }
</style>
