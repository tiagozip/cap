export const glide = (menu, pad) => {
  let shown = false;

  const place = () => {
    const item = menu.querySelector(
      "[data-highlighted]:not([data-disabled]), [data-slot=dropdown-menu-sub-trigger][data-state=open]",
    );
    if (!item) {
      delete pad.dataset.on;
      shown = false;
      return;
    }
    let x = 0;
    let y = 0;
    for (let n = item; n && n !== menu; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    pad.dataset.variant = item.dataset.variant ?? "default";
    pad.style.width = `${item.offsetWidth}px`;
    pad.style.height = `${item.offsetHeight}px`;
    pad.style.borderRadius = getComputedStyle(item).borderRadius;
    pad.dataset.jump = shown ? "" : "now";
    pad.style.translate = `${x}px ${y}px`;
    pad.dataset.on = "";
    shown = true;
  };

  const observer = new MutationObserver(place);
  observer.observe(menu, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-highlighted", "data-state"],
  });
  place();
  return () => {
    observer.disconnect();
  };
};
