import { toast as kitToast } from "../components/ui/toast.svelte.js";

export const ui = $state({ confirm: null });

export const toast = (text, kind = "ok") => {
  if (kind === "error") return kitToast.error(text);
  return kitToast.success(text);
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
