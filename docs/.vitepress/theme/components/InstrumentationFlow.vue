<script setup>
import { useData } from "vitepress";
import { computed } from "vue";

const STRINGS = {
  en: {
    server: "Your server",
    browser: "Visitor's browser",
    label: "How an instrumentation challenge runs",
    steps: [
      ["server", "Writes a new program for this challenge out of random math and DOM steps, and keeps the answer to itself."],
      ["browser", "The widget runs it in a hidden frame. It first checks that the browser's built-in functions weren't replaced."],
      ["browser", "The program notes browser facts and traces AI agents leave, and on keys that ask for it, how the pointer and keys moved."],
      ["browser", "It hashes everything it noted into its answer and sends that with the proof of work."],
      ["server", "Recomputes the answer from the notes, so an edited or missing field fails. Then it passes, flags or blocks the solve."],
    ],
  },
  zh: {
    server: "你的服务端",
    browser: "访客的浏览器",
    label: "插桩挑战的运行过程",
    steps: [
      ["server", "为这次挑战用随机运算和 DOM 步骤写出一个新程序，答案只留在服务端。"],
      ["browser", "验证组件在隐藏的 iframe 里运行它，先检查浏览器的内置函数没有被替换。"],
      ["browser", "程序记录浏览器特征和 AI 代理留下的痕迹；如果密钥要求，还会记录指针和按键的动作。"],
      ["browser", "它把记录的内容哈希进答案，和工作量证明一起发送。"],
      ["server", "根据记录重新算出答案，任何字段被改或缺失都会失败。然后放行、标记或拦截这次解题。"],
    ],
  },
  de: {
    server: "Dein Server",
    browser: "Browser des Besuchers",
    label: "So läuft eine Instrumentation-Challenge ab",
    steps: [
      ["server", "Schreibt für diese Challenge ein neues Programm aus zufälliger Arithmetik und DOM-Schritten und behält die Lösung für sich."],
      ["browser", "Das Widget führt es in einem versteckten Frame aus. Vorher prüft es, dass die eingebauten Funktionen des Browsers nicht ersetzt wurden."],
      ["browser", "Das Programm notiert Browser-Merkmale und Spuren von KI-Agenten und, wenn der Key es verlangt, wie sich Zeiger und Tasten bewegt haben."],
      ["browser", "Es hasht alles Notierte in seine Lösung und schickt sie mit dem Proof of Work."],
      ["server", "Rechnet die Lösung aus den Notizen nach, ein geändertes oder fehlendes Feld fällt also durch. Dann lässt er den Solve durch, markiert oder blockiert ihn."],
    ],
  },
  fr: {
    server: "Votre serveur",
    browser: "Navigateur du visiteur",
    label: "Déroulement d'un défi d'instrumentation",
    steps: [
      ["server", "Écrit pour ce défi un nouveau programme fait d'opérations aléatoires et d'étapes DOM, et garde la réponse pour lui."],
      ["browser", "Le widget l'exécute dans un cadre caché. Il vérifie d'abord que les fonctions natives du navigateur n'ont pas été remplacées."],
      ["browser", "Le programme note des faits sur le navigateur, les traces laissées par les agents IA et, si la clé le demande, les mouvements du pointeur et des touches."],
      ["browser", "Il hache tout ce qu'il a noté dans sa réponse et l'envoie avec la preuve de travail."],
      ["server", "Recalcule la réponse à partir des notes, donc un champ modifié ou absent échoue. Puis il accepte, signale ou bloque la résolution."],
    ],
  },
  th: {
    server: "เซิร์ฟเวอร์ของคุณ",
    browser: "เบราว์เซอร์ของผู้เข้าชม",
    label: "ขั้นตอนของ instrumentation challenge",
    steps: [
      ["server", "เขียนโปรแกรมใหม่สำหรับ challenge นี้จากการคำนวณแบบสุ่มและขั้นตอน DOM แล้วเก็บคำตอบไว้เอง"],
      ["browser", "วิดเจ็ตรันโปรแกรมใน frame ที่ซ่อนอยู่ โดยตรวจก่อนว่าฟังก์ชันในตัวของเบราว์เซอร์ไม่ถูกแทนที่"],
      ["browser", "โปรแกรมจดข้อมูลของเบราว์เซอร์และร่องรอยที่เอเจนต์ AI ทิ้งไว้ และถ้าคีย์กำหนด ก็จดการเคลื่อนของเมาส์และการกดแป้นด้วย"],
      ["browser", "แฮชทุกอย่างที่จดไว้เข้าไปในคำตอบ แล้วส่งไปพร้อม proof of work"],
      ["server", "คำนวณคำตอบใหม่จากสิ่งที่จด ฟิลด์ที่ถูกแก้หรือหายไปจึงไม่ผ่าน จากนั้นให้ผ่าน ติดธง หรือบล็อกการแก้โจทย์นั้น"],
    ],
  },
};

const { lang } = useData();
const t = computed(() => STRINGS[lang.value?.slice(0, 2)] ?? STRINGS.en);
</script>

<template>
  <figure class="iflow" :aria-label="t.label">
    <div class="iflow-head" aria-hidden="true">
      <span>{{ t.server }}</span>
      <span></span>
      <span>{{ t.browser }}</span>
    </div>
    <ol class="iflow-steps">
      <li v-for="([lane, text], i) in t.steps" :key="i" :class="lane">
        <span class="iflow-dot">{{ i + 1 }}</span>
        <p>
          <span class="iflow-lane">{{ lane === "server" ? t.server : t.browser }}</span>
          {{ text }}
        </p>
      </li>
    </ol>
  </figure>
</template>

<style scoped>
.iflow {
  margin: 24px 0;
  padding: 16px;
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
}

.iflow-head,
.iflow-steps > li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr);
  align-items: center;
}

.iflow-head {
  padding: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.iflow-head span {
  text-align: center;
}

.iflow-steps {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.iflow-steps::before {
  content: "";
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 50%;
  width: 1px;
  background: var(--vp-c-divider);
  translate: -50% 0;
}

.iflow-steps > li {
  margin: 0;
  position: relative;
}

.iflow-dot {
  grid-column: 2;
  grid-row: 1;
  justify-self: center;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-bg);
  background: var(--vp-c-text-1);
  position: relative;
  z-index: 1;
}

.iflow-steps p {
  grid-row: 1;
  margin: 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--vp-c-bg);
  font-size: 14px;
  line-height: 1.5;
  text-wrap: pretty;
  box-shadow:
    0 0 0 1px var(--vp-c-divider),
    0 1px 2px rgb(0 0 0 / 0.04);
}

.server p {
  grid-column: 1;
}

.browser p {
  grid-column: 3;
}

.iflow-lane {
  display: none;
}

@media (max-width: 640px) {
  .iflow {
    padding: 12px;
  }

  .iflow-head {
    display: none;
  }

  .iflow-steps > li {
    grid-template-columns: 32px minmax(0, 1fr);
    align-items: start;
  }

  .iflow-steps::before {
    left: 16px;
  }

  .iflow-dot {
    grid-column: 1;
    margin-top: 10px;
  }

  .server p,
  .browser p {
    grid-column: 2;
  }

  .iflow-lane {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--vp-c-text-2);
  }
}
</style>
