import { t } from "../../lib/i18n.svelte.js";

export const PRESETS = [
  {
    id: "relaxed",
    get name() {
      return t("Relaxed");
    },
    get text() {
      return t(
        "The quickest check. Bots that run a real browser can get through.",
      );
    },
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 500_000,
      instrumentation: true,
      blockAutomatedBrowsers: false,
      blockAutomatedInteractions: false,
      behavior: "off",
    },
  },
  {
    id: "balanced",
    get name() {
      return t("Balanced");
    },
    get text() {
      return t(
        "A short wait on older phones. Checks the browser and flags bots.",
      );
    },
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 1_000_000,
      instrumentation: true,
      blockAutomatedBrowsers: false,
      blockAutomatedInteractions: false,
      behavior: "report",
    },
  },
  {
    id: "strict",
    get name() {
      return t("Strict");
    },
    get text() {
      return t("A longer wait. Blocks automation it detects.");
    },
    config: {
      protocol: "hashwx",
      hashwxDifficulty: 3_000_000,
      instrumentation: true,
      blockAutomatedBrowsers: true,
      blockAutomatedInteractions: true,
      behavior: "block",
    },
  },
];

export const presetOf = (values) =>
  PRESETS.find((p) =>
    Object.entries(p.config).every(([k, v]) => values[k] === v),
  )?.id ?? "custom";
