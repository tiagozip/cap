<script>
const { name, class: className, size = 24, stroke = 2, ...rest } = $props();

const circle = "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0";
const paths = {
  "chevron-down": ["M6 9l6 6l6 -6"],
  "chevron-up": ["M6 15l6 -6l6 6"],
  "chevron-right": ["M9 6l6 6l-6 6"],
  "chevron-left": ["M15 6l-6 6l6 6"],
  selector: ["M8 9l4 -4l4 4", "M16 15l-4 4l-4 -4"],
  check: ["M5 12l5 5l10 -10"],
  x: ["M18 6l-12 12", "M6 6l12 12"],
  plus: ["M12 5l0 14", "M5 12l14 0"],
  minus: ["M5 12l14 0"],
  dots: [
    "M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
    "M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
    "M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  ],
  search: ["M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0", "M21 21l-6 -6"],
  eye: [
    "M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
    "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6",
  ],
  "eye-off": [
    "M10.585 10.587a2 2 0 0 0 2.829 2.828",
    "M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87",
    "M3 3l18 18",
  ],
  copy: [
    "M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z",
    "M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
  ],
  "layout-sidebar": [
    "M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z",
    "M9 4l0 16",
  ],
  "info-circle": [circle, "M12 9h.01", "M11 12h1v4h1"],
  "alert-circle": [circle, "M12 8v4", "M12 16h.01"],
  "circle-check": [circle, "M9 12l2 2l4 -4"],
  "alert-triangle": [
    "M12 9v4",
    "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z",
    "M12 16h.01",
  ],
  download: [
    "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",
    "M7 11l5 5l5 -5",
    "M12 4l0 12",
  ],
  terminal: ["M5 7l5 5l-5 5", "M12 19l7 0"],
  code: ["M7 8l-4 4l4 4", "M17 8l4 4l-4 4", "M14 4l-4 16"],
};
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class={className}
  {...rest}
>
  {#each paths[name] ?? [] as d (d)}
    <path {d} />
  {/each}
</svg>
