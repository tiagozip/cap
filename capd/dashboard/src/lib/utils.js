import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

export const scrollToTop = (el, smooth = false) => {
  if (!el) return;
  let box = el.parentElement;
  while (box && box !== document.body) {
    const { overflowY } = getComputedStyle(box);
    if (/auto|scroll/.test(overflowY) && box.scrollHeight > box.clientHeight)
      break;
    box = box.parentElement;
  }
  const scroller =
    box && box !== document.body ? box : document.scrollingElement;
  const offset =
    el.getBoundingClientRect().top -
    (scroller === document.scrollingElement
      ? 0
      : scroller.getBoundingClientRect().top) -
    (Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  scroller.scrollTo({
    top: scroller.scrollTop + offset,
    behavior:
      smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "smooth"
        : "auto",
  });
};
