<script>
import { url } from "../../lib/api.js";
import { fieldLines as lines } from "../../polish/login/field.js";
import { inkForColor, inkOver } from "../../polish/login/ink.js";

let {
  custom = $bindable(false),
  ink = $bindable(null),
  photo = $bindable(false),
} = $props();

let backdrop = $state(null);

(window.CAP_PAGE?.loginBackground
  ? Promise.resolve(window.CAP_PAGE.loginBackground)
  : fetch(url("login-background.json"))
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
).then((meta) => {
  if (meta?.mode === "color" && /^#[0-9a-f]{6}$/i.test(meta.color ?? "")) {
    backdrop = meta;
    custom = true;
    ink = inkForColor(meta.color);
    return;
  }
  if (meta?.mode !== "image" || !meta.version) {
    backdrop = { mode: "default" };
    return;
  }
  const src = url(`login-background?v=${encodeURIComponent(meta.version)}`);
  const image = new Image();
  const focus =
    Array.isArray(meta.focus) &&
    meta.focus.length === 2 &&
    meta.focus.every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
      ? meta.focus
      : [50, 50];
  image.onload = () => {
    backdrop = { mode: "image", src, focus };
    custom = true;
    photo = true;
    ink = inkOver(image, innerWidth, innerHeight, focus);
  };
  image.onerror = () => {
    backdrop = { mode: "default" };
  };
  image.src = src;
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

{#if backdrop?.mode === "image"}
  <div class="custom pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <div class="photo absolute inset-0 bg-cover" style:background-image="url({JSON.stringify(backdrop.src)})" style:background-position="{backdrop.focus[0]}% {backdrop.focus[1]}%"></div>
    <div class="scrim absolute inset-0"></div>
  </div>
{:else if backdrop?.mode === "color"}
  <div class="custom pointer-events-none fixed inset-0 -z-10" aria-hidden="true" style:background-color={backdrop.color}></div>
{:else if backdrop}
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
{/if}

<style>
  .scrim {
    background: radial-gradient(
      ellipse 42rem 36rem at 50% 46%,
      color-mix(in oklab, var(--sidebar) 60%, transparent),
      color-mix(in oklab, var(--sidebar) 16%, transparent)
    );
  }

  @media (prefers-reduced-motion: no-preference) {
    .custom,
    .backdrop {
      animation: backdrop-in 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .photo {
      animation: photo-settle 1200ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  }

  @keyframes backdrop-in {
    from {
      opacity: 0;
    }
  }

  @keyframes photo-settle {
    from {
      transform: scale(1.03);
    }
  }

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
