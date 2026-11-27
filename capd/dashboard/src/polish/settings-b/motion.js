const calm = () =>
  !matchMedia("(prefers-reduced-motion: no-preference)").matches;

export const leave = async (node) => {
  if (!node || calm()) return;
  await node.animate(
    [
      { opacity: 1, filter: "blur(0)" },
      { opacity: 0, filter: "blur(4px)" },
    ],
    { duration: 160, easing: "ease-in", fill: "forwards" },
  ).finished;
};
