let probeCanvas;

const paint = (css) => {
  probeCanvas ??= Object.assign(document.createElement("canvas"), {
    width: 1,
    height: 1,
  });
  const ctx = probeCanvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
};

export const createResolver = (root) => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  root.appendChild(probe);
  const cache = new Map();
  const resolve = (value) => {
    if (typeof value !== "string") return value;
    const css = value.startsWith("--") ? `var(${value})` : value;
    if (
      !css.includes("var(") &&
      !css.includes("color-mix(") &&
      !css.includes("oklch(")
    )
      return value;
    if (cache.has(css)) return cache.get(css);
    probe.style.color = "";
    probe.style.color = css;
    const computed = getComputedStyle(probe).color;
    const out = paint(computed);
    cache.set(css, out);
    return out;
  };
  return {
    resolve,
    token: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
    dispose: () => probe.remove(),
  };
};

export const deepResolve = (value, resolve, skip = new Set()) => {
  if (typeof value === "string") return resolve(value);
  if (Array.isArray(value))
    return value.map((item) => deepResolve(item, resolve));
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const out = {};
    for (const [key, item] of Object.entries(value))
      out[key] = skip.has(key) ? item : deepResolve(item, resolve);
    return out;
  }
  return value;
};

export const chartColor = (index) => `var(--chart-${(index % 5) + 1})`;

export const withAlpha = (color, percent) =>
  `color-mix(in oklab, ${color.startsWith("--") ? `var(${color})` : color} ${percent}%, transparent)`;
