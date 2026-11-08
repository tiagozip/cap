export const KEY_TABS = [
  { id: "activity", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "protection", label: "Protection" },
  { id: "configuration", label: "Settings" },
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
