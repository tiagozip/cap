import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";
import { homeV2Strings } from "./theme/components/homeV2.strings.js";

const LOCALE_INFO = {
  root: { lang: "en-US", label: "English", hreflang: "en", prefix: "" },
  zh: { lang: "zh-CN", label: "简体中文", hreflang: "zh-CN", prefix: "/zh" },
  de: { lang: "de-DE", label: "Deutsch", hreflang: "de", prefix: "/de" },
  fr: { lang: "fr-FR", label: "Français", hreflang: "fr", prefix: "/fr" },
  th: { lang: "th-TH", label: "ไทย", hreflang: "th", prefix: "/th" },
};

const LOCALES = Object.keys(LOCALE_INFO).filter((k) => k !== "root");

const GITHUB_STARS = await (async () => {
  try {
    const res = await fetch("https://api.github.com/repos/tiagozip/cap", {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    const n = res.ok ? (await res.json()).stargazers_count : null;
    return typeof n === "number" ? n : 8275;
  } catch {
    return 8275;
  }
})();
const GITHUB_STARS_LABEL = GITHUB_STARS >= 1000 ? `${(GITHUB_STARS / 1000).toFixed(1)}k` : `${GITHUB_STARS}`;

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const gitDatesCache = new Map();
const gitDates = (relativePath) => {
  if (gitDatesCache.has(relativePath)) return gitDatesCache.get(relativePath);
  let dates = null;
  try {
    const out = execSync(
      `git log --follow --format=%aI -- "${relativePath}"`,
      { cwd: DOCS_DIR, encoding: "utf8" },
    ).trim();
    if (out) {
      const lines = out.split("\n");
      dates = { published: lines.at(-1), modified: lines[0] };
    }
  } catch {}
  gitDatesCache.set(relativePath, dates);
  return dates;
};

const jsonLd = (obj) => [
  "script",
  { type: "application/ld+json" },
  JSON.stringify(obj).replace(/</g, "\\u003c"),
];

const SOFTWARE_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://trycap.dev/#software",
  name: "Cap",
  applicationCategory: "SecurityApplication",
  operatingSystem: "Cross-platform",
  url: "https://trycap.dev",
  image: "https://trycap.dev/logo.png",
  description:
    "Cap is a free, open-source CAPTCHA alternative. Self-hosted, privacy-first, no Google. Proof-of-work and instrumentation, no visual puzzles. Apache 2.0.",
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  author: { "@type": "Person", name: "tiago", url: "https://tiago.zip" },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  interactionStatistic: {
    "@type": "InteractionCounter",
    interactionType: "https://schema.org/LikeAction",
    userInteractionCount: GITHUB_STARS,
  },
};

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://trycap.dev/#organization",
  name: "Cap",
  url: "https://trycap.dev",
  logo: "https://trycap.dev/logo.png",
  foundingDate: "2025-01-11",
  founder: { "@type": "Person", name: "tiago", url: "https://tiago.zip" },
  sameAs: ["https://github.com/tiagozip/cap", "https://x.com/tiagozip_"],
  subjectOf: { "@id": "https://trycap.dev/about.html" },
};

// FAQ JSON-LD is derived from the strings actually rendered by HomeV2 so the
// schema can never drift from the visible content (a Google requirement for
// FAQ rich results). Composite answers are concatenated exactly as the
// template renders them, including link texts.
const faqItemsFromStrings = (s) => [
  [s.faqAgentsQ, s.faqAgentsA.trim()],
  [s.faqGdprQ, s.faqGdprA.trim()],
  [s.faqMigrateQ, s.faqMigrateA.trim()],
  [s.faqCostQ, s.faqCostA.trim()],
  [s.faqOpenQ, `${s.faqOpenA1}${s.faqOpenLink}${s.faqOpenA2}`.trim()],
  [
    s.faqAltQ,
    `${s.faqAltA1}reCAPTCHA${s.faqAltSep1}hCaptcha${s.faqAltSep2}Turnstile${s.faqAltA2}`.trim(),
  ],
];

const faqPage = (loc) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  ...(loc !== "root" && { inLanguage: LOCALE_INFO[loc].lang }),
  mainEntity: faqItemsFromStrings(
    homeV2Strings[loc === "root" ? "en" : loc],
  ).map(([name, text]) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  })),
});

const LOCALIZED_APP_DESCRIPTION = {
  zh: "Cap 是一个免费、开源的 CAPTCHA 替代方案。可自托管、隐私优先、无 Google。基于工作量证明与 instrumentation，无视觉谜题。Apache 2.0 许可。",
  de: "Cap ist eine kostenlose, quelloffene CAPTCHA-Alternative. Selbst gehostet, datenschutzfreundlich, ohne Google. Proof-of-Work und Instrumentation statt Bilderrätsel. Apache 2.0.",
  fr: "Cap est une alternative aux CAPTCHA, gratuite et open source. Auto-hébergée, respectueuse de la vie privée, sans Google. Preuve de travail et instrumentation, sans puzzles visuels. Apache 2.0.",
  th: "Cap คือทางเลือกแทน CAPTCHA ที่ฟรีและโอเพนซอร์ส โฮสต์เองได้ ให้ความสำคัญกับความเป็นส่วนตัว ไม่มี Google ใช้ proof-of-work และ instrumentation แทนปริศนาภาพ ภายใต้สัญญาอนุญาต Apache 2.0",
};

const softwareApplication = (loc) =>
  loc === "root"
    ? SOFTWARE_APPLICATION
    : {
        ...SOFTWARE_APPLICATION,
        inLanguage: LOCALE_INFO[loc].lang,
        description: LOCALIZED_APP_DESCRIPTION[loc],
      };

const UI = {
  root: {
    home: "Home",
    docs: "Docs",
    compareCap: "Compare Cap",
    backToDocs: "← Back to docs",
    featureComparison: "Feature comparison",
    migrateRecaptcha: "Migrate from reCAPTCHA",
    guides: "Guides",
    bestAlternatives: "Best CAPTCHA alternatives",
    conversionRate: "CAPTCHA & conversion rate",
    openSourceCaptcha: "Open-source CAPTCHA",
    mobileBotProtection: "Mobile form bot protection",
    quickstart: "Quickstart",
    options: "Configuration",
    widget: "Widget",
    usage: "Usage",
    invisible: "Invisible",
    floating: "Floating mode",
    core: "Core library",
    community: "Community libraries",
    instrumentation: "Instrumentation",
    errorCodes: "Error codes",
    hashwx: "HashWX",
    benchmark: "Benchmark",
    compliance: "Compliance",
    demo: "Demo",
    server: "Server",
    howItWorks: "How it works",
    overview: "Overview",
    more: "More",
    editLink: "Edit this page on GitHub",
    outline: "On this page",
    prev: "Previous page",
    next: "Next page",
    lastUpdated: "Last updated",
    returnToTop: "Return to top",
    sidebarMenu: "Menu",
    darkMode: "Appearance",
    langMenu: "Change language",
    footerMessage: "Licensed under Apache 2.0",
    segNames: { capd: "capd" },
  },
  zh: {
    home: "首页",
    docs: "文档",
    compareCap: "对比 Cap",
    backToDocs: "← 返回文档",
    featureComparison: "功能对比",
    migrateRecaptcha: "从 reCAPTCHA 迁移",
    guides: "指南",
    bestAlternatives: "最佳 CAPTCHA 替代方案",
    conversionRate: "CAPTCHA 与转化率",
    openSourceCaptcha: "开源 CAPTCHA",
    mobileBotProtection: "移动端表单机器人防护",
    quickstart: "快速开始",
    options: "配置选项",
    widget: "验证组件",
    usage: "使用方法",
    invisible: "隐形模式",
    floating: "浮动模式",
    core: "核心库",
    community: "社区库",
    instrumentation: "Instrumentation",
    errorCodes: "错误码",
    hashwx: "HashWX 工作量证明",
    benchmark: "性能基准",
    compliance: "合规",
    demo: "演示",
    server: "服务端",
    howItWorks: "工作原理",
    overview: "概览",
    more: "更多",
    editLink: "在 GitHub 上编辑此页",
    outline: "本页目录",
    prev: "上一页",
    next: "下一页",
    lastUpdated: "最后更新于",
    returnToTop: "返回顶部",
    sidebarMenu: "菜单",
    darkMode: "外观",
    langMenu: "切换语言",
    footerMessage: "基于 Apache 2.0 许可发布",
    segNames: {
      alternatives: "对比",
      capd: "capd",
      troubleshooting: "故障排查",
    },
  },
  de: {
    home: "Startseite",
    docs: "Doku",
    compareCap: "Cap im Vergleich",
    backToDocs: "← Zurück zur Doku",
    featureComparison: "Funktionsvergleich",
    migrateRecaptcha: "Von reCAPTCHA migrieren",
    guides: "Guides",
    bestAlternatives: "Beste CAPTCHA-Alternativen",
    conversionRate: "CAPTCHA & Conversion-Rate",
    openSourceCaptcha: "Open-Source-CAPTCHA",
    mobileBotProtection: "Bot-Schutz für mobile Formulare",
    quickstart: "Schnellstart",
    options: "Optionen",
    widget: "Widget",
    usage: "Verwendung",
    invisible: "Unsichtbarer Modus",
    floating: "Floating-Modus",
    core: "Core-Bibliothek",
    community: "Community-Bibliotheken",
    instrumentation: "Instrumentation",
    errorCodes: "Fehlercodes",
    hashwx: "HashWX-Proof-of-Work",
    benchmark: "Benchmark",
    compliance: "Compliance",
    demo: "Demo",
    server: "Server",
    howItWorks: "Funktionsweise",
    overview: "Überblick",
    more: "Mehr",
    editLink: "Diese Seite auf GitHub bearbeiten",
    outline: "Auf dieser Seite",
    prev: "Vorherige Seite",
    next: "Nächste Seite",
    lastUpdated: "Zuletzt aktualisiert",
    returnToTop: "Nach oben",
    sidebarMenu: "Menü",
    darkMode: "Erscheinungsbild",
    langMenu: "Sprache wechseln",
    footerMessage: "Lizenziert unter Apache 2.0",
    segNames: {
      alternatives: "Vergleich",
      capd: "capd",
      troubleshooting: "Fehlerbehebung",
    },
  },
  fr: {
    home: "Accueil",
    docs: "Docs",
    compareCap: "Comparer Cap",
    backToDocs: "← Retour à la doc",
    featureComparison: "Comparatif des fonctionnalités",
    migrateRecaptcha: "Migrer depuis reCAPTCHA",
    guides: "Guides",
    bestAlternatives: "Meilleures alternatives aux CAPTCHA",
    conversionRate: "CAPTCHA et taux de conversion",
    openSourceCaptcha: "CAPTCHA open source",
    mobileBotProtection: "Protection anti-bot des formulaires mobiles",
    quickstart: "Démarrage rapide",
    options: "Configuration",
    widget: "Widget",
    usage: "Utilisation",
    invisible: "Mode invisible",
    floating: "Mode flottant",
    core: "Bibliothèque core",
    community: "Bibliothèques communautaires",
    instrumentation: "Instrumentation",
    errorCodes: "Codes d'erreur",
    hashwx: "Preuve de travail HashWX",
    benchmark: "Benchmark",
    compliance: "Conformité",
    demo: "Démo",
    server: "Serveur",
    howItWorks: "Fonctionnement",
    overview: "Vue d'ensemble",
    more: "Plus",
    editLink: "Modifier cette page sur GitHub",
    outline: "Sur cette page",
    prev: "Page précédente",
    next: "Page suivante",
    lastUpdated: "Dernière mise à jour",
    returnToTop: "Retour en haut",
    sidebarMenu: "Menu",
    darkMode: "Apparence",
    langMenu: "Changer de langue",
    footerMessage: "Sous licence Apache 2.0",
    segNames: {
      alternatives: "Comparatifs",
      capd: "capd",
      troubleshooting: "Dépannage",
    },
  },
  th: {
    home: "หน้าแรก",
    docs: "เอกสาร",
    compareCap: "เปรียบเทียบ Cap",
    backToDocs: "← กลับไปที่เอกสาร",
    featureComparison: "เปรียบเทียบฟีเจอร์",
    migrateRecaptcha: "ย้ายจาก reCAPTCHA",
    guides: "คู่มือ",
    bestAlternatives: "ทางเลือกแทน CAPTCHA ที่ดีที่สุด",
    conversionRate: "CAPTCHA กับอัตราการเปลี่ยนเป็นลูกค้า",
    openSourceCaptcha: "CAPTCHA โอเพนซอร์ส",
    mobileBotProtection: "ป้องกันบอทในฟอร์มบนมือถือ",
    quickstart: "เริ่มต้นใช้งาน",
    options: "ตัวเลือกการตั้งค่า",
    widget: "วิดเจ็ต",
    usage: "วิธีใช้งาน",
    invisible: "โหมดล่องหน",
    floating: "โหมดลอย",
    core: "ไลบรารีหลัก",
    community: "ไลบรารีจากชุมชน",
    instrumentation: "Instrumentation",
    errorCodes: "รหัสข้อผิดพลาด",
    hashwx: "พิสูจน์การทำงาน HashWX",
    benchmark: "การวัดประสิทธิภาพ",
    compliance: "การปฏิบัติตามข้อกำหนด",
    demo: "เดโม",
    server: "เซิร์ฟเวอร์",
    howItWorks: "วิธีการทำงาน",
    overview: "ภาพรวม",
    more: "เพิ่มเติม",
    editLink: "แก้ไขหน้านี้บน GitHub",
    outline: "หัวข้อในหน้านี้",
    prev: "หน้าก่อนหน้า",
    next: "หน้าถัดไป",
    lastUpdated: "อัปเดตล่าสุด",
    returnToTop: "กลับขึ้นด้านบน",
    sidebarMenu: "เมนู",
    darkMode: "ธีม",
    langMenu: "เปลี่ยนภาษา",
    footerMessage: "เผยแพร่ภายใต้สัญญาอนุญาต Apache 2.0",
    segNames: {
      alternatives: "เปรียบเทียบ",
      capd: "capd",
      troubleshooting: "แก้ปัญหา",
    },
  },
};

const GITHUB_URL = "https://github.com/tiagozip/cap";

const ABOUT_TITLE = {
  root: "About Cap",
  zh: "关于 Cap",
  de: "Über Cap",
  fr: "À propos de Cap",
  th: "เกี่ยวกับ Cap",
};

const compareSidebar = (loc) => {
  const t = UI[loc];
  const p = LOCALE_INFO[loc].prefix;
  return [
    {
      text: t.compareCap,
      items: [
        { text: t.backToDocs, link: `${p}/guide/` },
        { text: t.featureComparison, link: `${p}/guide/alternatives.md` },
        { text: t.migrateRecaptcha, link: `${p}/guide/alternatives/migrate-from-recaptcha.md` },
      ],
    },
    {
      text: "vs",
      items: [
        ["reCAPTCHA", "recaptcha"],
        ["Turnstile", "turnstile"],
        ["hCaptcha", "hcaptcha"],
        ["Altcha", "altcha"],
        ["FriendlyCaptcha", "friendlycaptcha"],
        ["SilentShield", "silentshield"],
        ["Anubis", "anubis"],
      ].map(([text, slug]) => ({ text, link: `${p}/guide/alternatives/${slug}.md` })),
    },
    {
      text: t.guides,
      items: [
        { text: t.bestAlternatives, link: `${p}/guide/best-captcha-alternatives.md` },
        { text: t.conversionRate, link: `${p}/guide/captcha-conversion-rate.md` },
        { text: t.openSourceCaptcha, link: `${p}/guide/open-source-captcha.md` },
        { text: t.mobileBotProtection, link: `${p}/guide/mobile-form-bot-protection.md` },
      ],
    },
  ];
};

const mainSidebar = (loc) => {
  const t = UI[loc];
  const p = LOCALE_INFO[loc].prefix;
  return [
    { text: t.quickstart, link: `${p}/guide/index.md` },
    {
      text: t.server,
      collapsed: false,
      items: [
        { text: "capd", link: `${p}/guide/capd/index.md` },
        { text: t.options, link: `${p}/guide/capd/options.md` },
        { text: "Workers", link: `${p}/guide/capd/workers.md` },
        { text: t.core, link: `${p}/guide/capjs-core.md` },
      ],
    },
    {
      text: t.widget,
      collapsed: false,
      items: [
        { text: t.usage, link: `${p}/guide/widget.md` },
        { text: t.invisible, link: `${p}/guide/invisible.md` },
        { text: t.floating, link: `${p}/guide/floating.md` },
      ],
    },
    {
      text: t.howItWorks,
      collapsed: false,
      items: [
        { text: t.overview, link: `${p}/guide/workings.md` },
        { text: t.hashwx, link: `${p}/guide/hashwx.md` },
        { text: t.instrumentation, link: `${p}/guide/instrumentation.md` },
        { text: t.errorCodes, link: `${p}/guide/error-codes.md` },
      ],
    },
    {
      text: t.more,
      collapsed: true,
      items: [
        { text: t.featureComparison, link: `${p}/guide/alternatives.md` },
        { text: t.community, link: `${p}/guide/community.md` },
        { text: t.benchmark, link: `${p}/guide/benchmark.md` },
        { text: t.compliance, link: `${p}/guide/compliance.md` },
        { text: t.demo, link: `${p}/guide/demo.md` },
        { text: "GitHub", link: GITHUB_URL },
      ],
    },
  ];
};

const sidebarFor = (loc) => {
  const p = LOCALE_INFO[loc].prefix;
  const compare = compareSidebar(loc);
  return {
    [`${p}/guide/best-captcha-alternatives`]: compare,
    [`${p}/guide/captcha-conversion-rate`]: compare,
    [`${p}/guide/open-source-captcha`]: compare,
    [`${p}/guide/mobile-form-bot-protection`]: compare,
    [`${p}/guide/alternatives/`]: compare,
    [`${p}/`]: mainSidebar(loc),
  };
};

const humanize = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const localeOf = (relativePath) =>
  LOCALES.find((l) => relativePath.startsWith(`${l}/`)) ?? "root";

const stripLocale = (relativePath) => {
  const loc = localeOf(relativePath);
  return loc === "root" ? relativePath : relativePath.slice(loc.length + 1);
};

function breadcrumbList(pageData) {
  const loc = localeOf(pageData.relativePath);
  const t = UI[loc];
  const rel = stripLocale(pageData.relativePath);
  const segs = rel
    .replace(/index\.md$/, "")
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean);
  if (segs[0] !== "guide") return null;
  const prefix = LOCALE_INFO[loc].prefix;
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: t.home,
      item: `https://trycap.dev${prefix}/`,
    },
  ];
  let acc = `https://trycap.dev${prefix}`;
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === segs.length - 1;
    const name =
      seg === "guide"
        ? t.docs
        : isLast
          ? pageData.title
          : (t.segNames[seg] ?? humanize(seg));
    const item = isLast
      ? acc + (rel.endsWith("index.md") ? "/" : ".html")
      : seg === "guide"
        ? `${acc}/`
        : `${acc}.html`;
    items.push({ "@type": "ListItem", position: i + 2, name, item });
  });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

const SEARCH_TEXT = {
  zh: {
    button: "搜索",
    details: "显示详细列表",
    reset: "清除查询",
    back: "关闭搜索",
    noResults: "没有找到相关结果",
    select: "选择",
    navigate: "切换",
    close: "关闭",
  },
  de: {
    button: "Suchen",
    details: "Detailansicht",
    reset: "Suche zurücksetzen",
    back: "Suche schließen",
    noResults: "Keine Ergebnisse für",
    select: "auswählen",
    navigate: "navigieren",
    close: "schließen",
  },
  fr: {
    button: "Rechercher",
    details: "Afficher les détails",
    reset: "Effacer la recherche",
    back: "Fermer la recherche",
    noResults: "Aucun résultat pour",
    select: "sélectionner",
    navigate: "naviguer",
    close: "fermer",
  },
  th: {
    button: "ค้นหา",
    details: "แสดงรายละเอียด",
    reset: "ล้างคำค้นหา",
    back: "ปิดการค้นหา",
    noResults: "ไม่พบผลลัพธ์สำหรับ",
    select: "เลือก",
    navigate: "เลื่อน",
    close: "ปิด",
  },
};

const SEARCH_LOCALES = Object.fromEntries(
  LOCALES.map((loc) => {
    const s = SEARCH_TEXT[loc];
    return [
      loc,
      {
        translations: {
          button: { buttonText: s.button, buttonAriaLabel: s.button },
          modal: {
            displayDetails: s.details,
            resetButtonTitle: s.reset,
            backButtonTitle: s.back,
            noResultsText: s.noResults,
            footer: { selectText: s.select, navigateText: s.navigate, closeText: s.close },
          },
        },
      },
    ];
  }),
);

const SITE_META = {
  zh: {
    title: "Cap – 开源、可自托管的 reCAPTCHA 替代方案",
    titleTemplate: ":title – Cap 人机验证",
    description:
      "Cap 是一个轻量、现代的开源 CAPTCHA 替代方案，基于工作量证明、时间锁与 instrumentation 质询",
  },
  de: {
    title: "Cap – Quelloffene, selbst gehostete Alternative zu reCAPTCHA",
    titleTemplate: ":title – Cap CAPTCHA",
    description:
      "Cap ist eine leichtgewichtige, moderne und quelloffene CAPTCHA-Alternative mit Proof-of-Work-, Time-Lock- und Instrumentation-Challenges",
  },
  fr: {
    title: "Cap – Alternative open source et auto-hébergée à reCAPTCHA",
    titleTemplate: ":title – Cap CAPTCHA",
    description:
      "Cap est une alternative aux CAPTCHA, légère, moderne et open source, fondée sur la preuve de travail, les verrous temporels et l'instrumentation",
  },
  th: {
    title: "Cap – ทางเลือกแทน reCAPTCHA แบบโอเพนซอร์สที่โฮสต์เองได้",
    titleTemplate: ":title – Cap CAPTCHA",
    description:
      "Cap คือทางเลือกแทน CAPTCHA ที่เบา ทันสมัย และโอเพนซอร์ส ใช้ challenge แบบ proof-of-work, time-lock และ instrumentation",
  },
};

const navFor = (loc) => {
  const h = { ...homeV2Strings.en, ...homeV2Strings[loc === "root" ? "en" : loc] };
  const p = LOCALE_INFO[loc].prefix;
  return [
    { text: h.navDocs, link: `${p}/guide/`, activeMatch: `^${p}/guide/(?!demo|alternatives)` },
    { text: h.navDemo, link: `${p}/guide/demo.html`, activeMatch: `^${p}/guide/demo` },
    { text: h.ftCompareLabel, link: `${p}/guide/alternatives.html`, activeMatch: `^${p}/guide/alternatives` },
  ];
};

const localeConfig = (loc) => {
  const t = UI[loc];
  const p = LOCALE_INFO[loc].prefix;
  return {
    label: LOCALE_INFO[loc].label,
    lang: LOCALE_INFO[loc].lang,
    ...SITE_META[loc],
    themeConfig: {
      nav: navFor(loc),
      sidebar: sidebarFor(loc),
      editLink: {
        pattern: `${GITHUB_URL}/edit/main/docs/:path`,
        text: t.editLink,
      },
      outline: { label: t.outline },
      docFooter: { prev: t.prev, next: t.next },
      lastUpdated: { text: t.lastUpdated },
      returnToTopLabel: t.returnToTop,
      sidebarMenuLabel: t.sidebarMenu,
      darkModeSwitchLabel: t.darkMode,
      langMenuLabel: t.langMenu,
      footer: {
        message: t.footerMessage,
        copyright: "<a href='https://tiago.zip' target='_blank'>made by tiago.zip</a>",
      },
    },
  };
};

// https://vitepress.dev/reference/site-config
export default withMermaid({
  lang: "en-US",
  title: "Cap – Open-source, self-hosted CAPTCHA alternative to reCAPTCHA",
  titleTemplate: ':title – Cap CAPTCHA',
  description:
    "Cap is a lightweight, modern open-source CAPTCHA alternative using proof-of-work, time-lock and instrumentation challenges",
  lastUpdated: true,
  appearance: "force-dark",
  locales: {
    root: { label: "English", lang: "en-US" },
    ...Object.fromEntries(LOCALES.map((loc) => [loc, localeConfig(loc)])),
  },
  vue: { template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } },
  vite: {
    define: { __CAP_STARS__: JSON.stringify(GITHUB_STARS_LABEL) },
    plugins: [
      {
        name: "cap-core-in-browser",
        enforce: "pre",
        resolveId(id, importer, opts) {
          if (!importer?.includes("/core/src/")) return;
          if (opts?.ssr) return ["javascript-obfuscator", "esbuild"].includes(id) ? { id, external: true } : undefined;
          if (!["node:crypto", "node:zlib", "javascript-obfuscator", "esbuild"].includes(id)) return;
          return fileURLToPath(new URL("./theme/nodeShim.js", import.meta.url));
        },
      },
      llmstxt({
        ignoreFiles: [
          ...LOCALES.map((l) => `${l}/**`),
          "guide/capd/installation.md",
          "guide/capd/usage.md",
          "guide/capd/migrate-v3-v4.md",
          "guide/effectiveness.md",
          "guide/solver.md",
        ],
      }),
    ],
    resolve: {
      alias: [
        {
          find: /^.*\/VPLocalNavOutlineDropdown\.vue$/,
          replacement: fileURLToPath(new URL("./theme/components/OutlineDropdown.vue", import.meta.url)),
        },
      ],
    },
  },
  srcExclude: ["public/**"],
  transformPageData(pageData) {
    if (!pageData.description || !pageData.description.trim()) {
      const t = pageData.title || pageData.frontmatter.title || "Cap";
      pageData.description = `${t} – Cap, the open-source self-hosted CAPTCHA. Apache 2.0, no Google, no telemetry.`;
    }
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      "link",
      {
        rel: "canonical",
        href: `https://trycap.dev/${pageData.relativePath}`
          .replace(/index\.md$/, "")
          .replace(/\.md$/, ".html"),
      },
    ]);
  },
  transformHead({ title, description, pageData }) {
    const canonical = `https://trycap.dev/${pageData.relativePath}`
      .replace(/index\.md$/, "")
      .replace(/\.md$/, ".html");
    const head = [
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: canonical }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
    ];
    const toUrl = (rel) =>
      `https://trycap.dev/${rel}`.replace(/index\.md$/, "").replace(/\.md$/, ".html");
    const baseRel = stripLocale(pageData.relativePath);
    head.push(
      ["link", { rel: "alternate", hreflang: "en", href: toUrl(baseRel) }],
      ...LOCALES.map((loc) => [
        "link",
        { rel: "alternate", hreflang: LOCALE_INFO[loc].hreflang, href: toUrl(`${loc}/${baseRel}`) },
      ]),
      ["link", { rel: "alternate", hreflang: "x-default", href: toUrl(baseRel) }],
    );
    const dates = gitDates(pageData.relativePath);
    const published = pageData.frontmatter.datePublished || dates?.published;
    const modified = dates?.modified;
    if (published) {
      head.push(["meta", { property: "article:published_time", content: published }]);
    }
    if (modified) {
      head.push(["meta", { property: "article:modified_time", content: modified }]);
    }
    const loc = localeOf(pageData.relativePath);
    if (baseRel === "index.md") {
      head.push(jsonLd(softwareApplication(loc)), jsonLd(ORGANIZATION), jsonLd(faqPage(loc)));
    } else if (baseRel === "about.md") {
      const aboutUrl = `https://trycap.dev${LOCALE_INFO[loc].prefix}/about.html`;
      head.push(
        jsonLd(ORGANIZATION),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": aboutUrl,
          name: ABOUT_TITLE[loc],
          url: aboutUrl,
          description,
          ...(loc !== "root" && { inLanguage: LOCALE_INFO[loc].lang }),
          mainEntity: { "@id": "https://trycap.dev/#organization" },
          ...(modified && { dateModified: modified }),
        }),
      );
    } else {
      const bc = breadcrumbList(pageData);
      if (bc) head.push(jsonLd(bc));
      const faq = pageData.frontmatter.faq;
      if (Array.isArray(faq) && faq.length) {
        head.push(
          jsonLd({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: title,
            description,
            url: canonical,
            about: { "@id": "https://trycap.dev/#software" },
            author: { "@type": "Person", name: "tiago", url: "https://tiago.zip" },
            publisher: { "@id": "https://trycap.dev/#organization" },
            ...(published && { datePublished: published }),
            ...(modified && { dateModified: modified }),
          }),
          jsonLd({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        );
      }
      if (pageData.relativePath === "guide/best-captcha-alternatives.md") {
        head.push(
          jsonLd({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            numberOfItems: 7,
            itemListElement: [
              ["Cap", "https://trycap.dev/"],
              ["Cloudflare Turnstile", "https://trycap.dev/guide/alternatives/turnstile.html"],
              ["ALTCHA", "https://trycap.dev/guide/alternatives/altcha.html"],
              ["FriendlyCaptcha", "https://trycap.dev/guide/alternatives/friendlycaptcha.html"],
              ["SilentShield", "https://trycap.dev/guide/alternatives/silentshield.html"],
              ["hCaptcha", "https://trycap.dev/guide/alternatives/hcaptcha.html"],
              ["reCAPTCHA", "https://trycap.dev/guide/alternatives/recaptcha.html"],
            ].map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, url })),
          }),
        );
      }
    }
    return head;
  },
  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
    ["link", { rel: "preconnect", href: "https://cdn.jsdelivr.net" }],
    ["link", { rel: "preconnect", href: "https://a.tiago.zip" }],
    ["link", { rel: "preconnect", href: "https://fullres-script-proxy.tiag.workers.dev" }],
    ["link", { rel: "dns-prefetch", href: "https://cdn.jsdelivr.net" }],
    ["link", { rel: "dns-prefetch", href: "https://a.tiago.zip" }],
    ["link", { rel: "dns-prefetch", href: "https://fullres-script-proxy.tiag.workers.dev" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "proof-of-work, computational challenge, cryptographic puzzle, challenge-response protocol, human verification, anti-bot, anti-abuse, automated attacks, bot detection, bot mitigation, api protection, account security, form security, spam prevention, ddos protection, malicious traffic, web application security, security library, challenge generator, captcha, hcaptcha, turnstile",
      },
    ],
    ["meta", { name: "author", content: "tiagozip" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Cap" }],
    ["meta", { property: "og:image", content: "https://trycap.dev/og-image.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        property: "theme-color",
        content: "#007aff",
      },
    ],
    ["meta", { name: "twitter:image", content: "https://trycap.dev/og-image.png" }],
    [
      "meta",
      {
        name: "google-site-verification",
        content: "_qNXNJhgoxAeT8hv5PctRvPqfwRKOGo-TtjAhFewmYw",
      },
    ],
    [
      "script",
      {},
      `(function(){try{
        var L=${JSON.stringify(LOCALES)};
        var p=location.pathname;
        if(L.indexOf(p.split('/')[1])!==-1)return;
        if(localStorage.getItem('cap-locale'))return;
        var langs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'']);
        for(var i=0;i<langs.length;i++){
          var base=String(langs[i]).toLowerCase().split('-')[0];
          if(base==='en')return;
          if(L.indexOf(base)!==-1){
            localStorage.setItem('cap-locale',base);
            location.replace('/'+base+p+location.search+location.hash);
            return;
          }
        }
      }catch(e){}})();`,
    ],
    [
      "script",
      {},
      `(function(){try{var h=['/'].concat(${JSON.stringify(LOCALES)}.map(function(l){return '/'+l+'/'}));var p=location.pathname.replace(/index\\.html$/,'');if(h.indexOf(p)!==-1){document.documentElement.classList.add('home-v2-active');}}catch(e){}})();`
    ],
    [
      "script",
      {
        async: true,
        src: "https://cap-his-collector.tiag.workers.dev/his-embed.js",
        "data-endpoint": "https://cap-his-collector.tiag.workers.dev/collect",
        "data-sample": "1.0",
        "data-min-events": "12",
      },
    ],
    [
      "script",
      {},
      `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();
      if (location.hostname === 'capjs.js.org') {
        const pa = new URLSearchParams({
          utm_source: 'capjs.js.org',
          utm_medium: 'redirect',
          utm_campaign: 'legacy-domain',
        });
        if (document.referrer) {pa.set('ref', document.referrer);}
        location.replace(\`https://trycap.dev\${location.pathname}\${location.search ? location.search + '&' : '?'}\${pa}\${location.hash}\`);
      }`
    ],
    [
      "script",
      {
        defer: true,
        src: "https://palantir.estrogen.delivery/Pn7xQk2.js",
        "data-domain": "trycap.dev",
      }
    ],
    [
      "script",
      {
        defer: true,
        "no-twidget": "true",
        src: "https://tiago.zip/cdn/widget.js",
      },
    ],
    [
      "script",
      {
        async: true,
      },
      `
        (function(){
          var fullres = document.createElement('script');
          fullres.async = true;
          fullres.src = 'https://fullres-script-proxy.tiag.workers.dev/wqwhjp/capjsjs.js?'+(new Date()-new Date()%43200000);
          fullres.attributes.siteKeyOverride = 'capjsjs';
          document.head.appendChild(fullres);
        })();`,
    ],
    [
      "script",
      {
        defer: true,
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        "data-cf-beacon": '{"token": "830eeece2e7b4e098ada3bc222add836"}',
      },
    ],
    [
      "script",
      {
        src: "https://cdn.jsdelivr.net/npm/cap-widget@0.1.59",
        async: true,
      },
    ],
  ],
  themeConfig: {
    search: {
      provider: "local",
      options: {
        detailedView: true,
        locales: SEARCH_LOCALES,
        _render(src, env, md) {
          const html = md.render(src, env);
          if (env.frontmatter?.search === false) return "";
          const path = env.relativePath.replace(/^(zh|de|fr|th)\//, "");
          if (/^guide\/(best-captcha-alternatives|captcha-conversion-rate|open-source-captcha|mobile-form-bot-protection)\.md$/.test(path)) return "";
          if (/^guide\/alternatives\/(?!migrate-from-recaptcha)/.test(path)) return "";
          return html;
        },
      },
    },
    logo: "/logo.png",
    siteTitle: "Cap",

    editLink: {
      pattern: "https://github.com/tiagozip/cap/edit/main/docs/:path",
    },

    nav: navFor("root"),

    sidebar: sidebarFor("root"),

    socialLinks: [
      { icon: "github", link: "https://github.com/tiagozip/cap" },
      { icon: "twitter", link: "https://x.com/tiagozip_" },
    ],

    footer: {
      message: "Licensed under Apache 2.0",
      copyright: "<a href='https://tiago.zip' target='_blank'>made by tiago.zip</a>",
    },
  },
  markdown: {
    theme: "catppuccin-mocha",
    image: {
      lazyLoading: true,
    },
  },
  sitemap: {
    hostname: "https://trycap.dev",
    transformItems(items) {
      const excluded = [
        "guide/standalone.html",
        "guide/server.html",
        "guide/capd/usage.html",
        "guide/capd/installation.html",
        "guide/capd/migrate-v3-v4.html",
      ];
      return items.filter(
        (item) =>
          !item.url.includes("/public/") &&
          !excluded.some((path) => item.url.endsWith(path)),
      );
    },
  },
});
