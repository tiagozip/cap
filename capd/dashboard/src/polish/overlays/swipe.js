const SKIP =
  "input, textarea, select, [contenteditable], [role=slider], [data-no-swipe]";

export const swipe = (sheet, side) => {
  if (side !== "left" && side !== "right") return;
  const dir = side === "right" ? 1 : -1;
  let start = null;
  let live = false;
  let samples = [];

  const overlay = () =>
    [...document.querySelectorAll("[data-slot=sheet-overlay]")].at(-1);

  const reset = () => {
    start = null;
    live = false;
    samples = [];
  };

  const down = (e) => {
    if (e.pointerType === "mouse" || !e.isPrimary || e.target.closest(SKIP))
      return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    samples = [{ x: e.clientX, t: e.timeStamp }];
  };

  const move = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!live) {
      if (Math.hypot(dx, dy) < 8) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2 || dx * dir <= 0) {
        reset();
        return;
      }
      live = true;
      sheet.setPointerCapture(e.pointerId);
      sheet.dataset.swiping = "";
    }
    const travel = Math.max(0, dx * dir);
    const pull = dx * dir < 0 ? (dx * dir) / 4 : travel;
    sheet.style.transform = `translateX(${pull * dir}px)`;
    const shade = overlay();
    if (shade)
      shade.style.opacity = String(1 - Math.min(1, travel / sheet.offsetWidth));
    samples = [...samples.slice(-4), { x: e.clientX, t: e.timeStamp }];
  };

  const up = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const wasLive = live;
    const dx = (e.clientX - start.x) * dir;
    const first = samples[0];
    const speed = first
      ? ((e.clientX - first.x) * dir) / Math.max(1, e.timeStamp - first.t)
      : 0;
    reset();
    if (!wasLive) return;
    delete sheet.dataset.swiping;
    const shade = overlay();
    if (dx > sheet.offsetWidth * 0.35 || (speed > 0.45 && dx > 24)) {
      sheet.dataset.swiped = "";
      sheet.style.transform = `translateX(${dir * (sheet.offsetWidth + 16)}px)`;
      if (shade) shade.style.opacity = "0";
      sheet.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }
    sheet.style.transform = "";
    if (shade) shade.style.opacity = "";
  };

  sheet.addEventListener("pointerdown", down);
  sheet.addEventListener("pointermove", move);
  sheet.addEventListener("pointerup", up);
  sheet.addEventListener("pointercancel", up);
  return () => {
    sheet.removeEventListener("pointerdown", down);
    sheet.removeEventListener("pointermove", move);
    sheet.removeEventListener("pointerup", up);
    sheet.removeEventListener("pointercancel", up);
  };
};
