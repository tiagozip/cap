import { tv } from "tailwind-variants";

export const toggleVariants = tv({
  base: "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-ring outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [--toggle-on:color-mix(in_oklch,var(--muted),var(--foreground)_8%)] aria-pressed:bg-(--toggle-on) aria-pressed:hover:bg-(--toggle-on) data-[state=on]:bg-(--toggle-on) data-[state=on]:hover:bg-(--toggle-on) dark:[--toggle-on:var(--muted)] dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    variant: {
      default: "bg-transparent",
      outline: "border border-input bg-transparent hover:bg-muted",
    },
    size: {
      default: "h-8 min-w-8 px-2",
      sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-1.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
      lg: "h-9 min-w-9 px-2.5",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
