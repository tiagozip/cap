<script>
const lines = Array.from({ length: 30 }, (_, n) => {
  const i = n < 15 ? n - 15 : n - 14;
  const d = i * 30;
  const pts = [];
  for (let x = -40; x <= 1640; x += 20) {
    const g = Math.exp(-(((x - 800) / 340) ** 2));
    const y =
      425 + Math.sign(i) * Math.sqrt(d * d + (i < 0 ? 215 : 300) ** 2 * g);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
});

const packets = [
  [13, 9, 0],
  [16, 11, 3.5],
  [11, 13, 6.2],
  [18, 10, 1.8],
  [9, 12, 8.4],
  [20, 14, 4.9],
  [14, 8.5, 10.1],
  [6, 15, 2.7],
  [23, 12.5, 7.3],
];
</script>

<div class="backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
  <svg class="size-full" viewBox="0 0 1600 960" preserveAspectRatio="xMidYMid slice" fill="none">
    {#each lines as d, i}
      <path class="line" class:strong={i % 5 === 2} {d} />
    {/each}
    {#each packets as [line, duration, delay]}
      <g style:--dur="{duration}s" style:--delay="-{delay}s">
        <path class="trail" d={lines[line]} pathLength="1" />
        <path class="head" d={lines[line]} pathLength="1" />
      </g>
    {/each}
  </svg>
</div>

<style>
  .backdrop {
    mask-image: radial-gradient(ellipse 75% 70% at 50% 50%, #000 25%, transparent 100%);
  }

  .line {
    stroke: color-mix(in oklab, var(--foreground) 7%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .line.strong {
    stroke: color-mix(in oklab, var(--foreground) 12%, transparent);
  }

  .trail,
  .head {
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    opacity: 0;
  }

  .trail {
    stroke: color-mix(in oklab, var(--foreground) 22%, transparent);
    stroke-width: 1;
    stroke-dasharray: 0.12 1.3;
  }

  .head {
    stroke: color-mix(in oklab, var(--foreground) 70%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 0.025 1.4;
  }

  @media (prefers-reduced-motion: no-preference) {
    .trail,
    .head {
      opacity: 1;
      animation: travel var(--dur) var(--delay) linear infinite;
    }

    .trail {
      --from: 0.12;
      --to: -1;
    }

    .head {
      --from: 0.025;
      --to: -1.095;
    }
  }

  @keyframes travel {
    from {
      stroke-dashoffset: var(--from);
    }
    to {
      stroke-dashoffset: var(--to);
    }
  }
</style>
