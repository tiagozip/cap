<script>
let { tone = "ok", live = false, class: className = "", children } = $props();
</script>

<span class="health {className}" data-tone={tone}>
  <span class="light" aria-hidden="true">
    {#if live && tone !== "off"}<span class="halo"></span>{/if}
    <span class="dot"></span>
  </span>
  <span class="label">{@render children()}</span>
</span>

<style>
  .health {
    --tone: var(--color-success);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    white-space: nowrap;
  }

  .health[data-tone="warn"] {
    --tone: var(--color-warning);
  }

  .health[data-tone="bad"] {
    --tone: var(--color-destructive);
  }

  .health[data-tone="info"] {
    --tone: var(--color-info);
  }

  .health[data-tone="off"] {
    --tone: var(--color-muted-foreground);
  }

  .light {
    position: relative;
    display: grid;
    place-items: center;
    width: 0.5rem;
    height: 0.5rem;
  }

  .dot,
  .halo {
    grid-area: 1 / 1;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--tone);
  }

  .dot {
    transition: background-color 300ms ease-out;
  }

  .halo {
    opacity: 0;
  }

  .label {
    color: var(--color-foreground);
  }

  .health[data-tone="warn"] .label,
  .health[data-tone="bad"] .label {
    color: var(--tone);
  }

  @media (prefers-reduced-motion: no-preference) {
    .halo {
      animation: halo 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }
  }

  @keyframes halo {
    0% {
      opacity: 0.55;
      transform: scale(1);
    }
    70%,
    100% {
      opacity: 0;
      transform: scale(3);
    }
  }
</style>
