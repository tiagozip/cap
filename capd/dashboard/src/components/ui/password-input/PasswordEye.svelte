<script>
let { revealed = false } = $props();

const uid = $props.id();
const open = "M 2 12 C 5.5 4.6 18.5 4.6 22 12 C 18.5 19.4 5.5 19.4 2 12 Z";
const closed = "M 2 10 C 5.5 15.5 18.5 15.5 22 10 C 18.5 15.5 5.5 15.5 2 10 Z";
const lashes = [
  ["M 5.4 15.75 L 5.4 15.75", "M 5.4 14 L 3.9 16.4"],
  ["M 12 17.55 L 12 17.55", "M 12 15.4 L 12 18.2"],
  ["M 18.6 15.75 L 18.6 15.75", "M 18.6 14 L 20.1 16.4"],
];
const lid = $derived(revealed ? open : closed);
</script>

<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="size-[18px]"
  aria-hidden="true"
>
  <path class="eye-morph" d={lid} style:d={`path("${lid}")`} />
  {#each lashes as [a, b] (a)}
    {@const d = revealed ? a : b}
    <path
      class="eye-morph eye-lash"
      stroke-width="1.5"
      {d}
      style:d={`path("${d}")`}
      style:opacity={revealed ? 0 : 1}
      style:transition-delay={revealed ? "0ms, 0ms" : "0ms, 80ms"}
    />
  {/each}
  <clipPath id={`eye-${uid}`}>
    <path class="eye-morph" d={lid} style:d={`path("${lid}")`} />
  </clipPath>
  <circle cx="12" cy="12" r="2.5" clip-path={`url(#eye-${uid})`} />
</svg>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .eye-morph {
      transition: d 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .eye-lash {
      transition:
        d 200ms cubic-bezier(0.23, 1, 0.32, 1),
        opacity 120ms cubic-bezier(0.23, 1, 0.32, 1);
    }
  }
</style>
