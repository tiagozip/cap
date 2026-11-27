<script>
import { cubicOut } from "svelte/easing";

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

const arrive = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches
    ? { duration: 0 }
    : {
        duration: 420,
        easing: cubicOut,
        css: (t, u) =>
          `opacity:${t};transform:translateY(${u * 0.35}em);filter:blur(${u * 3}px)`,
      };
</script>

<span class="odometer {className}">
  <span class="sr-only">{text}</span>
  <span class="odometer-track" aria-hidden="true">
    {#each chars as { c, key } (key)}
      <span class="odometer-cell" in:arrive>
        {#if c >= "0" && c <= "9"}
          <span class="odometer-slot">
            <span class="odometer-reel" style:--d={c} style:--i={Math.min(key, 4)}>
              {#each DIGITS as digit (digit)}<span>{digit}</span>{/each}
            </span>
          </span>
        {:else}
          <span class="whitespace-pre">{c}</span>
        {/if}
      </span>
    {/each}
  </span>
</span>

<style>
  .odometer {
    display: inline-flex;
    font-variant-numeric: tabular-nums;
  }

  .odometer-track,
  .odometer-cell {
    display: inline-flex;
  }

  .odometer-slot {
    --bleed: 0.16em;
    display: inline-block;
    height: calc(1lh + 2 * var(--bleed));
    margin-block: calc(-1 * var(--bleed));
    padding-block: var(--bleed);
    overflow: hidden;
    mask-image: linear-gradient(
      transparent,
      #000 var(--bleed),
      #000 calc(100% - var(--bleed)),
      transparent
    );
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
      transition: translate 760ms cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--i) * 40ms);
    }
  }
</style>
