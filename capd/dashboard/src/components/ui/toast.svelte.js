export const toasts = $state({ notes: [], paused: false });

const timers = new Map();
let nextId = 0;

export const lifetimeOf = (note) => {
  if (note.state === "pending") return null;
  if (note.lifetime !== undefined) return note.lifetime;
  return note.action ? 6000 : note.description ? 4000 : 2400;
};

const schedule = (note) => {
  const existing = timers.get(note.id);
  if (existing) clearTimeout(existing.handle);
  const left = lifetimeOf(note);
  if (left === null) {
    timers.delete(note.id);
    return;
  }
  const timer = { left, started: performance.now(), handle: 0 };
  if (!toasts.paused)
    timer.handle = setTimeout(() => dismissToast(note.id), left);
  timers.set(note.id, timer);
};

export const dismissToast = (id) => {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer.handle);
  timers.delete(id);
  const note = toasts.notes.find((item) => item.id === id);
  toasts.notes = toasts.notes.filter((item) => item.id !== id);
  note?.onclose?.();
};

export const pauseToasts = (pause) => {
  if (pause === toasts.paused) return;
  toasts.paused = pause;
  const now = performance.now();
  for (const [id, timer] of timers) {
    if (pause) {
      clearTimeout(timer.handle);
      timer.left -= now - timer.started;
    } else {
      timer.started = now;
      timer.handle = setTimeout(
        () => dismissToast(id),
        Math.max(0, timer.left),
      );
    }
  }
};

export const toast = (input) => {
  const detail = typeof input === "string" ? { message: input } : input;
  const note = { ...detail, id: detail.id ?? `toast-${++nextId}` };
  const index = toasts.notes.findIndex((item) => item.id === note.id);
  toasts.notes =
    index === -1
      ? [note, ...toasts.notes]
      : toasts.notes.map((item, at) => (at === index ? note : item));
  schedule(note);
  return note.id;
};

toast.success = (message, rest) =>
  toast({ ...rest, message, state: "success" });
toast.error = (message, rest) => toast({ ...rest, message, state: "error" });
toast.warning = (message, rest) =>
  toast({ ...rest, message, state: "warning" });
toast.info = (message, rest) => toast({ ...rest, message, state: "info" });
toast.pending = (message, rest) =>
  toast({ ...rest, message, state: "pending" });
toast.dismiss = dismissToast;
