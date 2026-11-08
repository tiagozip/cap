<script>
let {
  copied = false,
  size = 15,
  strokeWidth = 1.8,
  class: className,
} = $props();

const uid = $props.id();
const side = 13;
const sheet = (shift) => {
  const at = 12 - side / 2 + shift * 3.25;
  return { x: at, y: at, width: side, height: side, rx: 3.75 };
};
const disc = { x: 4, y: 4, width: 16, height: 16, rx: 8 };
const front = $derived(copied ? disc : sheet(1));
const back = $derived(copied ? disc : sheet(-1));
const geometry = (pose) =>
  `x:${pose.x}px;y:${pose.y}px;width:${pose.width}px;height:${pose.height}px;rx:${pose.rx}px;`;
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  aria-hidden="true"
  data-slot="copy-check"
  data-copied={copied || undefined}
>
  <mask id={`copy-${uid}`} maskUnits="userSpaceOnUse">
    <rect width="24" height="24" fill="#fff" />
    <rect class="morph" {...front} style={geometry(front)} fill="#000" stroke="#000" stroke-width={strokeWidth + 2.4} />
  </mask>
  <rect
    class="morph back"
    data-copy-sheet="back"
    {...back}
    style={`${geometry(back)}opacity:${copied ? 0 : 1};`}
    mask={`url(#copy-${uid})`}
  />
  <rect class="morph" {...front} style={geometry(front)} />
  <path class="tick" d="M8.5 12.3L11.1 14.9L15.5 9.7" pathLength="1" stroke-dasharray="1 2" style:stroke-dashoffset={copied ? 0 : 1} />
</svg>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .morph {
      transition-property: x, y, width, height, rx;
      transition-duration: 340ms;
      transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: 70ms;
    }
    .back {
      transition-property: x, y, width, height, rx, opacity, translate;
      transition-duration: 340ms, 340ms, 340ms, 340ms, 340ms, 100ms, 160ms;
      transition-delay: 70ms, 70ms, 70ms, 70ms, 70ms, 120ms, 0ms;
    }
    .tick {
      transition: stroke-dashoffset 120ms linear;
    }
    [data-copied] .morph {
      transition-delay: 0ms;
    }
    [data-copied] .back {
      transition-duration: 340ms, 340ms, 340ms, 340ms, 340ms, 80ms, 160ms;
      transition-delay: 0ms, 0ms, 0ms, 0ms, 0ms, 40ms, 0ms;
    }
    [data-copied] .tick {
      transition: stroke-dashoffset 220ms cubic-bezier(0.22, 1, 0.36, 1) 130ms;
    }
  }
</style>
