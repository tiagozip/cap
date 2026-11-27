<script>
let { vw, vh, ink = null } = $props();

const width = $derived(Math.min(368, vw - 32));
const top = $derived(Math.max(0, (vh - 344) * 0.4) + 40);
const inkClass = $derived(
  ink === "light"
    ? "bg-white/70"
    : ink === "dark"
      ? "bg-black/55"
      : "bg-muted-foreground/50",
);
</script>

<div class="mini pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col" style:--px="calc(100cqw / {vw})" style:top="calc(var(--px) * {top})" style:width="calc(var(--px) * {width})" style:gap="calc(var(--px) * 16)" aria-hidden="true">
  <div class="card overflow-hidden border border-border bg-background">
    <div class="flex" style:height="calc(var(--px) * 44)">
      <span class="tab flex items-center border-e border-b border-border bg-sidebar">
        <img src="./public/logo-small.webp" alt="" class="logo" />
        <span class="bar bg-foreground/70" style:width="calc(var(--px) * 28)"></span>
      </span>
    </div>
    <div class="body flex flex-col">
      <span class="bar bg-foreground/75" style:width="calc(var(--px) * 52)" style:height="calc(var(--px) * 10)"></span>
      <span class="bar bg-muted-foreground/45" style:width="72%"></span>
      <span class="bar bg-foreground/60" style:width="calc(var(--px) * 64)" style:margin-top="calc(var(--px) * 20)"></span>
      <span class="field border border-input bg-foreground/[0.03]"></span>
      <span class="field bg-primary" style:margin-top="calc(var(--px) * 12)"></span>
    </div>
  </div>
  <span class="about border border-border bg-sidebar"></span>
  <span class="flex justify-between" style:padding-inline="calc(var(--px) * 4)">
    <span class="bar {inkClass}" style:width="calc(var(--px) * 34)"></span>
    <span class="bar {inkClass}" style:width="calc(var(--px) * 100)"></span>
  </span>
</div>

<style>
  .card {
    border-radius: calc(var(--px) * 12);
  }

  .tab {
    gap: calc(var(--px) * 8);
    padding-inline: calc(var(--px) * 16) calc(var(--px) * 20);
    border-end-end-radius: calc(var(--px) * 10);
  }

  .logo {
    width: calc(var(--px) * 22);
    height: calc(var(--px) * 22);
  }

  .body {
    padding: calc(var(--px) * 20);
    gap: calc(var(--px) * 9);
  }

  .bar {
    height: calc(var(--px) * 7);
    border-radius: calc(var(--px) * 3);
  }

  .field {
    height: calc(var(--px) * 36);
    border-radius: calc(var(--px) * 8);
  }

  .about {
    height: calc(var(--px) * 42);
    border-radius: calc(var(--px) * 12);
  }
</style>
