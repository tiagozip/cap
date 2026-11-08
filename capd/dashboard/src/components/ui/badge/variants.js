import { tv } from "tailwind-variants";

export const badgeVariants = tv({
  base: "group/badge t-label relative isolate inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent py-0.5 font-medium whitespace-nowrap transition-ring before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:border before:border-transparent before:transition-[scale,background-color,border-color] before:duration-150 before:ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:before:transition-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [a,button]:active:before:scale-[0.97] motion-reduce:[a,button]:active:before:scale-100 [&>svg]:pointer-events-none [&>svg]:size-3!",
  variants: {
    variant: {
      default: "t-raise t-raise-primary text-primary-foreground",
      secondary: "t-raise t-raise-secondary text-secondary-foreground",
      destructive:
        "t-raise t-raise-danger text-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
      outline: "t-raise t-raise-outline text-foreground",
      ghost:
        "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
      link: "text-primary underline-offset-4 hover:underline",
      blue: "t-raise t-raise-info text-[var(--badge-blue-fg)]",
      green: "t-raise t-raise-success text-[var(--badge-green-fg)]",
      amber: "t-raise t-raise-warning text-[var(--badge-amber-fg)]",
      neutral: "t-raise t-raise-secondary text-muted-foreground",
      tint: "t-raise t-raise-tint",
    },
    size: {
      default: "h-6 px-2 text-sm",
      sm: "h-5 px-1.5 text-xs",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
