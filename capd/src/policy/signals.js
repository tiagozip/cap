export const SIGNAL_GROUPS = [
  {
    id: "instrumentation",
    label: "Headless browser detection",
    requires: "instrumentation",
    signals: [
      ["webdriver_true", "navigator.webdriver is true"],
      ["webdriver_stripped", "navigator.webdriver was deleted or redefined"],
      ["headless_token", "Headless token in the user agent or client hints"],
      ["native_tamper", "Native browser functions were patched"],
      [
        "viewport_override",
        "Viewport doesn't match the window, as with an emulated device",
      ],
      ["window_exceeds_screen", "The window is larger than the screen"],
      ["geometry_quantized", "Text measures in whole pixels, as in Camoufox"],
      [
        "geometry_unmeasured",
        "Text measured zero wide, so the page hid the check",
      ],
      ["gecko_contradiction", "Claims to be Firefox but lacks Gecko behavior"],
      ["probe_incomplete", "The browser probe came back incomplete"],
      ["cdp_console_trap", "A DevTools protocol client is attached"],
      [
        "ua_hints_blank",
        "User agent overridden without its client hints, as nodriver does",
      ],
      [
        "stealth_patches",
        "Stealth plugin patches found, like a fake window.chrome.runtime",
      ],
      ["engine_mismatch", "The JavaScript engine doesn't match the browser"],
      ["os_mismatch", "Claims Windows but renders like Linux or macOS"],
      ["languages_inconsistent", "Browser languages are empty or disagree"],
      ["frame_mismatch", "The page and Cap's frame report different values"],
      [
        "document_intercepted",
        "The page was served by an automation tool, as patchright does",
      ],
      ["attach_shadow_patched", "attachShadow was replaced by a script"],
      ["automation_globals", "Automation tool variables found in the page"],
      [
        "juggler_package",
        "Firefox with Playwright's Juggler package registered",
      ],
      [
        "chrome_object_missing",
        "Desktop Chromium without window.chrome, as in chrome-headless-shell",
      ],
      [
        "worker_mismatch",
        "The page and a worker report different browser values",
      ],
      [
        "interaction_synthetic_clicks",
        "Three or more script-dispatched clicks during the check",
      ],
      [
        "interaction_synthetic_keydowns",
        "Three or more script-dispatched key presses during the check",
      ],
      [
        "host_unreachable",
        "Cap's frame couldn't read the page it was embedded in",
      ],
      ["legacy_widget", "Solved by a widget too old to send interaction data"],
      [
        "isolated_frame",
        "The page set CAP_ISOLATE, so the check couldn't read the page",
      ],
      [
        "csp_eval_blocked",
        "The page's CSP blocked eval, so the eval checks were skipped",
      ],
    ],
  },
  {
    id: "behavior",
    label: "Interaction flags",
    requires: "behavior",
    signals: [
      [
        "bh_untrusted_activation",
        "The widget was clicked by a script",
        "strong",
      ],
      [
        "bh_linear_path",
        "Pointer moved in a perfectly straight, evenly spaced line",
        "strong",
      ],
      [
        "bh_polynomial_path",
        "Pointer followed a Bézier curve sampled at even steps",
        "strong",
      ],
      ["bh_hidden_activation", "Pressed while the tab was hidden", "strong"],
      ["bh_uniform_typing", "Key intervals were near identical", "strong"],
      ["bh_superhuman_typing", "Typed faster than a person can", "strong"],
      ["bh_replayed", "The same interaction trace was used before", "strong"],
      [
        "bh_activation_unseen",
        "Pressed without the widget ever entering the viewport",
        "strong",
      ],
      [
        "bh_too_fast",
        "Pressed under 120ms after the widget appeared",
        "strong",
      ],
      [
        "bh_screen_coords_leak",
        "Screen coordinates match an automation input path",
        "strong",
      ],
      [
        "bh_malformed",
        "The trace could not have come from the widget",
        "strong",
      ],
      ["bh_missing", "No interaction trace was sent", "strong"],
      [
        "bh_warp_click",
        "Cursor appeared on the widget without moving there",
        "weak",
      ],
      ["bh_instant_press", "Press shorter than 8ms", "weak"],
      ["bh_center_hit", "Clicked the exact center", "weak"],
      ["bh_instant_key", "Enter or Space held under 8ms", "weak"],
      ["bh_idle_then_act", "Long idle followed by a warp click", "weak"],
      ["bh_touch_geometry", "Touch contact looks synthetic", "weak"],
      [
        "bh_unexplained_scroll",
        "Page scrolled with no input behind it",
        "weak",
      ],
    ],
  },
];

export const KNOWN_AGENTS = [
  ["claude-in-chrome", "Claude (Claude in Chrome)"],
  ["claude-agent", "Claude (hosted browser)"],
  ["chatgpt-agent", "ChatGPT (agent)"],
  ["codex", "ChatGPT (Codex)"],
  ["chatgpt-user", "ChatGPT (browser fetch)"],
  ["google-agent", "Google (agent)"],
  ["google-antigravity", "Google (Antigravity)"],
  ["perplexity-comet", "Perplexity (Comet)"],
  ["grok-bot", "Grok (agent)"],
  ["gemini-in-chrome", "Google (Gemini in Chrome)"],
  ["brave-leo", "Brave (Leo)"],
  ["cursor", "Cursor (browser)"],
  ["manus", "Manus (agent)"],
  ["nova-act", "Amazon (Nova Act)"],
  ["monica", "Monica (extension)"],
  ["sider", "Sider (extension)"],
  ["harpa", "HARPA AI (extension)"],
  ["maxai", "MaxAI (extension)"],
  ["rtrvr", "rtrvr.ai (extension)"],
  ["kimi", "Kimi (WebBridge)"],
  ["do-browser", "Do Browser (extension)"],
  ["nanobrowser", "Nanobrowser (extension)"],
  ["dassi", "dassi (extension)"],
  ["browserbase", "Browserbase (cloud browser)"],
  ["hyperbrowser", "Hyperbrowser (cloud browser)"],
  ["hyperagent", "Hyperbrowser (HyperAgent)"],
  ["kernel", "Kernel (cloud browser)"],
  ["anchor-browser", "Anchor (cloud browser)"],
  ["cloudflare-browser-run", "Cloudflare (Browser Run)"],
  ["aws-agentcore", "AWS (AgentCore browser)"],
  ["agi-agent", "AGI (agent)"],
  ["twin", "Twin (agent)"],
  ["agent-browser", "Vercel (agent-browser)"],
  ["agentql", "AgentQL (framework)"],
  ["magnitude", "Magnitude (framework)"],
  ["lavague", "LaVague (framework)"],
  ["genspark", "Genspark (browser)"],
  ["fellou", "Fellou (browser)"],
  ["sigma", "Sigma (browser)"],
  ["browser-use", "browser-use (framework)"],
  ["stagehand", "Stagehand (framework)"],
  ["skyvern", "Skyvern (framework)"],
  ["browserflow", "Browserflow (extension)"],
  ["thunderbit", "Thunderbit (extension)"],
  ["2captcha-solver", "2Captcha (solver extension)"],
  [
    "cdp-automation",
    "Playwright or Puppeteer",
    "Clicked the way their default click() does, with no mouse travel and no time between press and release.",
  ],
];

const SIGNAL_ACTIONS = new Set(["off", "report", "block"]);
const AGENT_ACTIONS = new Set(["allow", "report", "block"]);

export function cleanSignalActions(input) {
  const out = {};
  for (const [k, v] of Object.entries(input ?? {}).slice(0, 200)) {
    if (
      /^[a-z0-9_:-]{1,48}$/.test(k) &&
      SIGNAL_ACTIONS.has(v) &&
      v !== "report"
    )
      out[k] = v;
  }
  return out;
}

export function cleanAgentActions(input) {
  const out = {};
  for (const [k, v] of Object.entries(input ?? {}).slice(0, 100)) {
    if (/^[a-z0-9_-]{1,48}$/.test(k) && AGENT_ACTIONS.has(v)) out[k] = v;
  }
  return out;
}

export const SIGNED_AGENTS = new Set([
  "chatgpt-agent",
  "google-agent",
  "manus",
  "grok-bot",
  "browserbase",
  "kernel",
  "hyperbrowser",
  "anchor-browser",
  "cloudflare-browser-run",
  "aws-agentcore",
  "agi-agent",
]);

const INTERACTION_FLAGS = [
  "interaction_synthetic_clicks",
  "interaction_synthetic_keydowns",
];

export function applySignalPolicy(config, result) {
  const actions = config.signalActions ?? {};
  const flags = [];
  let blockedBy = null;
  for (const flag of result.riskFlags ?? []) {
    const action = actions[flag];
    if (action === "off") continue;
    if (action === "block" && !blockedBy) blockedBy = flag;
    flags.push(flag);
  }
  if (!blockedBy && INTERACTION_FLAGS.some((f) => actions[f] === "block")) {
    blockedBy =
      ["legacy_widget", "isolated_frame"].find((f) =>
        result.riskFlags?.includes(f),
      ) ?? null;
  }

  const agent = result.behavior?.agent ?? result.agent;
  let agentBlocked = false;
  if (agent?.detected) {
    const trusted = agent.verified || !SIGNED_AGENTS.has(agent.name);
    const override = trusted
      ? (config.agentActions?.[agent.name] ?? config.agentActions?.["*"])
      : undefined;
    if (override) {
      agentBlocked = override === "block";
    } else {
      const mode = config.blockAgents;
      agentBlocked =
        !(config.allowVerifiedAgents && agent.verified) &&
        (mode === "all" ||
          (mode === "identified" && agent.confidence === "high"));
    }
  }

  return { flags, blockedBy, agentBlocked };
}
