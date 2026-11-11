import zhCN from "./locales/zh-cn.js";

export const LOCALES = [
  ["en", "English"],
  ["zh-CN", "简体中文"],
];

const DICTS = {
  "zh-CN": zhCN,
};

export function normalizeLocale(raw) {
  if (!raw) return "en";
  const v = String(raw).trim();
  const exact = LOCALES.find(
    ([code]) => code.toLowerCase() === v.toLowerCase(),
  );
  if (exact) return exact[0];
  if (/^zh(?:-(?:cn|hans))?$/i.test(v)) return "zh-CN";
  return "en";
}

const readLocale = () => {
  try {
    return normalizeLocale(localStorage.getItem("cap_locale"));
  } catch {
    return "en";
  }
};

export const locale = $state({ value: readLocale() });

function applyLocale() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale.value;
  }
}

applyLocale();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== "cap_locale") return;
    locale.value = normalizeLocale(e.newValue);
    applyLocale();
  });
}

export function setLocale(value) {
  const next = normalizeLocale(value);
  locale.value = next;
  try {
    localStorage.setItem("cap_locale", next);
  } catch {}
  applyLocale();
}

const interpolate = (template, vars) =>
  vars
    ? template.replace(/\{(\w+)\}/g, (m, k) =>
        Object.hasOwn(vars, k) && vars[k] != null ? String(vars[k]) : m,
      )
    : template;

export function t(key, vars) {
  if (!key) return "";
  const dict = DICTS[locale.value];
  const raw = dict && Object.hasOwn(dict, key) ? dict[key] : key;
  return typeof raw === "function" ? raw(vars ?? {}) : interpolate(raw, vars);
}

export function tx(ctx, key, vars) {
  if (!key) return "";
  const dict = DICTS[locale.value];
  const scoped = `${ctx}:${key}`;
  const raw =
    dict && Object.hasOwn(dict, scoped)
      ? dict[scoped]
      : dict && Object.hasOwn(dict, key)
        ? dict[key]
        : key;
  return typeof raw === "function" ? raw(vars ?? {}) : interpolate(raw, vars);
}

export function tp(n, one, many, vars) {
  const params = { n, count: n, ...vars };
  const dict = DICTS[locale.value];
  if (dict) {
    const key = n === 1 && Object.hasOwn(dict, one) ? one : many;
    if (Object.hasOwn(dict, key)) {
      const raw = dict[key];
      return typeof raw === "function" ? raw(params) : interpolate(raw, params);
    }
  }
  return interpolate(n === 1 ? one : many, params);
}

const dtfCache = new Map();
export const dtf = (options) => ({
  format: (date) => {
    const lang = locale.value;
    const intlLocale = lang === "en" ? undefined : lang;
    const cacheKey = `${lang}:${JSON.stringify(options ?? {})}`;
    let fmt = dtfCache.get(cacheKey);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat(intlLocale, options);
      dtfCache.set(cacheKey, fmt);
    }
    return fmt.format(date);
  },
});

const nfCache = new Map();
export function numFmt(value, options) {
  const lang = locale.value;
  const intlLocale = lang === "en" ? undefined : lang;
  const cacheKey = `${lang}:${JSON.stringify(options ?? {})}`;
  let fmt = nfCache.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.NumberFormat(intlLocale, options);
    nfCache.set(cacheKey, fmt);
  }
  return fmt.format(value ?? 0);
}
