export const warmth = $state({ on: false, instant: false });

let cool;

export const tooltipOpened = (open) => {
  clearTimeout(cool);
  if (!open) {
    cool = setTimeout(() => {
      warmth.on = false;
    }, 400);
    return;
  }
  warmth.instant = warmth.on;
  warmth.on = true;
};
