import { tv } from "tailwind-variants";

export const buttonVariants = tv({
  base: "group/button relative isolate inline-flex shrink-0 items-center justify-center rounded-lg bg-clip-padding text-sm font-medium whitespace-nowrap transition-ring outline-none select-none before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:border before:border-transparent before:transition-[scale,background-color,border-color] before:duration-150 before:ease-out focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:before:transition-none active:not-aria-[haspopup]:not-data-[variant=push]:before:scale-[0.985] data-[state=on]:not-data-[variant=push]:before:scale-[0.985] [&.w-full]:motion-safe:active:not-aria-[haspopup]:not-data-[variant=push]:before:scale-[0.997_0.985] [&.w-full]:motion-safe:data-[state=on]:not-data-[variant=push]:before:scale-[0.997_0.985] motion-reduce:active:before:scale-100 motion-reduce:data-[state=on]:before:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  variants: {
    variant: {
      default: "t-raise t-raise-primary text-primary-foreground",
      outline: "t-raise t-raise-outline text-foreground",
      secondary: "t-raise t-raise-secondary text-secondary-foreground",
      ghost:
        "text-foreground hover:before:bg-foreground/7 aria-expanded:before:bg-foreground/7 active:not-aria-[haspopup]:before:bg-foreground/12 data-[state=on]:before:bg-foreground/12",
      destructive:
        "t-raise t-raise-destructive text-destructive-foreground focus-visible:ring-destructive/40",
      link: "text-primary underline-offset-4 hover:underline",
      push: [
        "t-push",
        "text-foreground before:border-(color:--push-face) before:bg-background hover:before:bg-muted aria-expanded:before:bg-muted dark:before:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)] dark:hover:before:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_18%)] dark:aria-expanded:before:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)]",
        "[--push-face:color-mix(in_oklch,var(--border),black_6%)] dark:[--push-face:color-mix(in_oklch,var(--secondary),black_38%)]",
        "shadow-[0_var(--push-lift)_0_0_var(--push-face),0_7px_8px_-6px_var(--push-cast)]",
        "before:shadow-[inset_0_1px_0_0_var(--push-sheen)]",
        "hover:-translate-y-(--push-hover) hover:shadow-[0_calc(var(--push-lift)_+_var(--push-hover))_0_0_var(--push-face),0_9px_11px_-7px_var(--push-cast)]",
        "active:translate-y-(--push-travel) active:shadow-[0_calc(var(--push-lift)_-_var(--push-travel))_0_0_var(--push-face),0_2px_3px_-2px_var(--push-cast)]",
        "[--push-cast:rgb(0_0_0/0.08)] dark:[--push-cast:rgb(0_0_0/0.5)]",
        "[--push-sheen:rgb(255_255_255/0.16)] dark:[--push-sheen:rgb(255_255_255/0.28)]",
      ],
    },
    size: {
      default: "h-8 gap-1.5 px-2.5",
      xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
      sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
      lg: "h-9 gap-2 px-4",
      icon: "size-8",
      "icon-xs":
        "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
      "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
      "icon-lg": "size-9",
    },
    rounded: { true: "rounded-full", false: "" },
    flat: { true: "t-flat", false: "" },
  },
  compoundVariants: [
    {
      rounded: true,
      size: "xs",
      class: "px-3",
    },
    {
      rounded: true,
      size: "sm",
      class: "px-3.5",
    },
    {
      rounded: true,
      size: "default",
      class: "px-3.5",
    },
    {
      rounded: true,
      size: "lg",
      class: "px-5",
    },
    {
      variant: "default",
      flat: true,
      class: "before:bg-primary hover:before:bg-primary/80",
    },
    {
      variant: "outline",
      flat: true,
      class:
        "before:border-border before:bg-background hover:before:bg-muted aria-expanded:before:bg-muted dark:before:border-input dark:before:bg-input/30 dark:hover:before:bg-input/50",
    },
    {
      variant: "secondary",
      flat: true,
      class:
        "before:bg-secondary hover:before:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:before:bg-secondary",
    },
    {
      variant: "destructive",
      flat: true,
      class:
        "before:bg-destructive hover:before:bg-destructive/90 dark:before:bg-[color-mix(in_oklch,var(--destructive),black_28%)] dark:hover:before:bg-[color-mix(in_oklch,var(--destructive),black_18%)]",
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "default",
    rounded: false,
    flat: false,
  },
});
