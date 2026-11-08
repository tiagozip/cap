export const toasts = $state({ notes: [] });

const timers = new Map();
let nextId = 0;
let paused = false;

const lifetimeOf = (note) => {
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
  if (!paused) timer.handle = setTimeout(() => dismissToast(note.id), left);
  timers.set(note.id, timer);
};

export const dismissToast = (id) => {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer.handle);
  timers.delete(id);
  toasts.notes = toasts.notes.filter((note) => note.id !== id);
};

export const pauseToasts = (pause) => {
  if (pause === paused) return;
  paused = pause;
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
