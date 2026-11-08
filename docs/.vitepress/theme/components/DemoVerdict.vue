<script setup>
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted } from "vue";
import { demoVerdict } from "../demoCheck.js";

const { lang } = useData();

const strings = {
  en: {
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

const reportUrl = computed(() => {
  const v = demoVerdict.value;
  if (!v) return "";
  const body = [
    "Cap's demo said a real site would have flagged me, but I'm a person.",
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
          <svg class="verdict-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.5 9.75a1 1 0 0 1-.87 1.5H2.5a1 1 0 0 1-.87-1.5Z" />
            <path d="M8 6.25v3" />
            <path d="M8 11.5h.01" />
          </svg>
          <p class="verdict-title">{{ t.title }}</p>
          <button type="button" class="verdict-close" :aria-label="t.close" @click="close">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
          </button>
        </div>
        <p class="verdict-body">{{ t.body }}</p>
        <ul class="verdict-list">
          <li v-for="l in lines" :key="l.id">{{ l.name }}</li>
        </ul>
        <a class="verdict-report" :href="reportUrl" target="_blank" rel="noopener">{{ t.report }}</a>
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

.verdict-report {
  display: inline-flex;
  align-items: center;
  height: 32px;
  margin: 14px 0 0 24px;
  padding: 0 12px;
  border-radius: 8px;
  background: #ffffff14;
  color: #e8e8ee;
  font-weight: 500;
  text-decoration: none;
  transition: scale 200ms ease-out;
}

.verdict-report:active {
  scale: 0.97;
}

@media (hover: hover) {
  .verdict-close:hover {
    background: #ffffff0f;
    color: #e8e8ee;
  }

  .verdict-report:hover {
    background: #ffffff1f;
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
