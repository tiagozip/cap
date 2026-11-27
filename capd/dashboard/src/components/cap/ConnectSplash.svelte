<script>
import { playConnect } from "./connect.js";

let { origin, press, onready } = $props();

let canvas = $state();
let mark = $state(null);

$effect(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  return (
    playConnect(canvas, {
      origin,
      press,
      onready,
      onmark: (m) => {
        mark = m;
      },
    }) ?? undefined
  );
});
</script>

<canvas bind:this={canvas} class="splash pointer-events-none absolute inset-0 size-full rounded-[inherit] text-success" aria-hidden="true"></canvas>
{#if mark}
  <svg class="tick pointer-events-none absolute text-success" style:left="{mark.x}px" style:top="{mark.y}px" style:--d="{mark.delay}ms" width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
    <path d="M7.5 15.5l5 5L22.5 9.5" pathLength="1" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{/if}

<style>
  .splash {
    --splash-ink: var(--foreground);
  }

  .tick {
    translate: -50% -50%;
    animation: tick-pop 520ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--d) backwards;
  }

  .tick path {
    stroke-dasharray: 1;
    animation: tick-draw 380ms cubic-bezier(0.65, 0, 0.35, 1) var(--d) backwards;
  }

  @keyframes tick-pop {
    from {
      scale: 0.6;
      filter: blur(2px);
    }
  }

  @keyframes tick-draw {
    from {
      stroke-dashoffset: 1;
    }
  }
</style>
