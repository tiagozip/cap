<script>
import { CopyText } from "../../components/cap/index.js";

let { value, label } = $props();
</script>

<div class="cm-reveal">
  <CopyText {value} {label} />
</div>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .cm-reveal :global(code) {
      animation: cm-unblur 520ms cubic-bezier(0.22, 1, 0.36, 1) 140ms both;
    }

    .cm-reveal :global([data-slot="button"]),
    .cm-reveal :global(button) {
      animation: cm-settle 320ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
    }
  }

  @keyframes cm-unblur {
    from {
      opacity: 0;
      filter: blur(6px);
      transform: translateX(-4px);
    }
  }

  @keyframes cm-settle {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
  }
</style>
