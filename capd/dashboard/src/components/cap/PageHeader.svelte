<script>
import { SidebarTrigger } from "../ui/index.js";

let { title, description, actions, children, class: className = "" } = $props();
</script>

<header class="notch-shadow sticky top-0 z-40 flex h-12 items-center border-b border-border bg-background ps-2 pe-3 md:pointer-events-none md:h-11 md:items-stretch md:border-b-0 md:bg-transparent md:px-0 md:[&>*:not(:nth-child(4))]:pointer-events-auto {className}">
  <div class="flex shrink-0 md:hidden"><SidebarTrigger label="Open menu" /></div>
  <div class="relative flex min-w-0 items-center ps-1.5 md:rounded-tl-lg md:bg-sidebar md:ps-5 md:pe-2">
    <h1 class="truncate text-[15px] font-medium text-foreground">{title}</h1>
    <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
  </div>
  <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M0 0H28C21.5 0 18.6 3 17.6 8.4L14 35.6C13 41 10 44 4 44H0Z" /><clipPath id="notch-ear-l"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#notch-ear-l)" d="M28 .5C21.8.5 19.1 3 18.1 8.5L14.5 35.5C13.5 40.8 10.3 43.5 4 43.5H0" /></svg>
  <div class="min-w-2 flex-1 md:pointer-events-none"></div>
  {#if actions}
    <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M28 0H0C6.5 0 9.4 3 10.4 8.4L14 35.6C15 41 18 44 24 44H28Z" /><clipPath id="notch-ear-r"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#notch-ear-r)" d="M0 .5C6.2.5 8.9 3 9.9 8.5L13.5 35.5C14.5 40.8 17.7 43.5 24 43.5H28" /></svg>
    <div class="relative flex shrink-0 items-center gap-2 md:rounded-tr-lg md:bg-sidebar md:pt-[3px] md:pe-[3px] md:pb-1 md:ps-1">
      {@render actions()}
      <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
    </div>
  {/if}
</header>
{#if description}<p class="px-4 pt-4 text-sm text-pretty text-muted-foreground md:px-5">{description}</p>{/if}
{#if children}<div class="flex flex-wrap items-center gap-2 px-4 pt-4 md:px-5">{@render children()}</div>{/if}
