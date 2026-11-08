export const menuSizes = {
  sm: {
    panel: "min-w-36 rounded-lg p-1",
    row: "gap-1.5 rounded-md px-1.5 py-1 text-sm",
    check: "gap-1.5 rounded-md py-1 ps-1.5 pe-8 text-sm",
    mark: "end-2",
    inset: "data-inset:ps-6.5",
    icon: "[&_svg:not([class*='size-'])]:size-3.5",
    label: "px-1.5 py-1 text-xs",
    separator: "-mx-1 my-1",
    shortcut: "text-xs",
  },
  default: {
    panel: "min-w-48 rounded-xl p-1.5",
    row: "gap-2 rounded-lg px-2.5 py-1.5 text-sm",
    check: "gap-2 rounded-lg py-1.5 ps-2.5 pe-9 text-sm",
    mark: "end-2.5",
    inset: "data-inset:ps-8.5",
    icon: "[&_svg:not([class*='size-'])]:size-4",
    label: "px-2.5 py-1 text-xs",
    separator: "-mx-1.5 my-1.5",
    shortcut: "text-xs",
  },
};

export const itemBase =
  "flex cursor-default items-center outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0";

export const sizeKey = Symbol("dropdown-menu-size");
