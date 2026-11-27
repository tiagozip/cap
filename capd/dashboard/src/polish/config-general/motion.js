import { cubicOut } from "svelte/easing";

const still = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export const glide = (_node, { from, to }) => {
  const dy = from.top - to.top;
  if (still() || !dy) return { duration: 0 };
  return {
    duration: 220,
    easing: cubicOut,
    css: (_t, u) => `transform:translateY(${u * dy}px)`,
  };
};
