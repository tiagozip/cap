<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  variant = "default",
  dynamic = true,
  label,
  ...rest
} = $props();

const uid = $props.id();
const boxes = { default: 20, gradient: 21, bars: 18.4 };
const round = (value) => String(Math.round(value * 1000) / 1000);
const viewBoxFor = (box, centerY = 12) => {
  const side = 24 * (box / boxes.default);
  return `${round(12 - side / 2)} ${round(centerY - side / 2)} ${round(side)} ${round(side)}`;
};
const between = (min, max) => min + Math.random() * (max - min);
const easings = [
  "cubic-bezier(0.37, 0, 0.63, 1)",
  "cubic-bezier(0.45, 0, 0.55, 1)",
  "cubic-bezier(0.65, 0, 0.35, 1)",
];

let arc = $state(null);

$effect(() => {
  const circle = arc;
  if (
    !circle ||
    variant !== "default" ||
    !dynamic ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  let rotation = 0;
  let length = 75;
  const step = () => {
    const nextLength = between(18, 72);
    const nextRotation = rotation + between(45, 180);
    const animation = circle.animate(
      {
        rotate: [
          `${rotation - length * 1.8}deg`,
          `${nextRotation - nextLength * 1.8}deg`,
        ],
        strokeDasharray: [`${length} 100`, `${nextLength} 100`],
      },
      {
        duration: between(600, 1200),
        easing: easings[Math.floor(Math.random() * easings.length)],
        fill: "forwards",
      },
    );
    animation.onfinish = step;
    rotation = nextRotation % 360;
    length = nextLength;
  };
  step();
  return () => {
    for (const animation of circle.getAnimations()) {
      animation.onfinish = null;
      animation.cancel();
    }
  };
});
</script>

{#if variant === "gradient"}
  <svg
    viewBox={viewBoxFor(boxes.gradient, 12.06)}
    fill="none"
    data-slot="spinner"
    data-variant={variant}
    role="status"
    aria-label={label ?? t("Loading")}
    class={cn("size-4 animate-spin", className)}
    {...rest}
  >
    <defs>
      <linearGradient id={`spinner-head-${uid}`} x1="50%" x2="50%" y1="5.271%" y2="91.793%">
        <stop offset="0%" stop-color="currentColor" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.55" />
      </linearGradient>
      <linearGradient id={`spinner-tail-${uid}`} x1="50%" x2="50%" y1="15.24%" y2="87.15%">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.55" />
      </linearGradient>
    </defs>
    <path
      d="M8.749.021a1.5 1.5 0 0 1 .497 2.958A7.5 7.5 0 0 0 3 10.375a7.5 7.5 0 0 0 7.5 7.5v3c-5.799 0-10.5-4.7-10.5-10.5C0 5.23 3.726.865 8.749.021"
      fill={`url(#spinner-head-${uid})`}
      transform="translate(1.5 1.625)"
    />
    <path
      d="M15.392 2.673a1.5 1.5 0 0 1 2.119-.115A10.48 10.48 0 0 1 21 10.375c0 5.8-4.701 10.5-10.5 10.5v-3a7.5 7.5 0 0 0 5.007-13.084a1.5 1.5 0 0 1-.115-2.118"
      fill={`url(#spinner-tail-${uid})`}
      transform="translate(1.5 1.625)"
    />
  </svg>
{:else if variant === "bars"}
  <svg
    viewBox={viewBoxFor(boxes.bars)}
    data-slot="spinner"
    data-variant={variant}
    role="status"
    aria-label={label ?? t("Loading")}
    class={cn("size-4", className)}
    {...rest}
  >
    {#each Array.from({ length: 12 }, (_, index) => index) as index (index)}
      <rect
        class="t-spinner-bar"
        x="16"
        y="11.1"
        width="5.2"
        height="1.8"
        rx="0.9"
        fill="currentColor"
        transform={`rotate(${index * 30} 12 12)`}
        style:animation-delay={`calc(var(--spinner-bars-dur) * ${(index - 11) / 12})`}
      />
    {/each}
  </svg>
{:else}
  <svg
    viewBox={viewBoxFor(boxes.default)}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    data-slot="spinner"
    data-variant={variant}
    data-dynamic={dynamic || undefined}
    role="status"
    aria-label={label ?? t("Loading")}
    class={cn("size-4 animate-spin", className)}
    {...rest}
  >
    <circle
      bind:this={arc}
      cx="12"
      cy="12"
      r="9"
      pathLength="100"
      stroke-dasharray="75 100"
      class="origin-center -rotate-135 transform-fill"
    />
  </svg>
{/if}
