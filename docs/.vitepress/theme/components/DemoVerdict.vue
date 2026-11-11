<script setup>
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted } from "vue";
import { demoVerdict } from "../demoCheck.js";

const { lang } = useData();

const strings = {
  en: {
    agentTitle: (n) => `Cap knows ${n} is using this browser`,
    agentLead: "Sites using Cap let AI agents through by default and only tell their server one was there.",
    agentBody: "A site that turns on agent blocking would stop this browser, because of:",
    agentNot: "Not using an agent browser?",
    agentReport: "Cap's demo thought an AI agent was using my browser, but I'm a person.",
    title: "A real site would have flagged you",
    body: "This demo lets everyone through. With Cap's checks turned on, this browser would have been flagged for:",
    agent: (n) => `AI agent: ${n}`,
    automated: "Mouse and keyboard input that doesn't look like a person",
    interaction: "Clicks or key presses sent by a script",
    browser: "Signs of an automated browser",
    report: "Report a false positive",
    close: "Dismiss",
  },
  zh: {
    agentTitle: (n) => `Cap 知道 ${n} 正在使用这个浏览器`,
    agentLead: "使用 Cap 的网站默认放行 AI 智能体，只会告诉自己的服务器有智能体来过。",
    agentBody: "开启智能体拦截的网站会因为以下原因拦下这个浏览器：",
    agentNot: "没有使用智能体浏览器？",
    agentReport: "Cap 的演示认为有 AI 智能体在使用我的浏览器，但我是真人。",
    title: "真实网站会标记你",
    body: "这个演示放行所有人。如果开启 Cap 的检测，这个浏览器会因为以下原因被标记：",
    agent: (n) => `AI 代理：${n}`,
    automated: "鼠标和键盘输入不像真人",
    interaction: "由脚本发送的点击或按键",
    browser: "自动化浏览器的迹象",
    report: "报告误判",
    close: "关闭",
  },
  de: {
    agentTitle: (n) => `Cap weiß, dass ${n} diesen Browser nutzt`,
    agentLead: "Seiten mit Cap lassen KI-Agenten standardmäßig durch und melden ihrem Server nur, dass einer da war.",
    agentBody: "Eine Seite mit aktivierter Agenten-Blockierung würde diesen Browser stoppen, wegen:",
    agentNot: "Du nutzt keinen Agenten-Browser?",
    agentReport: "Die Demo von Cap dachte, ein KI-Agent nutzt meinen Browser, aber ich bin ein Mensch.",
    title: "Eine echte Seite hätte dich markiert",
    body: "Diese Demo lässt alle durch. Mit aktivierten Cap-Prüfungen wäre dieser Browser markiert worden, wegen:",
    agent: (n) => `KI-Agent: ${n}`,
    automated: "Maus- und Tastatureingaben, die nicht nach einem Menschen aussehen",
    interaction: "Klicks oder Tastendrücke, die ein Skript gesendet hat",
    browser: "Anzeichen eines automatisierten Browsers",
    report: "Fehlalarm melden",
    close: "Schließen",
  },
  fr: {
    agentTitle: (n) => `Cap sait que ${n} utilise ce navigateur`,
    agentLead: "Par défaut, les sites qui utilisent Cap laissent passer les agents IA et préviennent seulement leur serveur.",
    agentBody: "Un site qui active le blocage des agents arrêterait ce navigateur pour :",
    agentNot: "Vous n'utilisez pas de navigateur d'agent ?",
    agentReport: "La démo de Cap a cru qu'un agent IA utilisait mon navigateur, mais je suis une personne.",
    title: "Un vrai site vous aurait signalé",
    body: "Cette démo laisse passer tout le monde. Avec les vérifications de Cap activées, ce navigateur aurait été signalé pour :",
    agent: (n) => `Agent IA : ${n}`,
    automated: "Des mouvements de souris et une frappe qui ne ressemblent pas à une personne",
    interaction: "Des clics ou des touches envoyés par un script",
    browser: "Des signes de navigateur automatisé",
    report: "Signaler un faux positif",
    close: "Fermer",
  },
  th: {
    agentTitle: (n) => `Cap รู้ว่า ${n} กำลังใช้เบราว์เซอร์นี้`,
    agentLead: "โดยค่าเริ่มต้น เว็บไซต์ที่ใช้ Cap จะให้เอเจนต์ AI ผ่าน และแค่แจ้งเซิร์ฟเวอร์ของตัวเองว่ามีเอเจนต์เข้ามา",
    agentBody: "เว็บไซต์ที่เปิดการบล็อกเอเจนต์จะหยุดเบราว์เซอร์นี้เพราะ:",
    agentNot: "ไม่ได้ใช้เบราว์เซอร์เอเจนต์ใช่ไหม",
    agentReport: "เดโมของ Cap คิดว่ามีเอเจนต์ AI ใช้เบราว์เซอร์ของฉัน แต่ฉันเป็นคน",
    title: "เว็บไซต์จริงจะตั้งค่าสถานะคุณ",
    body: "เดโมนี้ให้ทุกคนผ่าน แต่ถ้าเปิดการตรวจของ Cap เบราว์เซอร์นี้จะถูกตั้งค่าสถานะเพราะ:",
    agent: (n) => `เอเจนต์ AI: ${n}`,
    automated: "การใช้เมาส์และคีย์บอร์ดที่ไม่เหมือนคน",
    interaction: "การคลิกหรือกดปุ่มที่สคริปต์ส่งมา",
    browser: "สัญญาณของเบราว์เซอร์อัตโนมัติ",
    report: "รายงานการตรวจผิด",
    close: "ปิด",
  },
};

const t = computed(() => strings[lang.value?.slice(0, 2)] ?? strings.en);

const lines = computed(() => {
  const v = demoVerdict.value;
  if (!v) return [];
  const head =
    v.reason === "behavior_agent"
      ? t.value.agent(v.agent)
      : v.reason === "behavior_automated"
        ? t.value.automated
        : v.reason === "instr_automated_interaction"
          ? t.value.interaction
          : t.value.browser;
  return [{ id: v.reason, name: head }, ...v.checks];
});

const isAgent = computed(() => demoVerdict.value?.reason === "behavior_agent");

const agentIcon = computed(() => {
  const id = isAgent.value ? demoVerdict.value.agentId : null;
  if (!id) return null;
  const icons = [
    [/^codex$/, "codex.svg", true],
    [/^(chatgpt|openai)/, "openai.svg", true],
    [/^claude/, "claude.svg"],
    [/^(google|gemini)/, "gemini.svg"],
    [/^perplexity/, "perplexity.svg"],
    [/^manus$/, "manus.svg", true],
    [/^browser-use$/, "browser-use.png"],
    [/^genspark$/, "genspark.png"],
  ];
  const hit = icons.find(([re]) => re.test(id));
  return hit && { src: `/agents/${hit[1]}`, mono: !!hit[2] };
});

const vendor = computed(() => (demoVerdict.value?.agent ?? "").split(" (")[0]);

const reportUrl = computed(() => {
  const v = demoVerdict.value;
  if (!v) return "";
  const body = [
    isAgent.value ? strings.en.agentReport : "Cap's demo said a real site would have flagged me, but I'm a person.",
    "",
    `Page: ${typeof location === "undefined" ? "" : location.href}`,
    `Reason: ${v.reason}${v.agent ? ` (${v.agent})` : ""}`,
    `Checks: ${v.checks.map((c) => c.id).join(", ") || "none"}`,
    `Browser: ${typeof navigator === "undefined" ? "" : navigator.userAgent}`,
    "",
    "What I was doing:",
    "",
  ].join("\n");
  const q = new URLSearchParams({ title: `False positive: ${v.reason}`, body });
  return `https://github.com/tiagozip/cap/issues/new?${q}`;
});

const close = () => {
  demoVerdict.value = null;
};

const onKey = (e) => {
  if (e.key === "Escape" && demoVerdict.value) close();
};
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="verdict">
      <aside v-if="demoVerdict" :key="demoVerdict.at" class="verdict" role="status" aria-live="polite">
        <div class="verdict-head">
          <img v-if="agentIcon" class="verdict-agent" :class="{ mono: agentIcon.mono }" :src="agentIcon.src" alt="" width="16" height="16" />
          <svg v-else class="verdict-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5Z" />
            <path d="M8 6.25v3" />
            <path d="M8 11.5h.01" />
          </svg>
          <p class="verdict-title">{{ isAgent ? t.agentTitle(vendor) : t.title }}</p>
          <button type="button" class="verdict-close" :aria-label="t.close" @click="close">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
          </button>
        </div>
        <p v-if="isAgent" class="verdict-body"><span class="verdict-lead">{{ t.agentLead }}</span> {{ t.agentBody }}</p>
        <p v-else class="verdict-body">{{ t.body }}</p>
        <ul class="verdict-list">
          <li v-for="l in lines" :key="l.id">{{ l.name }}</li>
        </ul>
        <p class="verdict-foot"><template v-if="isAgent">{{ `${t.agentNot} ` }}</template><a class="verdict-report" :href="reportUrl" target="_blank" rel="noopener">{{ t.report }}</a></p>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.verdict {
  position: fixed;
  z-index: 100;
  left: 50%;
  bottom: 16px;
  width: min(400px, calc(100vw - 32px));
  translate: -50% 0;
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: #1b1b21;
  color: #e8e8ee;
  font: 400 14px/20px Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  box-shadow:
    0 0 0 1px #ffffff14,
    0 1px 2px #0000004d,
    0 8px 24px -6px #00000080,
    0 24px 48px -16px #00000080;
}

.verdict-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.verdict-icon {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: #f5b14c;
  stroke-linejoin: round;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.verdict-agent {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.verdict-agent.mono {
  filter: invert(1) brightness(0.9);
}

.verdict-title {
  flex: 1;
  margin: 0;
  font-weight: 500;
  text-wrap: balance;
}

.verdict-close {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: -6px -8px -6px 0;
  border-radius: 8px;
  color: #a1a1ad;
}

.verdict-close svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.verdict-close:focus-visible,
.verdict-report:focus-visible {
  outline: 2px solid #8ab4ff;
  outline-offset: 2px;
  border-radius: 4px;
}

.verdict-body {
  margin: 6px 0 0 24px;
  color: #a1a1ad;
  text-wrap: pretty;
}

.verdict-list {
  margin: 8px 0 0 24px;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}

.verdict-list li {
  position: relative;
  padding-left: 14px;
  overflow-wrap: break-word;
}

.verdict-list li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #f5b14c;
}

.verdict-lead {
  color: #e8e8ee;
}

.verdict-foot {
  margin: 12px 0 0 24px;
  color: #a1a1ad;
  font-size: 13px;
  line-height: 18px;
}

.verdict-report {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: #ffffff33;
  text-underline-offset: 3px;
  text-underline-position: from-font;
  text-decoration-skip-ink: auto;
}

@media (hover: hover) {
  .verdict-close:hover {
    background: #ffffff0f;
    color: #e8e8ee;
  }

  .verdict-report:hover {
    color: #e8e8ee;
    text-decoration-color: #ffffff80;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .verdict-enter-active {
    transition:
      opacity 320ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .verdict-leave-active {
    transition:
      opacity 180ms ease-in,
      transform 180ms ease-in,
      filter 180ms ease-in;
  }

  .verdict-enter-from {
    opacity: 0;
    transform: translateY(16px);
  }

  .verdict-leave-to {
    opacity: 0;
    transform: translateY(6px);
    filter: blur(4px);
  }
}
</style>
