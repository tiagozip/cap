<script>
import { t } from "../../lib/i18n.svelte.js";
</script>

<details class="about group rounded-xl border border-border bg-sidebar text-[13px] text-muted-foreground">
  <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[11px] px-4 py-2.5 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-foreground [&::-webkit-details-marker]:hidden">
    {t("What is this server?")}
    <svg class="chevron size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
  </summary>
  <div class="flex flex-col gap-2 px-4 pt-0.5 pb-3.5 leading-relaxed text-pretty">
    <p>{t("This runs Cap, an open source CAPTCHA, for a website's owner. If it shows up in your logs, that's visitors' browsers solving a short proof of work instead of an image puzzle. It isn't malware or a crypto miner.")}</p>
    <p><a class="rounded-sm text-foreground underline underline-offset-4 outline-none [text-decoration-skip-ink:auto] focus-visible:ring-2 focus-visible:ring-ring/50" href="https://trycap.dev/guide/workings" target="_blank" rel="noopener">{t("How Cap works")}</a></p>
  </div>
</details>

<style>
  .about[open] .chevron {
    rotate: 180deg;
  }

  @media (prefers-reduced-motion: no-preference) {
    .chevron {
      transition: rotate 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .about {
      interpolate-size: allow-keywords;
    }

    .about::details-content {
      block-size: 0;
      overflow: clip;
      opacity: 0;
      transition:
        block-size 260ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 200ms ease-out,
        content-visibility 260ms allow-discrete;
    }

    .about[open]::details-content {
      block-size: auto;
      opacity: 1;
    }
  }
</style>
