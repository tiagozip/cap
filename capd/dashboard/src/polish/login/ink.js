const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    linear(Number.parseInt(hex.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const inkOver = (image, width, height, focus = [50, 50]) => {
  try {
    const w = 64;
    const h = Math.max(1, Math.round((w * height) / width));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h + 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;
    ctx.drawImage(
      image,
      ((w - dw) * focus[0]) / 100,
      ((h - dh) * focus[1]) / 100,
      dw,
      dh,
    );
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--sidebar")
      .trim();
    ctx.fillRect(0, h, 1, 1);
    const tint = ctx.getImageData(0, h, 1, 1).data;
    const half = Math.max(1, Math.min(w / 2, (208 / width) * w));
    const x = Math.floor(w / 2 - half);
    const y = Math.floor(h * 0.55);
    const { data } = ctx.getImageData(
      x,
      y,
      Math.ceil(half * 2),
      Math.max(1, Math.ceil(h * 0.8) - y),
    );
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [0, 1, 2].map((c) =>
        linear(data[i + c] * 0.6 + tint[c] * 0.4),
      );
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return sum / (data.length / 4) < 0.18 ? "light" : "dark";
  } catch {
    return null;
  }
};

export const inkForColor = (hex) => (luminance(hex) < 0.18 ? "light" : "dark");
