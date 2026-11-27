export const fieldLines = Array.from({ length: 30 }, (_, n) => {
  const i = n < 15 ? n - 15 : n - 14;
  const d = i * 30;
  const pts = [];
  for (let x = -40; x <= 1640; x += 20) {
    const g = Math.exp(-(((x - 800) / 340) ** 2));
    const y =
      425 + Math.sign(i) * Math.sqrt(d * d + (i < 0 ? 215 : 300) ** 2 * g);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
});
