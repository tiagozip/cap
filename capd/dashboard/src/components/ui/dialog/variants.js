import { tv } from "tailwind-variants";

export const dialogContentVariants = tv({
  base: "fixed top-1/2 left-1/2 z-[91] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl bg-popover px-7 pt-7 pb-5 text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-2xl duration-250 ease-out outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 motion-reduce:data-[state=closed]:zoom-out-100 motion-reduce:data-[state=closed]:slide-out-to-bottom-0 motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=open]:slide-in-from-bottom-0",
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
