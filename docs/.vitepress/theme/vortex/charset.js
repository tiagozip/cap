export const ALPHABETS = {
  hex: "0123456789abcdef",
  binary: "01",
  base64:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  ascii:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|_-+*=<>[]{}()#$%&@?!:;,.",
  symbols: "/\\|_-+*=<>[]{}()#$%&@?!:;,.^~`",
  blocks: "░▒▓█▁▂▃▄▅▆▇┃━┏┓┗┛",
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSource(mode = "hex", lineCount = 48, seed = 0xcafe) {
  const rand = mulberry32(seed || 1337);
  const alphabet = ALPHABETS[mode] ?? ALPHABETS.hex;
  const wordy = mode === "ascii" || mode === "base64";
  const gapChance = wordy ? 0.1 : 0.16;
  const runMin = wordy ? 3 : 2;
  const runMax = wordy ? 9 : 8;
  const lines = [];

  for (let i = 0; i < lineCount; i++) {
    const width = 40 + Math.floor(rand() * rand() * 230);
    let line = " ".repeat(Math.floor(rand() * rand() * 150));
    const end = line.length + width;
    while (line.length < end) {
      if (rand() < gapChance) {
        const gap = 1 + Math.floor(rand() * 4);
        line += " ".repeat(gap);
        continue;
      }
      const run = runMin + Math.floor(rand() * (runMax - runMin + 1));
      for (let k = 0; k < run; k++) {
        line += alphabet[Math.floor(rand() * alphabet.length)];
      }
      line += " ";
    }
    lines.push(line.slice(0, end));
  }
  return lines;
}

export function glyphsFor(mode = "hex") {
  const set = new Set([" "]);
  for (const ch of ALPHABETS[mode] ?? ALPHABETS.hex) set.add(ch);
  return [...set];
}
