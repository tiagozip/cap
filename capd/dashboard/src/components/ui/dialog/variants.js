import { tv } from "tailwind-variants";

export const dialogContentVariants = tv({
  base: "fixed top-1/2 left-1/2 z-[91] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl bg-popover px-7 pt-7 pb-5 text-sm text-popover-foreground outline-none",
  variants: {
    size: {
      default: "sm:max-w-sm",
      sm: "sm:max-w-lg",
      md: "sm:max-w-2xl",
      lg: "sm:max-w-3xl",
      xl: "sm:max-w-4xl",
    },
  },
  defaultVariants: { size: "default" },
});
