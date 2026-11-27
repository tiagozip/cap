const MAX_BYTES = 750_000;
const MAX_EDGE = 2560;

const encode = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export const prepareImage = async (file) => {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => null);
  if (!bitmap)
    return { error: "That file isn't an image this browser can open." };
  try {
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 6; round++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.78, 0.7]) {
        let blob = await encode(canvas, "image/webp", quality);
        if (blob?.type !== "image/webp")
          blob = await encode(canvas, "image/jpeg", quality);
        if (blob && blob.size <= MAX_BYTES)
          return { blob, width: canvas.width, height: canvas.height };
      }
      scale *= 0.75;
    }
    return { error: "That image is too detailed to fit in 750 KB." };
  } finally {
    bitmap.close();
  }
};
