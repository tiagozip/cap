import { t } from "../lib/i18n.svelte.js";

export const KEY_TABS = [
  {
    id: "activity",
    get label() {
      return t("Overview");
    },
  },
  {
    id: "events",
    get label() {
      return t("Events");
    },
  },
  {
    id: "protection",
    get label() {
      return t("Protection");
    },
  },
  {
    id: "configuration",
    get label() {
      return t("Settings");
    },
  },
];

const ALIASES = {
  rules: "protection",
  detection: "protection",
  integration: "configuration",
};

export const keyTab = (tab) => {
  const t = ALIASES[tab] ?? tab;
  return KEY_TABS.some((x) => x.id === t) ? t : "activity";
};
