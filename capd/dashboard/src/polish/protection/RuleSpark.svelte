<script>
let { series = [], tone = "var(--muted-foreground)", bars = 24 } = $props();

const points = $derived.by(() => {
  if (!series.length) return [];
  const size = series.length / bars;
  return Array.from({ length: bars }, (_, i) => {
    let sum = 0;
    for (let j = Math.floor(i * size); j < Math.floor((i + 1) * size); j++)
      sum += series[j] ?? 0;
    return sum;
  });
});
const peak = $derived(Math.max(1, ...points));
</script>

<svg
  viewBox="0 0 {bars * 3 - 1} 16"
  width={bars * 3 - 1}
  height="16"
  class="shrink-0 overflow-visible"
  aria-hidden="true"
>
  {#each points as n, i (i)}
    <rect
      x={i * 3}
      width="2"
      rx="0.5"
      y={16 - (n ? Math.max(2, (n / peak) * 16) : 1)}
      height={n ? Math.max(2, (n / peak) * 16) : 1}
      fill={n ? tone : "var(--muted-foreground)"}
      fill-opacity={n ? 0.85 : 0.2}
    />
  {/each}
</svg>
