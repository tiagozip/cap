import { untrack } from "svelte";
import { toast as kitToast } from "../components/ui/toast.svelte.js";

export const ui = $state({ confirm: null });

export const toast = (text, kind = "ok") => {
  if (kind === "error") return kitToast.error(text);
  return kitToast.success(text);
};

const pending = new Map();

addEventListener("pagehide", () => {
  for (const id of [...pending.keys()]) kitToast.dismiss(id);
});

addEventListener("keydown", (e) => {
  if (
    e.defaultPrevented ||
    e.key.toLowerCase() !== "z" ||
    !(e.metaKey || e.ctrlKey) ||
    e.shiftKey ||
    e.altKey ||
    e.target.closest?.("input, textarea, select, [contenteditable]")
  )
    return;
  const revert = [...pending.values()].at(-1);
  if (!revert) return;
  e.preventDefault();
  revert();
});

export const undoable = ({ message, commit, undo }) => {
  let settled = false;
  let id;
  const run = async () => {
    if (settled) return;
    settled = true;
    pending.delete(id);
    let error;
    try {
      error = await commit();
    } catch {
      error = true;
    }
    if (!error) return;
    await undo();
    toast(
      typeof error === "string" ? error : "Couldn't save that change",
      "error",
    );
  };
  const revert = () => {
    if (settled) return;
    settled = true;
    pending.delete(id);
    kitToast.dismiss(id);
    undo();
  };
  id = kitToast.success(message, {
    action: { label: "Undo", run: revert },
    onclose: run,
  });
  pending.set(id, revert);
  return id;
};

export const confirm = ({ title, message, confirmText, danger = false }) =>
  new Promise((resolve) => {
    ui.confirm = {
      title,
      message,
      confirmText,
      danger,
      resolve: (v) => {
        ui.confirm = null;
        resolve(v);
      },
    };
  });

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Couldn't copy, select the text and copy it yourself", "error");
  }
}

const media = matchMedia("(prefers-color-scheme: dark)");
const readTheme = () => {
  try {
    return localStorage.getItem("cap_theme") || "system";
  } catch {
    return "system";
  }
};

export const theme = $state({ value: readTheme() });

function applyTheme() {
  const dark =
    theme.value === "dark" || (theme.value === "system" && media.matches);
  const root = document.documentElement;
  root.classList.add("no-transitions");
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("no-transitions")),
  );
}

media.addEventListener(
  "change",
  () => theme.value === "system" && applyTheme(),
);

export function setTheme(value) {
  theme.value = value;
  try {
    localStorage.setItem("cap_theme", value);
  } catch {}
  applyTheme();
}

export const palette = $state({ open: false, shortcuts: false, used: false });

const providers = $state([]);

export const pageCommands = () =>
  providers.flatMap((get) => {
    try {
      return (get() ?? []).map((c) => ({
        group: "This page",
        ...c,
        id: `page:${c.id}`,
      }));
    } catch {
      return [];
    }
  });

export function provideCommands(get) {
  untrack(() => providers.push(get));
  return () =>
    untrack(() => {
      const i = providers.indexOf(get);
      if (i !== -1) providers.splice(i, 1);
    });
}

const RECENT_KEY = "cap_palette_recent";

export const readRecent = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const pushRecent = (id) => {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 8);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
};
