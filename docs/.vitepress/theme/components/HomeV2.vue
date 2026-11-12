<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useData } from "vitepress";
import VPNavBarSearch from "vitepress/dist/client/theme-default/components/VPNavBarSearch.vue";
import VPNavBarTranslations from "vitepress/dist/client/theme-default/components/VPNavBarTranslations.vue";
import DashboardDemo from "./DashboardDemo.vue";
import HomeDemo from "./HomeDemo.vue";
import HomeOdometer from "./HomeOdometer.vue";
import HomeToolbox from "./HomeToolbox.vue";
import { demoInstrumentation, judgeDemo, onDemoError } from "../demoCheck.js";
import { homeV2Strings } from "./homeV2.strings.js";

const { localeIndex, lang } = useData();
const t = computed(() => ({ ...homeV2Strings.en, ...homeV2Strings[localeIndex.value] }));
const heroLines = computed(() => {
  let i = 0;
  return [t.value.heroTitle, t.value.heroTitleDim].map((line) => line.split(" ").map((w) => ({ w, i: i++ })));
});
const trustParts = computed(() => t.value.trustLine.split("{n}"));
const numLang = computed(() => (localeIndex.value === "root" ? "en" : localeIndex.value));
const lp = computed(() => (localeIndex.value === "root" ? "" : `/${localeIndex.value}`));

const starsFallback = __CAP_STARS__;
const faq = computed(() => {
  const s = t.value;
  const p = lp.value;
  return [
    { q: s.faqAgentsQ, a: s.faqAgentsA },
    { q: s.faqGdprQ, a: s.faqGdprA },
    { q: s.faqMigrateQ, a: s.faqMigrateA },
    { q: s.faqCostQ, a: s.faqCostA },
    {
      q: s.faqOpenQ,
      html: `${s.faqOpenA1}<a href="${p}/guide/capd/">${s.faqOpenLink}</a>${s.faqOpenA2}`,
    },
    {
      q: s.faqAltQ,
      html: `${s.faqAltA1}<a href="${p}/guide/alternatives/recaptcha.html">reCAPTCHA</a>${s.faqAltSep1}<a href="${p}/guide/alternatives/hcaptcha.html">hCaptcha</a>${s.faqAltSep2}<a href="${p}/guide/alternatives/turnstile.html">Turnstile</a>${s.faqAltA2}`,
    },
  ];
});

const checkList = [
  { id: "webdriver_true", name: "WebDriver flag is set", icon: ["M12 8V4H8", "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"], hl: ['"webdriver_true"'] },
  { id: "headless_token", name: "Headless Chrome", icon: ["M9 10h.01", "M15 10h.01", "M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"], hl: ['"headless_token"'] },
  { id: "interaction_synthetic_clicks", name: "Clicks sent by a script", icon: ["M14 4.1 12 6", "m5.1 8-2.9-.8", "m6 12-1.9 2", "M7.2 2.2 8 5.1", "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"], hl: ['"interaction_synthetic_clicks"', '"instr_automated_interaction"'] },
  { id: "behavior", name: "Robotic mouse and typing", icon: ["M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"], hl: ['"automated"', '"behavior_automated"', '"bh_straight_path"'] },
  { id: "agent", name: "AI agent", icon: ["M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3"], hl: ['"agent:claude-in-chrome"', '"agent:chatgpt-agent"', '"claude-in-chrome"', '"chatgpt-agent"', '"behavior_agent"'] },
  { id: "signed", name: "Web Bot Auth signature", icon: ["M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z", "m9 12 2 2 4-4"], hl: ['"verified"'] },
  { id: "webdriver_stripped", name: "WebDriver flag was deleted", icon: ["m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21", "M22 21H7", "m5 11 9 9"] },
  { id: "chrome_object_missing", name: "window.chrome is missing", icon: ["M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"] },
  { id: "geometry_quantized", name: "Text measures in whole pixels", icon: ["M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z", "m14.5 12.5 2-2", "m11.5 9.5 2-2", "m8.5 6.5 2-2", "m17.5 15.5 2-2"] },
  { id: "juggler_package", name: "Playwright's Firefox build", icon: ["M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z", "M12 22V12", "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7", "m7.5 4.27 9 5.15"] },
  { id: "gecko_contradiction", name: "Firefox with Chrome-only APIs", icon: ["M16 3h5v5", "M8 3H3v5", "M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3", "m15 9 6-6"] },
  { id: "window_exceeds_screen", name: "Window taller than the screen", icon: ["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M10 4v4", "M2 8h20", "M6 4v4"] },
  { id: "viewport_override", name: "Viewport matches the screen", icon: ["M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z", "M12 18h.01"] },
  { id: "worker_mismatch", name: "Worker sees a different browser", icon: ["M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z", "M10 9h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z", "M15 2v2", "M15 20v2", "M2 15h2", "M2 9h2", "M20 15h2", "M20 9h2", "M9 2v2", "M9 20v2"] },
];

const sigCheck = "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm2.97 4.47a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06l.97.97 2.97-2.97a.75.75 0 0 1 1.06 0Z";
const sigIcons = {
  passed: sigCheck,
  verified: sigCheck,
  flagged: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 7.25a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z",
  blocked: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.97 5.97a.75.75 0 0 1 1.06 0L8 6.94l.97-.97a.75.75 0 1 1 1.06 1.06L9.06 8l.97.97a.75.75 0 1 1-1.06 1.06L8 9.06l-.97.97a.75.75 0 0 1-1.06-1.06L6.94 8l-.97-.97a.75.75 0 0 1 0-1.06Z",
};

const ghPath = "M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.12 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12c0-6.27-5.23-11.5-11.5-11.5z";

const protRows = [
  { id: "automation", label: "Automation tools", hint: "Puppeteer, Playwright, Selenium and other headless browsers.", options: [["report", "Flag"], ["block", "Block"]] },
  { id: "scripted", label: "Scripted clicks", hint: "Clicks and key presses that a script sent instead of a person.", options: [["off", "Allow"], ["report", "Flag"], ["block", "Block"]] },
  { id: "behavior", label: "Robotic movement", hint: "Mouse paths and typing rhythm that don't look like a person.", options: [["off", "Allow"], ["report", "Flag"], ["block", "Block"]] },
  { id: "agents", label: "AI agents", hint: "Browsers that Claude, ChatGPT, Comet and 30 other tools drive for someone.", options: [["off", "Flag"], ["identified", "Block known"], ["all", "Block all"]] },
];
const dangerValues = ["block", "identified", "all"];
const prot = ref({ automation: "block", scripted: "report", behavior: "off", agents: "identified", signed: false });

const agentList = [
  { id: "claude-in-chrome", name: "Claude in Chrome", icon: "/agents/claude.svg" },
  { id: "chatgpt-agent", name: "ChatGPT agent", icon: "/agents/openai.svg", mono: true, signed: true },
  { id: "perplexity-comet", name: "Comet", icon: "/agents/perplexity.svg" },
  { id: "gemini-in-chrome", name: "Gemini in Chrome", icon: "/agents/gemini.svg" },
  { id: "manus", name: "Manus", icon: "/agents/manus.svg", mono: true, signed: true },
  { id: "codex", name: "Codex", icon: "/agents/codex.svg", mono: true },
  { id: "browser-use", name: "Browser Use", icon: "/agents/browser-use.png" },
  { id: "genspark", name: "Genspark", icon: "/agents/genspark.png" },
];
const agentActions = ref({});
const agentActionOptions = [["default", "Default"], ["allow", "Allow"], ["report", "Flag"], ["block", "Block"]];

const difficulty = ref(1000000);
const difficultyPct = computed(() => `${((difficulty.value - 50000) / (5000000 - 50000)) * 100}%`);
const difficultyDigits = computed(() => {
  const chars = [...difficulty.value.toLocaleString("en-US")];
  let place = chars.filter((ch) => /\d/.test(ch)).length;
  return chars.map((ch, i) => (/\d/.test(ch) ? { d: +ch, key: `d${--place}` } : { s: ch, key: `s${chars.length - i}` }));
});

const bots = [
  { id: "headless", name: "Headless Chrome" },
  { id: "claude-in-chrome", name: "Claude in Chrome" },
  { id: "chatgpt-agent", name: "ChatGPT agent" },
];
const botIndex = ref(0);

const agentResult = computed(() => {
  const o = prot.value;
  const bot = bots[botIndex.value].id;
  const states = {};
  const done = (json) => ({ json, states });
  if (bot === "headless") {
    const riskFlags = [];
    states.webdriver_true = "flagged";
    states.headless_token = "flagged";
    if (o.automation === "block") {
      states.webdriver_true = "blocked";
      states.headless_token = "blocked";
      return done({ success: false, reason: "instr_automated_browser", blockedBy: ["webdriver_true", "headless_token"] });
    }
    riskFlags.push("webdriver_true", "headless_token");
    if (o.scripted !== "off") states.interaction_synthetic_clicks = "flagged";
    if (o.scripted === "block") {
      states.interaction_synthetic_clicks = "blocked";
      return done({ success: false, reason: "instr_automated_interaction", blockedBy: ["interaction_synthetic_clicks"] });
    }
    if (o.scripted === "report") riskFlags.push("interaction_synthetic_clicks");
    if (o.behavior !== "off") states.behavior = "flagged";
    if (o.behavior === "block") {
      states.behavior = "blocked";
      return done({ success: false, reason: "behavior_automated", behavior: { score: 0.96, verdict: "automated" } });
    }
    if (o.behavior === "report") riskFlags.push("bh_straight_path");
    return done({ success: true, riskFlags });
  }
  const verified = bot === "chatgpt-agent";
  if (verified) states.signed = "verified";
  states.agent = "flagged";
  const set = agentActions.value[bot] ?? "default";
  const action = set === "default" ? (o.agents === "off" ? "report" : "block") : set;
  if (action === "block" && (set !== "default" || !(o.signed && verified))) {
    states.agent = "blocked";
    return done({ success: false, reason: "behavior_agent", behavior: { verdict: "agent", agent: { name: bot, confidence: "high", verified } } });
  }
  return done({ success: true, riskFlags: action === "allow" ? [] : [`agent:${bot}`] });
});

const checkState = (id) => agentResult.value.states[id] ?? "passed";
const stateLabels = computed(() => ({
  blocked: t.value.checkBlocked,
  flagged: t.value.checkDetected,
  passed: t.value.checkNotDetected,
  verified: t.value.checkVerified,
}));

const sigIndex = ref(0);
const sigMoved = ref(false);
const sigCurrent = computed(() => checkList[sigIndex.value]);
const pickSig = (i) => {
  sigMoved.value = true;
  sigIndex.value = (i + checkList.length) % checkList.length;
};
const pickBot = (i) => {
  botIndex.value = i;
  sigMoved.value = true;
  sigIndex.value = Math.max(
    checkList.findIndex((c) => checkState(c.id) !== "passed"),
    0,
  );
};

const resultLines = computed(() => {
  const hl = new Set(sigCurrent.value.hl ?? []);
  const tok = (t, c) => ({ t, c, sel: hl.has(t) });
  const out = [];
  const walk = (value, depth, head, last) => {
    const pad = tok(" ".repeat(depth * 2), "j-p");
    const tail = last ? [] : [tok(",", "j-p")];
    if (value && typeof value === "object") {
      const list = Array.isArray(value);
      const entries = list ? value.map((v) => [null, v]) : Object.entries(value);
      const [open, close] = list ? ["[", "]"] : ["{", "}"];
      if (!entries.length) {
        out.push([pad, ...head, tok(`${open}${close}`, "j-p"), ...tail]);
        return;
      }
      out.push([pad, ...head, tok(open, "j-p")]);
      entries.forEach(([k, v], i) =>
        walk(v, depth + 1, k === null ? [] : [tok(`"${k}"`, "j-k"), tok(": ", "j-p")], i === entries.length - 1),
      );
      out.push([pad, tok(close, "j-p"), ...tail]);
      return;
    }
    const c = typeof value === "string" ? "j-s" : typeof value === "number" ? "j-n" : value ? "j-true" : "j-b";
    out.push([pad, ...head, tok(typeof value === "string" ? `"${value}"` : String(value), c), ...tail]);
  };
  walk(agentResult.value.json, 0, [], true);
  return out;
});

const fromWidget = ref(false);
const fromWidgetHost = ref("");

const quoteText = computed(() => {
  const s = t.value;
  return `${s.quoteLead}${s.quoteHl1}${s.quoteMid1}${s.quoteHl2}${s.quoteMid2}${s.quoteHl3}${s.quoteEnd}`.trim();
});


const cleanups = [];

const track = (name, props) => {
  try {
    window.plausible?.(name, props ? { props } : undefined);
  } catch {}
};

const agents = [
  {
    name: "Claude Code",
    fg: "#d97757",
    d: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z",
  },
  {
    name: "Codex",
    fg: "var(--text)",
    d: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
  },
  {
    name: "Cursor",
    fg: "var(--text)",
    d: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23",
  },
];
const promptCopied = ref(false);
let promptTimer = 0;
const copyPrompt = async () => {
  const text = "Read https://trycap.dev/prompt.md and follow it to add Cap to this project.";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.open("/prompt.md", "_blank", "noopener");
    return;
  }
  track("cta_click", { cta: "copy_prompt", location: "hero" });
  promptCopied.value = false;
  requestAnimationFrame(() => {
    promptCopied.value = true;
  });
  clearTimeout(promptTimer);
  promptTimer = setTimeout(() => {
    promptCopied.value = false;
  }, 2200);
};
cleanups.push(() => clearTimeout(promptTimer));

const codeEl = ref(null);
const codeCopied = ref(false);
let codeTimer = 0;
const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(codeEl.value.textContent);
  } catch {
    return;
  }
  track("cta_click", { cta: "copy_code", location: "cta_block" });
  codeCopied.value = true;
  clearTimeout(codeTimer);
  codeTimer = setTimeout(() => {
    codeCopied.value = false;
  }, 2200);
};
cleanups.push(() => clearTimeout(codeTimer));

const dismissWidgetBanner = () => {
  fromWidget.value = false;
  try {
    sessionStorage.setItem("cap-widget-banner-dismissed", "1");
  } catch {}
  track("widget_banner_dismiss");
};

onMounted(() => {
  document.documentElement.classList.add("home-v2-active");

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("utm_source") === "cap_widget" && sessionStorage.getItem("cap-widget-banner-dismissed") !== "1") {
      const host = (params.get("utm_content") || "").trim();
      if (host && /^[a-z0-9.\-]+$/i.test(host) && host.length <= 80) fromWidgetHost.value = host;
      fromWidget.value = true;
      track("widget_banner_shown", { host: fromWidgetHost.value || "(unknown)" });
    }
  } catch {}

  document.addEventListener("error", onDemoError);
  cleanups.push(() => document.removeEventListener("error", onDemoError));

  window.CAP_CUSTOM_FETCH = async (url, options) => {
    if (url === "/api/challenge") {
      const hex = (n) =>
        Array.from(window.crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
      track("demo");
      return new Response(
        JSON.stringify({
          challenge: Array.from({ length: 50 }, () => [hex(16), hex(2)]),
          token: "",
          expires: Date.now() + 600000,
          ...(await demoInstrumentation()),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/redeem") {
      judgeDemo(options);
      track("demo-solved");
      return new Response(JSON.stringify({ success: true, token: "", expires: Date.now() + 3600000 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return window.fetch(url, options);
  };

  cleanups.push(
    ...[...document.querySelectorAll("#homev2 [data-cta]")].map((el) => {
      const handler = () =>
        track("cta_click", {
          cta: el.getAttribute("data-cta"),
          location: el.getAttribute("data-cta-location") || "unknown",
        });
      el.addEventListener("click", handler);
      return () => el.removeEventListener("click", handler);
    }),
  );

  const trust = document.querySelector("#homev2 .trust");
  if (trust && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        track("trust_view");
      },
      { threshold: 0.6 },
    );
    io.observe(trust);
    cleanups.push(() => io.disconnect());
  }

  (async () => {
    const els = document.querySelectorAll(".homev2-gh-stars");
    const write = (v) => els.forEach((el) => (el.textContent = v));
    try {
      const cached = sessionStorage.getItem("cap-gh-stars");
      if (cached) write(cached);
      const res = await fetch("https://api.github.com/repos/tiagozip/cap", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return;
      const n = (await res.json()).stargazers_count;
      if (typeof n !== "number") return;
      const formatted = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
      write(formatted);
      sessionStorage.setItem("cap-gh-stars", formatted);
    } catch {}
  })();

  track("hero_view");
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove("home-v2-active");
  while (cleanups.length) {
    try {
      cleanups.pop()();
    } catch {}
  }
});
</script>

<template>
  <div id="homev2">
    <Transition name="widget-banner">
      <aside v-if="fromWidget" class="widget-banner" role="region" :aria-label="t.bannerRegionLabel">
        <div class="wrap widget-banner-wrap">
          <span class="widget-banner-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </span>
          <p class="widget-banner-text">
            <strong
              >{{ t.bannerVerified }}<template v-if="fromWidgetHost">{{ t.bannerHostPrefix }}{{ fromWidgetHost }}</template
              >{{ t.bannerVerifiedEnd }}</strong
            >
            <span class="widget-banner-sub">{{ t.bannerSub }}</span>
          </p>
          <button class="widget-banner-close" type="button" :aria-label="t.bannerDismiss" @click="dismissWidgetBanner">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </aside>
    </Transition>

    <header class="top">
      <div class="wrap">
        <div class="frame top-inner">
          <div class="top-left">
            <a class="brand" :href="`${lp}/`" :aria-label="t.navBrandLabel">
              <img alt="" src="/logo.png" width="22" height="22" />
              <span>Cap</span>
            </a>
            <nav class="top-links">
              <a class="nav-link" :href="`${lp}/guide/`" data-cta="docs" data-cta-location="nav">{{ t.navDocs }}</a>
              <a class="nav-link" :href="`${lp}/guide/demo.html`" data-cta="demo" data-cta-location="nav">{{ t.navDemo }}</a>
              <a class="nav-link" :href="`${lp}/guide/alternatives.html`">{{ t.ftCompareLabel }}</a>
            </nav>
          </div>
          <VPNavBarSearch class="homev2-search" />
          <div class="top-right">
            <VPNavBarTranslations class="homev2-translations" />
            <a class="gh-link nav-link" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="nav">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path :d="ghPath" /></svg>
              <span class="sr-only">GitHub, </span>
              <span><span class="homev2-gh-stars">{{ starsFallback }}</span><span class="gh-stars-label">{{ ` ${t.navGithubStars}` }}</span></span>
            </a>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section class="band hero">
        <div class="wrap">
          <div class="frame">
            <HomeDemo :t="t">
              <div class="hero-copy">
                <h1>
                  <span v-for="(line, n) in heroLines" :key="n"
                    ><template v-for="{ w, i } in line" :key="i"><span class="w" :style="`--i: ${i}`">{{ w }}</span>{{ " " }}</template></span
                  >
                </h1>
                <p class="lead">{{ t.heroLead }}</p>
                <div class="actions">
                  <button type="button" class="btn btn-ghost prompt-btn" :class="{ 'is-copied': promptCopied }" @click="copyPrompt">
                    <span class="pb-stack" aria-hidden="true">
                      <span v-for="(a, n) in agents" :key="a.name" class="pb-agent" :style="{ '--n': n, '--fg': a.fg }"
                        ><span class="pb-disc"><svg viewBox="0 0 24 24"><path :d="a.d" /></svg></span
                      ></span>
                    </span>
                    <span class="prompt-label">
                      <span class="pl-idle">{{ t.heroCtaPrompt }}</span>
                      <span class="pl-done">{{ t.heroCtaCopied }}</span>
                    </span>
                    <span class="pb-icons" aria-hidden="true">
                      <svg class="pb-copy" viewBox="0 0 16 16"><rect x="5.25" y="5.25" width="8" height="8" rx="2" /><path d="M10.75 3.5v-.25a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.25" /></svg>
                      <svg class="pb-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
                    </span>
                    <span class="sr-only" role="status">{{ promptCopied ? t.heroCtaCopied : "" }}</span>
                  </button>
                  <a class="btn btn-primary" :href="`${lp}/guide/`" data-cta="start" data-cta-location="hero">{{ t.heroCtaStart }}</a>
                </div>
              </div>
            </HomeDemo>
          </div>
        </div>
      </section>

      <section class="band trust">
        <div class="wrap">
          <div class="frame trust-inner">
            <p>{{ trustParts[0] }}<HomeOdometer :lang="numLang" />{{ trustParts[1] }}</p>
            <div class="logos">
              <span><img src="/logos/bunny-duo.svg" alt="bunny.net" width="112" height="43" loading="lazy" /></span>
              <span><img src="/logos/adguard-duo.svg" alt="AdGuard" width="104" height="24" loading="lazy" /></span>
              <span><img src="/logos/noyb-duo.svg" alt="noyb" width="48" height="48" loading="lazy" /></span>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.dashTitle }}</h2>
              <div class="head-side">
                <p>{{ t.dashBody }}</p>
              </div>
            </div>
            <DashboardDemo class="shot" theme="dark" :title="t.dashAlt" :activating="t.dashActivating" />
            <dl class="facts">
              <div v-for="[title, body] in t.dashFacts" :key="title">
                <dt>{{ title }}</dt>
                <dd>{{ body }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="agents" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.agentsTitle }}</h2>
              <div class="head-side">
                <p>{{ t.agentsBody }}</p>
                <a class="text-link" :href="`${lp}/guide/instrumentation.html`" data-cta="instrumentation" data-cta-location="home">{{ t.agentsLink }}</a>
              </div>
            </div>

            <div class="agents">
              <div class="layer settings">
                <div class="layer-head">Protection</div>
                <div class="layer-body">
                  <div class="settings-scroll">
                    <div class="prot-row">
                      <div class="settings-row">
                        <label class="settings-label" for="agents-difficulty">HashWX difficulty</label>
                        <span class="settings-value">
                          <span class="sr-only">{{ difficulty.toLocaleString("en-US") }}</span>
                          <span class="odo" aria-hidden="true"><span v-for="c in difficultyDigits" :key="c.key" :class="'d' in c ? 'odo-d' : 'odo-s'"><span v-if="'d' in c" class="odo-strip" :style="{ '--d': c.d }"><span v-for="n in 10" :key="n">{{ n - 1 }}</span></span><template v-else>{{ c.s }}</template></span></span>
                        </span>
                      </div>
                      <input
                        id="agents-difficulty"
                        class="slider"
                        type="range"
                        min="50000"
                        max="5000000"
                        step="50000"
                        :style="{ '--p': difficultyPct }"
                        v-model.number="difficulty"
                      />
                    </div>
                    <div v-for="row in protRows" :key="row.id" class="prot-row">
                      <div class="prot-top">
                        <span class="prot-label" :id="`prot-${row.id}`">{{ row.label }}</span>
                        <div
                          class="seg"
                          role="radiogroup"
                          :aria-labelledby="`prot-${row.id}`"
                          :style="{ '--n': row.options.length, '--i': row.options.findIndex(([v]) => v === prot[row.id]) }"
                        >
                          <span class="seg-pill" aria-hidden="true"></span>
                          <button
                            v-for="[v, l] in row.options"
                            :key="v"
                            type="button"
                            role="radio"
                            class="seg-opt"
                            :class="{ danger: prot[row.id] === v && dangerValues.includes(v) }"
                            :aria-checked="prot[row.id] === v"
                            @click="prot[row.id] = v"
                          >{{ l }}</button>
                        </div>
                      </div>
                      <p class="prot-hint">{{ row.hint }}</p>
                      <label v-if="row.id === 'agents' && prot.agents !== 'off'" class="prot-check">
                        <input v-model="prot.signed" type="checkbox" />
                        <span class="check-box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m4 8.5 2.5 2.5L12 5.5" /></svg></span>
                        Always let in agents that sign their requests
                      </label>
                    </div>
                    <div class="agent-list">
                      <div v-for="a in agentList" :key="a.id" class="agent-row">
                        <img :src="a.icon" alt="" width="16" height="16" :class="{ mono: a.mono }" loading="lazy" />
                        <span class="agent-name">{{ a.name }}</span>
                        <svg v-if="a.signed" class="agent-signed" viewBox="0 0 24 24" role="img" aria-label="Signs requests"><path class="b" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path class="c" d="m9 12 2 2 4-4" /></svg>
                        <span class="agent-select">
                          <select v-model="agentActions[a.id]" :aria-label="`What to do with ${a.name}`" :class="{ danger: agentActions[a.id] === 'block' }">
                            <option v-for="[v, l] in agentActionOptions" :key="v" :value="v === 'default' ? undefined : v">{{ l }}</option>
                          </select>
                          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="layer result">
                <div class="layer-head">{{ t.agentsResultLabel }}</div>
                <div class="layer-body">
                  <div class="result-tabs">
                    <div class="seg seg-wide" role="tablist" :style="{ '--n': bots.length, '--i': botIndex }">
                      <span class="seg-pill" aria-hidden="true"></span>
                      <button
                        v-for="(b, i) in bots"
                        :key="b.id"
                        type="button"
                        role="tab"
                        class="seg-opt"
                        :aria-selected="i === botIndex"
                        @click="pickBot(i)"
                      >{{ b.name }}</button>
                    </div>
                  </div>
                  <pre class="json" aria-live="polite"><code><span v-for="(line, li) in resultLines" :key="li" class="j-line"><span v-for="(tk, ti) in line" :key="ti" :class="[tk.c, { 'j-sel': tk.sel }]">{{ tk.t }}</span></span></code></pre>
                  <div class="sig-head">
                    <div :key="sigCurrent.id" class="sig-detail" :class="{ moved: sigMoved }">
                      <span class="sig-name">{{ sigCurrent.name }}</span>
                      <span class="sig-state" :class="checkState(sigCurrent.id)">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path :d="sigIcons[checkState(sigCurrent.id)]" /></svg>
                        {{ stateLabels[checkState(sigCurrent.id)] }}
                      </span>
                    </div>
                    <div class="sig-nav">
                      <button type="button" class="sig-arrow" aria-label="Previous check" @click="pickSig(sigIndex - 1)">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                      </button>
                      <button type="button" class="sig-arrow" aria-label="Next check" @click="pickSig(sigIndex + 1)">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div class="sig-tiles">
                    <button
                      v-for="(c, i) in checkList"
                      :key="c.id"
                      type="button"
                      class="sig-tile"
                      :class="[checkState(c.id), { current: i === sigIndex }]"
                      :aria-pressed="i === sigIndex"
                      :aria-label="`${c.name}, ${stateLabels[checkState(c.id)]}`"
                      :title="c.name"
                      @click="pickSig(i)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in c.icon" :key="d" :d="d" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="toolbox" class="band">
        <div class="wrap">
          <div class="frame section">
            <div class="head">
              <h2>{{ t.gridTitle }}</h2>
              <div class="head-side">
                <p>{{ t.gridBody }}</p>
              </div>
            </div>

            <HomeToolbox :t="t" :lp="lp" />
          </div>
        </div>
      </section>

      <section class="band">
        <div class="wrap">
          <div class="frame section quote-wrap">
            <figure class="quote">
              <blockquote>
                <p>{{ quoteText }}</p>
              </blockquote>
              <figcaption>
                <img src="/logos/adguard-duo.svg" alt="AdGuard" width="104" height="24" loading="lazy" />
                <span>{{ t.quoteRole }}</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="faq" class="band">
        <div class="wrap">
          <div class="frame section faq-wrap">
            <div class="faq-head">
              <h2>{{ t.faqTitle }}</h2>
              <a class="text-link" :href="`${lp}/guide/`">{{ t.faqMore }}</a>
            </div>
            <div class="faq">
              <details v-for="item in faq" :key="item.q">
                <summary>
                  <span>{{ item.q }}</span>
                  <svg class="faq-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg>
                </summary>
                <div v-if="item.html" class="faq-a" v-html="item.html"></div>
                <div v-else class="faq-a">{{ item.a }}</div>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section class="band">
        <div class="wrap">
          <div class="frame section start">
            <div class="start-copy">
              <h2>{{ t.startTitle }}</h2>
              <p>{{ t.startBody }}</p>
              <div class="actions">
                <a class="btn btn-primary" :href="`${lp}/guide/`" data-cta="docs" data-cta-location="cta_block">{{ t.startCta }}</a>
                <a class="btn btn-ghost" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="cta_block">{{ t.startGithub }}</a>
              </div>
            </div>
            <div class="code-win">
              <div class="code-head">
                <span>signup.html</span>
                <button type="button" class="code-copy" :class="{ 'is-copied': codeCopied }" @click="copyCode">
                  <span class="cc-icons" aria-hidden="true">
                    <svg class="cc-copy" viewBox="0 0 16 16"><rect x="5.25" y="5.25" width="8" height="8" rx="2" /><path d="M10.75 3.5v-.25a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.25" /></svg>
                    <svg class="cc-check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-6.5" /></svg>
                  </span>
                  <span>{{ codeCopied ? t.heroCtaCopied : t.startCopy }}</span>
                  <span class="sr-only" role="status">{{ codeCopied ? t.heroCtaCopied : "" }}</span>
                </button>
              </div>
              <pre ref="codeEl" class="code" :aria-label="t.startCodeLabel"><code><span class="c-tag">&lt;script</span> <span class="c-attr">src</span>=<span class="c-str">"https://cdn.jsdelivr.net/npm/@cap.js/widget"</span><span class="c-tag">&gt;&lt;/script&gt;</span>

<span class="c-tag">&lt;form</span> <span class="c-attr">action</span>=<span class="c-str">"/signup"</span> <span class="c-attr">method</span>=<span class="c-str">"POST"</span><span class="c-tag">&gt;</span>
  <span class="c-tag">&lt;input</span> <span class="c-attr">name</span>=<span class="c-str">"email"</span> <span class="c-tag">/&gt;</span>
  <span class="c-tag">&lt;cap-widget</span>
    <span class="c-attr">data-cap-api-endpoint</span>=<span class="c-str">"https://cap.example.com/&lt;site-key&gt;/"</span>
  <span class="c-tag">&gt;&lt;/cap-widget&gt;</span>
  <span class="c-tag">&lt;button&gt;</span>Sign up<span class="c-tag">&lt;/button&gt;</span>
<span class="c-tag">&lt;/form&gt;</span></code></pre>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="band foot">
      <div class="wrap">
        <div class="frame foot-inner">
          <div class="foot-brand">
            <a class="brand" :href="`${lp}/`" :aria-label="t.navBrandLabel">
              <img alt="" src="/logo.png" width="22" height="22" />
              <span>Cap</span>
            </a>
            <p>{{ t.ftTagline1.trim() }}<br />{{ t.ftTagline2.trim() }}</p>
          </div>
          <nav class="foot-cols">
            <div>
              <h3>{{ t.ftProductLabel }}</h3>
              <a :href="`${lp}/guide/`" data-cta="docs" data-cta-location="footer">{{ t.ftQuickstart }}</a>
              <a :href="`${lp}/guide/capd/`">capd</a>
              <a :href="`${lp}/guide/widget.html`">{{ t.ftWidget }}</a>
              <a :href="`${lp}/guide/demo.html`" data-cta="demo" data-cta-location="footer">{{ t.ftDemo }}</a>
            </div>
            <div>
              <h3>{{ t.ftCompareLabel }}</h3>
              <a :href="`${lp}/guide/alternatives/recaptcha.html`">{{ t.ftVsRecaptcha }}</a>
              <a :href="`${lp}/guide/alternatives/hcaptcha.html`">{{ t.ftVsHcaptcha }}</a>
              <a :href="`${lp}/guide/alternatives/turnstile.html`">{{ t.ftVsTurnstile }}</a>
              <a :href="`${lp}/guide/alternatives.html`">{{ t.ftAllComparisons }}</a>
            </div>
            <div>
              <h3>{{ t.ftLearnLabel }}</h3>
              <a :href="`${lp}/guide/workings.html`">{{ t.ftHowItWorks }}</a>
              <a :href="`${lp}/guide/effectiveness.html`">{{ t.ftEffectiveness }}</a>
              <a :href="`${lp}/guide/compliance.html`">{{ t.ftCompliance }}</a>
              <a :href="`${lp}/guide/community.html`">{{ t.ftCommunity }}</a>
            </div>
          </nav>
          <div class="foot-legal">
            <span>© 2026 <a href="https://tiago.zip">tiago.zip</a>, Apache 2.0</span>
            <span>{{ t.ftLegal.trim() }}</span>
            <a class="foot-gh" href="https://github.com/tiagozip/cap" data-cta="github" data-cta-location="footer">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@font-face {
  font-family: "Recife Text";
  src: url("/assets/fonts/recife-text-light.woff2") format("woff2");
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: "Unica77";
  src: url("/assets/fonts/unica77-light.woff2") format("woff2");
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: "Unica77";
  src: url("/assets/fonts/unica77-regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "Departure Mono";
  src: url("/assets/fonts/departure-mono.woff2") format("woff2");
  font-display: block;
}
html.home-v2-active {
  --ground: #11111b;
  --panel: #181825;
  --raised: #1e1e2e;
  --edge: #ffffff10;
  --edge-strong: #ffffff1f;
  --edge-solid: #202029;
  --text: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-faint: #7f849c;
  --accent: #89b4fa;
  --accent-ink: #11111b;
  --danger: #f38ba8;
  --success: #a6e3a1;
  --caution: #f9e2af;
  --font-serif: "Recife Text", "Iowan Old Style", Georgia, serif;
  --font-sans: "Unica77", "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-code: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --radius: 10px;
  --frame-pad: 48px;
  --wrap-pad: 24px;
  --tick: #585b70;

  background: var(--ground);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scrollbar-color: #ffffff24 var(--ground);
  scrollbar-gutter: auto;
}
html.home-v2-active body {
  background: var(--ground);
  color: var(--text);
}
html.home-v2-active .VPNav,
html.home-v2-active .VPLocalNav,
html.home-v2-active .VPSidebar,
html.home-v2-active .VPDocFooter,
html.home-v2-active .VPFooter {
  display: none !important;
}
html.home-v2-active .VPContent,
html.home-v2-active .VPContent.is-home,
html.home-v2-active main.main {
  padding: 0 !important;
  margin: 0 !important;
}
#homev2 {
  background: var(--ground);
  color: var(--text);
  font-family: var(--font-sans);
  font-weight: 300;
  font-size: 1.0625rem;
  line-height: 1.5;
  overflow-x: clip;
}
#homev2 *,
#homev2 *::before,
#homev2 *::after {
  box-sizing: border-box;
}
#homev2 :is(h1, h2, h3, p, figure, blockquote, dl, dd, ul, pre) {
  margin: 0;
  padding: 0;
}
#homev2 :is(h1, h2, h3) {
  font-family: var(--font-serif);
  font-weight: 300;
  color: var(--text);
  border: 0;
  text-wrap: balance;
}
#homev2 p {
  text-wrap: pretty;
}
#homev2 a {
  color: inherit;
  text-decoration: none;
}
#homev2 li {
  margin: 0;
}
#homev2 :focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}
#homev2 code {
  font-family: var(--font-code);
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
#homev2 pre code {
  white-space: inherit !important;
}
#homev2 .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
#homev2 .wrap {
  width: 100%;
  max-width: 1168px;
  margin-inline: auto;
  margin-left: max(0px, round(down, (100% - 1168px) / 2, 1px));
  padding-inline: var(--wrap-pad);
}
#homev2 .frame {
  padding-inline: var(--frame-pad);
  box-shadow:
    inset 1px 0 var(--edge),
    inset -1px 0 var(--edge);
}
#homev2 .band + .band {
  border-top: 1px solid var(--edge);
}
#homev2 .top {
  box-shadow: inset 0 -1px var(--edge);
}
#homev2 .band + .band > .wrap,
#homev2 .top > .wrap {
  position: relative;
}
#homev2 .band + .band > .wrap::before,
#homev2 .band + .band > .wrap::after,
#homev2 .top > .wrap::before,
#homev2 .top > .wrap::after {
  content: "";
  position: absolute;
  top: -7px;
  z-index: 2;
  width: 13px;
  height: 13px;
  background: var(--edge-solid);
  mask: var(--spark) center / 100% 100% no-repeat;
  pointer-events: none;
}
#homev2 .top > .wrap::before,
#homev2 .top > .wrap::after {
  top: auto;
  bottom: -6px;
}
#homev2 .band + .band > .wrap::before,
#homev2 .top > .wrap::before {
  left: calc(var(--wrap-pad) - 6px);
}
#homev2 .band + .band > .wrap::after,
#homev2 .top > .wrap::after {
  right: calc(var(--wrap-pad) - 6px);
}
#homev2 .section {
  padding-block: 96px;
}
#homev2 .btn {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding-inline: 16px;
  border: 0;
  border-radius: var(--radius);
  background: none;
  font: 400 1rem/1 var(--font-sans);
  white-space: nowrap;
  cursor: pointer;
  transition: scale 160ms var(--ease-out);
}
#homev2 .btn::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--btn-fill);
  box-shadow: var(--btn-shadow);
  transition:
    filter 200ms var(--ease-out),
    box-shadow 200ms var(--ease-out);
}
#homev2 .btn:active {
  scale: 0.97;
}
#homev2 .btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
#homev2 .btn-sm {
  height: 34px;
  padding-inline: 12px;
  font-size: 0.9375rem;
}
#homev2 .btn-primary {
  color: var(--accent-ink);
  --btn-fill: var(--text);
  --btn-shadow:
    inset 0 1px 0 #fffffff2,
    inset 0 1px 2px -0.5px #fffc,
    inset 0 12px 16px -10px #ffffffb3,
    inset 0 -12px 16px -10px #0000003d,
    inset 0 -1px 2px -1px #00000024,
    0 0 0 1px #0006,
    0 0.5px 0.5px #00000029,
    0 2px 2px -1px #0000001f,
    0 3px 3px -1.5px #0000001a,
    0 5px 5px -2.5px #00000014,
    0 8px 8px -3px #0000000f,
    0 12px 12px -6px #0000000d;
}
#homev2 .btn-ghost {
  color: var(--text);
  --btn-fill: #ffffff0a;
  --btn-shadow:
    inset 0 1px 0 #ffffff0f,
    inset 0 8px 24px -4px #ffffff0a,
    inset 0 -4px 12px -4px #ffffff0a,
    inset 0 0 0 1px #ffffff12;
}
@media (hover: hover) {
  #homev2 .btn-primary:hover::before {
    filter: brightness(1.06);
  }
  #homev2 .btn-ghost:hover::before {
    filter: brightness(1.6);
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .btn,
  #homev2 .btn::before {
    transition: none;
  }
}
@property --pb-spread {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}
#homev2 .prompt-btn {
  --pb-step: 15px;
  padding-inline: 12px 14px;
  gap: 10px;
  transition:
    scale 160ms var(--ease-out),
    --pb-spread 320ms var(--ease-out);
}
#homev2 .prompt-btn::before {
  background: linear-gradient(var(--btn-fill), var(--btn-fill)), var(--ground);
}
#homev2 .prompt-btn .pb-stack {
  display: flex;
}
#homev2 .prompt-btn .pb-agent {
  position: relative;
  z-index: calc(3 - var(--n));
  margin-left: calc(var(--pb-step) - 16px);
  translate: calc(var(--n) * var(--pb-spread)) 0;
  padding-block: 8px;
  margin-block: -8px;
  mask: radial-gradient(circle at calc(50% - var(--pb-step) - var(--pb-spread)) 50%, transparent 10.5px, #000 11px);
}
#homev2 .prompt-btn .pb-agent:first-child {
  margin-left: 0;
  mask: none;
}
#homev2 .prompt-btn .pb-disc {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--fg);
}
#homev2 .prompt-btn .pb-disc svg {
  width: 15px;
  height: 15px;
  fill: currentColor;
}
#homev2 .prompt-label {
  display: grid;
  justify-items: start;
}
#homev2 .prompt-label > span {
  grid-area: 1 / 1;
  transition:
    opacity 200ms var(--ease-out),
    scale 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}
#homev2 .prompt-label .pl-done,
#homev2 .prompt-btn.is-copied .pl-idle {
  opacity: 0;
  scale: 0.9;
  filter: blur(4px);
}
#homev2 .prompt-btn.is-copied .pl-done {
  opacity: 1;
  scale: 1;
  filter: blur(0);
}
#homev2 .pb-icons {
  display: grid;
  margin-left: -2px;
  color: var(--text-secondary);
}
#homev2 .pb-icons svg {
  grid-area: 1 / 1;
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    opacity 200ms var(--ease-out),
    scale 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}
#homev2 .pb-check,
#homev2 .prompt-btn.is-copied .pb-copy {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}
#homev2 .prompt-btn.is-copied .pb-check {
  opacity: 1;
  scale: 1;
  filter: blur(0);
  color: var(--success, #a6e3a1);
}
#homev2 .prompt-btn.is-copied .pb-disc {
  animation: agent-hop 520ms var(--ease-out) calc(var(--n) * 70ms);
}
@keyframes agent-hop {
  35% {
    translate: 0 -4px;
  }
  70% {
    translate: 0 1px;
  }
}
@media (hover: hover) {
  #homev2 .prompt-btn:hover {
    --btn-fill: #ffffff10;
  }
  #homev2 .prompt-btn:hover::before {
    filter: none;
  }
  #homev2 .prompt-btn:hover {
    --pb-spread: 1.5px;
  }
  #homev2 .prompt-btn:hover .pb-icons {
    color: var(--text);
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .prompt-btn .pb-agent,
  #homev2 .prompt-btn .pb-disc,
  #homev2 .prompt-label > span,
  #homev2 .pb-icons svg {
    transition: none;
    animation: none;
  }
}
#homev2 .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
#homev2 .text-link {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: var(--text);
  text-decoration: underline;
  text-decoration-color: #cdd6f466;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
  text-decoration-skip-ink: auto;
  transition: text-decoration-color 140ms;
}
#homev2 .text-link.small {
  font-size: 0.9375rem;
  min-height: 28px;
}
@media (hover: hover) {
  #homev2 .text-link:hover {
    text-decoration-color: currentColor;
  }
}
#homev2 .top {
  position: relative;
  z-index: 50;
}
#homev2 .top-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  height: 68px;
}
#homev2 .top-left,
#homev2 .top-right {
  display: flex;
  align-items: center;
}
#homev2 .top-left {
  gap: 20px;
}
#homev2 .top-right {
  justify-self: end;
  gap: 16px;
}
#homev2 .top-links {
  display: flex;
  align-items: center;
  font-size: 0.9375rem;
}
#homev2 .top-links .nav-link {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding-inline: 7px;
  border-radius: 8px;
  white-space: nowrap;
  transition:
    color 120ms,
    background-color 120ms;
}
@media (hover: hover) {
  #homev2 .top-links .nav-link:hover {
    background: #ffffff0a;
  }
}
@media (max-width: 1000px) {
  #homev2 .top-links {
    display: none;
  }
}
@media (max-width: 600px) {
  #homev2 .gh-link {
    display: none;
  }
}
#homev2 .brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-weight: 400;
  font-size: 1.125rem;
}
#homev2 .nav-link {
  color: var(--text-secondary);
  transition: color 120ms;
}
@media (hover: hover) {
  #homev2 .nav-link:hover {
    color: var(--text);
  }
}
#homev2 .gh-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.9375rem;
  white-space: nowrap;
}
#homev2 .homev2-search {
  display: inline-flex;
  align-items: center;
  flex-grow: 0;
  padding-left: 0 !important;
}
#homev2 .homev2-search .DocSearch-Button {
  margin: 0;
  width: 300px;
  height: 38px;
  padding-inline: 12px 8px;
  justify-content: space-between;
  border: 1px solid var(--edge);
  border-radius: 10px;
  background: transparent;
  box-shadow: none;
  transition: border-color 120ms;
}
#homev2 .homev2-search .DocSearch-Button-Placeholder {
  flex: 1;
  text-align: start;
  font-size: 0.9375rem;
  color: var(--text-faint);
}
#homev2 .homev2-search .DocSearch-Button-Keys {
  opacity: 0.7;
}
@media (hover: hover) {
  #homev2 .homev2-search .DocSearch-Button:hover {
    border-color: var(--edge-strong);
    background: transparent;
  }
}
@media (max-width: 767px) {
  #homev2 .homev2-search .DocSearch-Button {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
}
#homev2 .homev2-translations {
  display: flex !important;
  align-items: center;
}
#homev2 .homev2-translations .button {
  display: flex;
  align-items: center;
  height: auto;
  padding: 0;
  color: var(--text-secondary);
}
#homev2 .homev2-translations .menu {
  top: calc(100% - 2px);
  padding-top: 10px;
  z-index: 60;
}
#homev2 .hero .frame {
  overflow: clip;
}
#homev2 .top,
#homev2 .hero {
  -webkit-user-select: none;
  user-select: none;
}
#homev2 .hero-copy {
  max-width: 880px;
  margin-inline: auto;
  text-align: center;
  display: grid;
  justify-items: center;
}
#homev2 h1 {
  font-size: clamp(1.875rem, 1.3rem + 1.6vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}
#homev2 h1 > span {
  display: block;
  width: fit-content;
  margin-inline: auto;
}
#homev2 .lead {
  -webkit-user-select: text;
  user-select: text;
  margin-top: 18px;
  max-width: 34em;
  font-size: clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem);
  color: var(--text-secondary);
}
#homev2 .hero-copy .actions {
  justify-content: center;
  margin-top: 28px;
}
#homev2 h1 .w {
  display: inline-block;
  transform-origin: 0 100%;
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .hero .w {
    animation: hero-word 1100ms var(--ease-out) calc(80ms + var(--i) * 42ms) both;
  }
  #homev2 .hero .lead {
    animation: hero-rise 1000ms var(--ease-out) 520ms both;
  }
  #homev2 .hero .actions > .btn {
    animation: hero-rise 900ms var(--ease-out) 640ms both;
  }
  #homev2 .hero .actions > .btn + .btn {
    animation-delay: 710ms;
  }
  #homev2 .hero .pb-agent {
    animation: agent-land 700ms var(--ease-out) calc(860ms + (2 - var(--n)) * 110ms) both;
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .hero .lead,
  #homev2 .hero .actions {
    animation: hero-fade 500ms ease both;
  }
}
@keyframes hero-word {
  from {
    opacity: 0;
    transform: translateY(0.45em) rotate(2deg);
    filter: blur(10px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes agent-land {
  from {
    opacity: 0;
    transform: translateX(-10px) scale(0.6);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}
@keyframes hero-fade {
  from {
    opacity: 0;
  }
}
#homev2 .trust-inner {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  padding-right: 0;
}
#homev2 .trust p {
  align-self: center;
  max-width: 25em;
  padding-block: 36px;
  padding-right: 32px;
  text-wrap: balance;
  word-break: keep-all;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .logos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
#homev2 .logos > span {
  display: grid;
  place-items: center;
  min-height: 112px;
  padding: 24px 20px;
  box-shadow: inset 1px 0 var(--edge);
}
#homev2 .logos img,
#homev2 .quote figcaption img {
  height: 24px;
  width: auto;
  max-width: 100%;
}
#homev2 .logos img[alt="bunny.net"] {
  height: 28px;
}
#homev2 .logos img[alt="noyb"] {
  height: 48px;
}
#homev2 .head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px 64px;
  align-items: start;
}
#homev2 .head h2,
#homev2 .faq-head h2,
#homev2 .start h2 {
  font-size: clamp(1.75rem, 1.2rem + 1.4vw, 2.375rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}
#homev2 .head-side {
  display: grid;
  gap: 12px;
  justify-items: start;
  padding-top: 6px;
}
#homev2 .head-side p {
  font-size: 1.0625rem;
  color: var(--text-secondary);
}
#homev2 .ui-window {
  border-radius: 12px;
  background: var(--raised);
  box-shadow:
    inset 0 0 0 1px var(--edge),
    0 1px 2px #00000033,
    0 8px 24px #00000033;
  overflow: hidden;
}
#homev2 .ui-title {
  padding: 12px 16px;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--text-secondary);
  box-shadow: inset 0 -1px 0 var(--edge);
}
#homev2 .agents {
  margin-top: 56px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}
#homev2 .layer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 4px 4px;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge);
}
#homev2 .layer-head {
  padding: 11px 12px 10px;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--text-secondary);
}
#homev2 .layer-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-radius: 10px;
  background: var(--raised);
  box-shadow:
    0 0 0 1px var(--edge),
    0 1px 2px #00000033,
    0 6px 16px #00000026;
}
#homev2 .settings {
  contain: size;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-weight: 400;
  font-size: 0.875rem;
}
#homev2 .settings-scroll {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #ffffff1f transparent;
}
#homev2 .prot-row {
  padding: 14px 16px;
  box-shadow: inset 0 -1px 0 var(--edge);
}
#homev2 .settings-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: var(--text);
}
#homev2 .settings-value {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
#homev2 .odo {
  display: inline-flex;
}
#homev2 .odo-d {
  display: inline-block;
  height: 1lh;
  overflow: hidden;
}
#homev2 .odo-strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--d) * -10%));
  transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}
#homev2 .odo-strip span {
  height: 1lh;
}
#homev2 .slider {
  --p: 50%;
  appearance: none;
  display: block;
  width: 100%;
  height: 24px;
  margin-top: 8px;
  background: transparent;
  cursor: pointer;
}
#homev2 .slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent) var(--p), #ffffff14 var(--p));
}
#homev2 .slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent) var(--p), #ffffff14 var(--p));
}
#homev2 .slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -6px;
  border: 0;
  border-radius: 50%;
  background: #f5f7ff;
  box-shadow:
    0 0 0 1px #00000026,
    0 1px 2px #0000004d,
    0 3px 8px #00000040;
  transition: scale 160ms var(--ease-out);
}
#homev2 .slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: #f5f7ff;
  box-shadow:
    0 0 0 1px #00000026,
    0 1px 2px #0000004d,
    0 3px 8px #00000040;
  transition: scale 160ms var(--ease-out);
}
#homev2 .slider:active::-webkit-slider-thumb {
  scale: 1.12;
}
#homev2 .slider:active::-moz-range-thumb {
  scale: 1.12;
}
#homev2 .slider:focus-visible {
  outline: none;
}
#homev2 .slider:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--accent) 55%, transparent),
    0 1px 2px #0000004d;
}
#homev2 .slider:focus-visible::-moz-range-thumb {
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--accent) 55%, transparent),
    0 1px 2px #0000004d;
}
#homev2 .prot-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
#homev2 .prot-label {
  color: var(--text);
}
#homev2 .prot-hint {
  margin-top: 4px;
  max-width: 34em;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--text-faint);
  text-wrap: pretty;
}
#homev2 .seg {
  position: relative;
  display: grid;
  flex: none;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  padding: 2px;
  border-radius: 8px;
  background: #cdd6f40f;
}
#homev2 .seg-pill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: calc((100% - 4px) / var(--n));
  border-radius: 6px;
  background: #ffffff14;
  box-shadow:
    inset 0 0 0 1px #ffffff0d,
    0 1px 2px #00000059;
  translate: calc(var(--i) * 100%) 0;
  transition: translate 260ms var(--ease-out);
}
#homev2 .seg-opt {
  position: relative;
  height: 26px;
  padding-inline: 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-faint);
  white-space: nowrap;
  transition: scale 160ms var(--ease-out);
}
#homev2 .seg-opt[aria-checked="true"],
#homev2 .seg-opt[aria-selected="true"] {
  color: var(--text);
}
#homev2 .seg-opt.danger {
  color: var(--danger);
}
#homev2 .seg-opt:active {
  scale: 0.96;
}
#homev2 .seg-opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
#homev2 .prot-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}
#homev2 .prot-check input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
#homev2 .check-box {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #ffffff0d;
  box-shadow: inset 0 0 0 1px var(--edge-strong);
  transition: background-color 160ms var(--ease-out);
}
#homev2 .check-box svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--accent-ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
  scale: 0.5;
  transition:
    opacity 160ms var(--ease-out),
    scale 160ms var(--ease-out);
}
#homev2 .prot-check input:checked + .check-box {
  background: var(--accent);
  box-shadow: none;
}
#homev2 .prot-check input:checked + .check-box svg {
  opacity: 1;
  scale: 1;
}
#homev2 .prot-check input:focus-visible + .check-box {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
#homev2 .agent-list {
  padding: 4px 0;
}
#homev2 .agent-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 16px;
}
#homev2 .agent-row img {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
}
#homev2 .agent-row img.mono {
  filter: invert(1) brightness(0.9);
}
#homev2 .agent-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
#homev2 .agent-signed {
  flex: none;
  width: 15px;
  height: 15px;
  margin-left: -4px;
}
#homev2 .agent-signed .b {
  fill: var(--accent);
}
#homev2 .agent-signed .c {
  fill: none;
  stroke: var(--accent-ink);
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
#homev2 .agent-select {
  position: relative;
  margin-left: auto;
  flex: none;
}
#homev2 .agent-select select {
  appearance: none;
  width: 96px;
  height: 28px;
  padding: 0 26px 0 10px;
  border-radius: 7px;
  background: #ffffff0a;
  box-shadow: inset 0 0 0 1px var(--edge);
  font: inherit;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}
#homev2 .agent-select select.danger {
  color: var(--danger);
}
#homev2 .agent-select select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
#homev2 .agent-select option {
  background: var(--raised);
  color: var(--text);
}
#homev2 .agent-select svg {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 12px;
  height: 12px;
  translate: 0 -50%;
  fill: none;
  stroke: var(--text-faint);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
#homev2 .result-tabs {
  padding: 10px 10px 0;
}
#homev2 .seg-wide {
  width: 100%;
}
#homev2 .seg-wide .seg-opt {
  height: 28px;
  overflow: hidden;
  text-overflow: ellipsis;
}
#homev2 .json {
  flex: 1;
  min-height: calc(12 * 20px + 28px);
  padding: 14px 16px 14px 0;
  overflow-x: auto;
  font: 13px/20px "Departure Mono", var(--font-code);
  white-space: pre;
  background: none;
  counter-reset: ln;
  -webkit-font-smoothing: none;
}
#homev2 .j-line {
  display: block;
  counter-increment: ln;
}
#homev2 .j-line::before {
  content: counter(ln);
  display: inline-block;
  box-sizing: content-box;
  width: 2ch;
  margin-right: 16px;
  padding-inline: 12px 10px;
  text-align: right;
  color: #ffffff33;
  box-shadow: inset -1px 0 0 var(--edge);
}
#homev2 .j-k {
  color: var(--accent);
}
#homev2 .j-s,
#homev2 .j-true {
  color: var(--success);
}
#homev2 .j-b {
  color: var(--danger);
}
#homev2 .j-n {
  color: #fab387;
}
#homev2 .j-p {
  color: var(--text-faint);
}
#homev2 .j-line span {
  transition: background-color 160ms var(--ease-out);
}
#homev2 .j-line .j-sel {
  background: color-mix(in oklab, currentColor 18%, transparent);
}
#homev2 .sig-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px 12px 16px;
  box-shadow: inset 0 1px 0 var(--edge);
}
#homev2 .sig-detail {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}
#homev2 .sig-name {
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}
#homev2 .sig-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--text-faint);
}
#homev2 .sig-state svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
  fill-rule: evenodd;
}
#homev2 .sig-state.blocked {
  color: var(--danger);
}
#homev2 .sig-state.flagged {
  color: var(--caution);
}
#homev2 .sig-state.verified {
  color: var(--success);
}
#homev2 .sig-nav {
  display: flex;
  flex: none;
  gap: 2px;
}
#homev2 .sig-arrow {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-faint);
  transition: scale 160ms var(--ease-out);
}
#homev2 .sig-arrow svg,
#homev2 .sig-tile svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
#homev2 .sig-arrow:active,
#homev2 .sig-tile:active {
  scale: 0.94;
}
#homev2 .sig-arrow:focus-visible,
#homev2 .sig-tile:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
#homev2 .sig-tiles {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  padding-top: 1px;
  background: var(--edge);
}
#homev2 .sig-tile {
  --state: var(--text);
  position: relative;
  display: grid;
  place-items: center;
  height: 46px;
  color: #7f849ccc;
  background: var(--raised);
  transition:
    color 200ms var(--ease-out),
    background-color 200ms var(--ease-out),
    scale 160ms var(--ease-out);
}
#homev2 .sig-tile.blocked {
  --state: var(--danger);
}
#homev2 .sig-tile.flagged {
  --state: var(--caution);
}
#homev2 .sig-tile.verified {
  --state: var(--success);
}
#homev2 .sig-tile:not(.passed) {
  color: var(--state);
  background: color-mix(in oklab, var(--state) 6%, var(--raised));
}
#homev2 .sig-tile::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: var(--state);
  scale: 0 1;
  transition: scale 240ms var(--ease-out);
}
#homev2 .sig-tile.current {
  color: var(--text);
  background: color-mix(in oklab, var(--text) 6%, var(--raised));
}
#homev2 .sig-tile.current:not(.passed) {
  color: var(--state);
  background: color-mix(in oklab, var(--state) 13%, var(--raised));
}
#homev2 .sig-tile.current::after {
  scale: 1 1;
}
@media (hover: hover) {
  #homev2 .sig-arrow:hover {
    color: var(--text);
    background: #ffffff0a;
  }
  #homev2 .seg-opt:not([aria-checked="true"]):not([aria-selected="true"]):hover {
    color: var(--text-secondary);
  }
  #homev2 .agent-select select:hover {
    background: #ffffff12;
  }
  #homev2 .sig-tile.passed:not(.current):hover {
    color: var(--text-secondary);
    background: color-mix(in oklab, var(--text) 3%, var(--raised));
  }
  #homev2 .sig-tile:not(.passed):not(.current):hover {
    background: color-mix(in oklab, var(--state) 10%, var(--raised));
  }
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .sig-detail.moved {
    animation: sig-in 200ms var(--ease-out);
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .odo-strip,
  #homev2 .seg-pill {
    transition: none;
  }
}
@media (max-width: 960px) {
  #homev2 .settings {
    contain: none;
  }
  #homev2 .settings-scroll {
    height: auto;
    overflow: visible;
  }
  #homev2 .json {
    min-height: 0;
  }
}
@media (max-width: 560px) {
  #homev2 .prot-top {
    flex-wrap: wrap;
  }
  #homev2 .seg-wide .seg-opt {
    padding-inline: 2px;
    font-size: 0.75rem;
    text-overflow: clip;
  }
}
@keyframes sig-in {
  from {
    opacity: 0;
    filter: blur(3px);
    translate: 0 3px;
  }
}
#homev2 .shot {
  margin-top: 56px;
}
#homev2 .facts {
  margin-top: 40px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px 32px;
}
#homev2 .facts > div {
  padding-left: 16px;
  box-shadow: inset 1px 0 var(--edge-strong);
}
#homev2 .facts dt {
  font-weight: 400;
  color: var(--text);
}
#homev2 .facts dd {
  margin-top: 4px;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .quote-wrap {
  display: grid;
  justify-items: center;
}
#homev2 .quote {
  max-width: 700px;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 24px;
}
#homev2 .quote blockquote {
  margin: 0;
  padding: 0;
  border: 0;
}
#homev2 .quote blockquote p {
  font-family: var(--font-serif);
  font-weight: 300;
  font-size: clamp(1.25rem, 1.1rem + 0.4vw, 1.5rem);
  line-height: 1.35;
  letter-spacing: -0.02em;
  color: var(--text);
}
#homev2 .quote figcaption {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}
#homev2 .quote figcaption img {
  height: 22px;
}
#homev2 .faq-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 32px 64px;
  align-items: start;
}
#homev2 .faq-head {
  position: sticky;
  top: 32px;
  display: grid;
  gap: 12px;
  justify-items: start;
}
#homev2 .faq details {
  box-shadow: inset 0 -1px 0 var(--edge);
}
#homev2 .faq summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-block: 20px;
  list-style: none;
  color: var(--text);
  cursor: pointer;
}
#homev2 .faq details:first-child summary {
  padding-top: 0;
}
#homev2 .faq summary::-webkit-details-marker {
  display: none;
}
#homev2 .faq-icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--text-faint);
  stroke-width: 1.5;
  stroke-linecap: round;
  transition:
    rotate 240ms var(--ease-out),
    stroke 120ms;
}
#homev2 .faq details[open] .faq-icon {
  rotate: 45deg;
}
@media (hover: hover) {
  #homev2 .faq summary:hover .faq-icon {
    stroke: var(--text);
  }
}
#homev2 .faq-a {
  max-width: 62ch;
  padding-bottom: 22px;
  color: var(--text-secondary);
}
@media (prefers-reduced-motion: no-preference) {
  #homev2 .faq {
    interpolate-size: allow-keywords;
  }
  #homev2 .faq details::details-content {
    height: 0;
    overflow: clip;
    opacity: 0;
    transition:
      height 280ms var(--ease-out),
      opacity 200ms ease-out,
      content-visibility 280ms allow-discrete;
  }
  #homev2 .faq details[open]::details-content {
    height: auto;
    opacity: 1;
  }
}
#homev2 .faq-a a {
  color: var(--text);
  text-decoration: underline;
  text-decoration-color: #cdd6f466;
  text-underline-offset: 3px;
}
#homev2 .start {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 40px 56px;
  align-items: center;
}
#homev2 .start-copy {
  display: grid;
  gap: 14px;
  justify-items: start;
}
#homev2 .start-copy p {
  color: var(--text-secondary);
}
#homev2 .start-copy .actions {
  margin-top: 10px;
}
#homev2 .code-win {
  min-width: 0;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: inset 0 0 0 1px var(--edge);
}
#homev2 .code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 44px;
  padding-inline: 22px 8px;
  box-shadow: inset 0 -1px var(--edge);
  font-size: 0.8125rem;
  color: var(--text-faint);
}
#homev2 .code-copy {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding-inline: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text-secondary);
  font: inherit;
  cursor: pointer;
  transition: scale 200ms ease-out;
}
#homev2 .code-copy:active {
  scale: 0.97;
}
@media (hover: hover) {
  #homev2 .code-copy:hover {
    background: var(--edge);
    color: var(--text);
  }
}
#homev2 .cc-icons {
  display: grid;
  width: 14px;
  height: 14px;
}
#homev2 .cc-icons svg {
  grid-area: 1 / 1;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    opacity 200ms var(--ease-out),
    scale 200ms var(--ease-out),
    filter 200ms var(--ease-out);
}
#homev2 .cc-check,
#homev2 .code-copy.is-copied .cc-copy {
  opacity: 0;
  scale: 0.25;
  filter: blur(4px);
}
#homev2 .code-copy.is-copied .cc-check {
  opacity: 1;
  scale: 1;
  filter: none;
  color: var(--success);
}
#homev2 .code {
  max-width: 100%;
  overflow-x: auto;
  padding: 18px 22px 20px;
  font: 0.8125rem/1.75 var(--font-code);
  color: var(--text);
  white-space: pre;
}
#homev2 .c-tag {
  color: var(--accent);
}
#homev2 .c-attr {
  color: var(--caution);
}
#homev2 .c-str {
  color: var(--success);
}
#homev2 .foot-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 48px 64px;
  padding-block: 64px 40px;
}
#homev2 .foot-brand {
  display: grid;
  gap: 14px;
  align-content: start;
  justify-items: start;
}
#homev2 .foot-brand p {
  font-size: 0.9375rem;
  color: var(--text-faint);
}
#homev2 .foot-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
}
#homev2 .foot-cols div {
  display: grid;
  gap: 10px;
  align-content: start;
  justify-items: start;
}
#homev2 .foot-cols h3 {
  margin-bottom: 4px;
  font-family: var(--font-sans);
  font-weight: 400;
  font-size: 0.9375rem;
  color: var(--text);
}
#homev2 .foot-cols a,
#homev2 .foot-gh {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  transition: color 120ms;
}
@media (hover: hover) {
  #homev2 .foot-cols a:hover,
  #homev2 .foot-gh:hover {
    color: var(--text);
  }
}
#homev2 .foot-legal {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 32px;
  padding-top: 24px;
  font-size: 0.875rem;
  color: var(--text-faint);
  box-shadow: inset 0 1px 0 var(--edge);
}
#homev2 .foot-legal .foot-gh {
  margin-left: auto;
  font-size: 0.875rem;
}
#homev2 .foot-legal a {
  color: var(--text-secondary);
}
.widget-banner {
  background: color-mix(in oklab, var(--accent) 11%, var(--ground));
  color: var(--text);
}
#homev2 .widget-banner-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 11px;
}
.widget-banner-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 999px;
  background: color-mix(in oklab, var(--accent) 22%, transparent);
  color: var(--accent);
}
.widget-banner-text {
  flex: 1;
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--text-secondary);
  min-width: 0;
}
.widget-banner-text strong {
  color: var(--text);
  font-weight: 400;
}
.widget-banner-sub {
  margin-left: 6px;
}
.widget-banner-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color 120ms,
    color 120ms;
}
@media (hover: hover) {
  .widget-banner-close:hover {
    background: #ffffff0f;
    color: var(--text);
  }
}
.widget-banner-leave-active {
  transition:
    opacity 180ms ease,
    filter 180ms ease;
}
.widget-banner-leave-to {
  opacity: 0;
  filter: blur(4px);
}
@media (max-width: 960px) {
  html.home-v2-active {
    --frame-pad: 28px;
  }
  #homev2 .agents,
  #homev2 .start {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .trust-inner {
    grid-template-columns: minmax(0, 1fr);
    padding-inline: 0;
  }
  #homev2 .trust p {
    padding: 32px var(--frame-pad) 28px;
  }
  #homev2 .logos {
    box-shadow: inset 0 1px var(--edge);
  }
  #homev2 .logos > span {
    min-height: 88px;
    padding: 20px 12px;
  }
  #homev2 .logos > span:first-child {
    box-shadow: none;
  }
}
@media (max-width: 760px) {
  #homev2 .nav-extra,
  #homev2 .gh-stars-label {
    display: none;
  }
  #homev2 .head,
  #homev2 .faq-wrap,
  #homev2 .foot-inner {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .faq-head {
    position: static;
  }
  #homev2 .facts {
    grid-template-columns: minmax(0, 1fr);
  }
  #homev2 .section {
    padding-block: 72px;
  }
  #homev2 .agents,
  #homev2 .grid,
  #homev2 .shot {
    margin-top: 36px;
  }
}
@media (max-width: 600px) {
  html.home-v2-active {
    --frame-pad: 16px;
  }
  html.home-v2-active {
    --wrap-pad: 12px;
  }
  #homev2 .top nav {
    gap: 14px;
  }
  #homev2 .homev2-search .DocSearch-Button-Placeholder,
  #homev2 .homev2-search .DocSearch-Button-Keys {
    display: none;
  }
  #homev2 .homev2-search .DocSearch-Button {
    width: 36px;
    padding: 0;
    justify-content: center;
  }
  #homev2 .json {
    font-size: 0.75rem;
  }
  #homev2 .foot-cols {
    grid-template-columns: 1fr 1fr;
  }
  .widget-banner-sub {
    display: block;
    margin-left: 0;
    margin-top: 2px;
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 * {
    transition-duration: 0s !important;
  }
}
</style>
