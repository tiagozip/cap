export const PRESETS = [
  {
    id: "relaxed",
    name: "Relaxed",
    text: "The quickest check. Bots that run a real browser can get through.",
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 500_000,
      instrumentation: true,
      blockAutomatedBrowsers: false,
      blockAutomatedInteractions: false,
      behavior: "off",
      sha256Fallback: true,
    },
  },
  {
    id: "balanced",
    name: "Balanced",
    text: "A short wait on older phones. Checks the browser and flags bots.",
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 1_000_000,
      instrumentation: true,
      blockAutomatedBrowsers: false,
      blockAutomatedInteractions: false,
      behavior: "report",
      sha256Fallback: false,
    },
  },
  {
    id: "strict",
    name: "Strict",
    text: "A longer wait. Blocks automation it detects.",
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 3_000_000,
      instrumentation: true,
      blockAutomatedBrowsers: true,
      blockAutomatedInteractions: true,
      behavior: "block",
      sha256Fallback: false,
    },
  },
];

export const presetOf = (values) =>
  PRESETS.find((p) =>
    Object.entries(p.config).every(
      ([k, v]) => k === "sha256Fallback" || values[k] === v,
    ),
  )?.id ?? "custom";
