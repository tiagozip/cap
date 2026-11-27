const onOff = (v) => (v ? "On" : "Off");
const plain = (v) => (typeof v === "number" ? v.toLocaleString() : String(v));

const FIELDS = {
  name: ["Key name", "cfgName", plain],
  ratelimitMax: ["Rate limit requests", "cfgRatelimitMax"],
  ratelimitDuration: [
    "Rate limit window",
    "cfgRatelimitSeconds",
    (v) => `${(v / 1000).toLocaleString()} seconds`,
  ],
  corsOrigins: ["Allowed websites", "cfgCorsEnabled"],
  blockNonBrowserUA: ["Block non-browsers", "cfgBlockNonBrowserUA", onOff],
  requiredHeaders: ["Required headers", "cfgRequiredHeadersEnabled"],
  protocol: [
    "Puzzle type",
    "cfgChallengeProtocol",
    (v) => (v === "hashwx" ? "HashWX" : "SHA-256"),
  ],
  sha256Fallback: ["SHA-256 fallback", "cfgSha256Fallback", onOff],
  difficulty: ["Difficulty", "cfgDifficulty", plain],
  challengeCount: ["Puzzles per solve", "cfgChallengeCount", plain],
  hashwxDifficulty: ["HashWX difficulty", "cfgPuzzle", plain],
  obfuscationLevel: ["Browser check obfuscation", "cfgPuzzle", plain],
  instrumentation: ["Browser checks", "cfgPuzzle", onOff],
  blockAutomatedBrowsers: ["Block automated browsers", null, onOff],
  detectAutomatedInteractions: ["Detect automated input", null, onOff],
  blockAutomatedInteractions: ["Block automated input", null, onOff],
  behavior: [
    "Behavior check",
    null,
    (v) => (v === "off" ? "Off" : v[0].toUpperCase() + v.slice(1)),
  ],
  blockAgents: [
    "AI agents",
    null,
    (v) => (v === "off" ? "Off" : v[0].toUpperCase() + v.slice(1)),
  ],
  allowVerifiedAgents: ["Allow verified agents", null, onOff],
};

export const describe = (changes, prev, defaults) =>
  Object.entries(changes).map(([key, next]) => {
    const [label, target, fmt = plain] = FIELDS[key] ?? [key, null];
    const before = prev[key];
    if (Array.isArray(next) || Array.isArray(before)) {
      const bare = (v) => String(v).replace(/^https:\/\//, "");
      const a = (before ?? []).map(bare);
      const b = (next ?? []).map(bare);
      return {
        key,
        label,
        target,
        added: b.filter((x) => !a.includes(x)),
        removed: a.filter((x) => !b.includes(x)),
        empty: key === "corsOrigins" ? "Any website" : "None",
        cleared: !b.length,
      };
    }
    const show = (v) =>
      v === null || v === undefined
        ? `Default${defaults[key] === undefined ? "" : ` (${fmt(defaults[key])})`}`
        : v === ""
          ? "Empty"
          : fmt(v);
    return { key, label, target, from: show(before), to: show(next) };
  });
