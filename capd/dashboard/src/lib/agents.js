const BRANDS = [
  ["claude", "claude"],
  ["codex", "codex"],
  ["chatgpt", "openai"],
  ["openai", "openai"],
  ["cursor", "cursor"],
  ["gemini", "gemini"],
  ["antigravity", "antigravity"],
  ["kimi", "kimi"],
  ["grok", "grok"],
  ["perplexity", "perplexity"],
  ["manus", "manus"],
  ["v0", "vercel"],
];

export const agentIconId = (name = "") => {
  const n = name.toLowerCase();
  return BRANDS.find(([k]) => n.includes(k))?.[1] ?? "unknown";
};
