<script>
const {
  value = 0,
  format = (v) => String(v),
  class: className = "",
} = $props();

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const text = $derived(format(value));
const chars = $derived(
  [...text]
    .reverse()
    .map((c, i) => ({ c, key: i }))
    .reverse(),
);
</script>

<span class="odometer {className}">
  <span class="sr-only">{text}</span>
  <span class="odometer-track" aria-hidden="true">
    {#each chars as { c, key } (key)}
      {#if c >= "0" && c <= "9"}
        <span class="odometer-slot">
          <span class="odometer-reel" style:--d={c}>
            {#each DIGITS as digit (digit)}<span>{digit}</span>{/each}
          </span>
        </span>
      {:else}
        <span>{c}</span>
      {/if}
    {/each}
  </span>
</span>

<style>
  .odometer {
    display: inline-flex;
    font-variant-numeric: tabular-nums;
  }

  .odometer-track {
    display: inline-flex;
  }

  .odometer-slot {
    display: inline-block;
    height: 1lh;
    overflow: hidden;
  }

  .odometer-reel {
    display: flex;
    flex-direction: column;
    translate: 0 calc(var(--d) * -1lh);
  }

  .odometer-reel > span {
    height: 1lh;
  }

  @media (prefers-reduced-motion: no-preference) {
    .odometer-reel {
      transition: translate 900ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  }
</style>
