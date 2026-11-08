import { flushSync } from "svelte";

const queue = [];
let scheduled = false;

const run = () => {
  scheduled = false;
  const start = performance.now();
  while (queue.length && performance.now() - start < 12) {
    const release = queue.shift();
    try {
      flushSync(release);
    } catch (e) {
      try {
        release();
      } catch {}
      console.error(e);
    }
  }
  if (queue.length) schedule();
};

const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => setTimeout(run));
  setTimeout(() => {
    if (scheduled) run();
  }, 250);
};

export function queueReveal(release) {
  queue.push(release);
  schedule();
  return () => {
    const i = queue.indexOf(release);
    if (i !== -1) queue.splice(i, 1);
  };
}
