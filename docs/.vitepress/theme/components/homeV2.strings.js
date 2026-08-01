// UI strings for HomeV2.vue, keyed by VitePress locale index
// ("root" falls back to `en` in the component).
//
// NOTE: some English values intentionally keep leading/trailing spaces.
// They reproduce the exact whitespace the Vue template compiler emitted
// for the original hard-coded text, so the server-rendered English
// markup stays byte-identical to the pre-i18n build.
export const homeV2Strings = {
  en: {
    // Widget referral banner
    bannerRegionLabel: "From the Cap widget",
    bannerVerified: "You just verified you're human with Cap",
    bannerHostPrefix: "\u00A0on ",
    bannerVerifiedEnd: ".",
    bannerSub:
      "You can close this tab. Or stick around if you're curious what Cap is.",
    bannerDismiss: "Dismiss",

    // Header nav
    navBrandLabel: "Cap home",
    navDocs: "Docs",
    navFeatures: "Features",
    navDemo: "Demo",

    // Hero
    heroTitle: " Self-hosted CAPTCHA",
    heroTitleDim: "for the modern web.",
    heroLead1: " No Google. No telemetry. No visual puzzles. ",
    heroLead2: "Switch from reCAPTCHA in minutes. ",
    heroCtaStart: "Get started in 5 minutes ",
    heroCtaPromptTitle: "Sets up your AI agent for Cap",
    heroCtaPromptCopied: "Prompt copied!",
    heroCtaCopyPrompt: "Copy agent prompt",
    heroDashAlt: "Cap admin dashboard screenshot",

    // Trust bar
    trustLabel: "Trusted in production by",

    // Feature grid
    featPrivacyTitle: "Privacy-first. No tracking.",
    featPrivacyBody:
      " Zero telemetry. No third-party network. Your users' data stays between you and them. ",
    featSizeTitle: "250x smaller than hCaptcha.",
    featSizeBody: " ~20kb, zero dependencies. Loads in milliseconds, not seconds. ",
    featInvisibleTitle: "No visual puzzles. Always invisible.",
    featInvisibleBody:
      " PoW, time-lock challenges and instrumentation run silently in the background. ",
    featOpenTitle: "Free & open-source",
    featOpenBody:
      " Apache 2.0 licensed. Audit it, fork it, self-host it. No vendor can pull the rug. ",
    featLawsTitle: "Built for privacy laws.",
    featLawsBody:
      " Designed to help you meet GDPR, CCPA, LGPD and more, with strict privacy and accessibility standards baked in. ",
    featCustomTitle: "Fully customizable",
    featCustomBody:
      " Colors, size, position, icons, all controllable via CSS variables. No iframe lock-in. ",

    // Compliance
    cmplTitle: "Compliant out of the box.",
    cmplBody:
      " Open-source, self-hosted and privacy-first. We don't use cookies or tracking and no data leaves your servers. ",
    cmplLink: "See how Cap complies ",
    cmplPrivacyLabel: "Privacy & data",
    cmplAccessibilityLabel: "Accessibility",
    cmplI18nChip: "Internationalization (i18n)",
    cmplRtlChip: "RTL support",

    // Bundle size
    speedTitle: "A fraction of the weight",
    speedBody:
      " Cap's widget is extremely lightweight and runs invisibly, shipping only about 20 kB of JavaScript with no third-party scripts. ",
    speedNote: "Client bundle sizes (minified gzip)",

    // Testimonial
    quoteLead: " Cap has been a good fit for AdGuard Temp Mail. We use it as an ",
    quoteHl1: "invisible, self-hosted CAPTCHA layer",
    quoteMid1: " with ",
    quoteHl2: "proof-of-work and browser instrumentation challenges",
    quoteMid2:
      ", which helps us add abuse protection while keeping the experience ",
    quoteHl3: "lightweight and unobtrusive",
    quoteEnd: " for regular users. ",
    quoteRole: "Head of PR, AdGuard",

    // Comparison
    compareTitle: "How it compares",
    compareBody:
      " Cap is the free, open-source, self-hosted option, same detection tier as the big names, without shipping your users' data to a third party. ",
    compareLink: "See the full comparison ",
    compareSelfTitle: "Self-hosted",
    compareSelfBody:
      " Runs entirely on your own server. reCAPTCHA, hCaptcha and Turnstile are cloud-only. ",
    compareOpenTitle: "Open source",
    compareOpenBody:
      " Apache 2.0. Read it, fork it, own it. The big three are closed source. ",
    comparePuzzlesTitle: "No visual puzzles",
    comparePuzzlesBody:
      " Invisible proof-of-work, no crosswalks. reCAPTCHA and hCaptcha still show puzzles. ",
    compareTelemetryTitle: "Zero third-party telemetry",
    compareTelemetryBody:
      " Your visitors' data never leaves your server. Google, Cloudflare and hCaptcha all phone home. ",
    compareFreeTitle: "Free at scale",
    compareFreeBody:
      " No quotas, no per-request fees. reCAPTCHA and hCaptcha meter or charge. ",
    compareLayersTitle: "Layered defense",
    compareLayersBody:
      " Proof-of-work layered with dynamic JavaScript instrumentation challenges ",

    // Widget demo
    widgetDemoTitle: "Try solving a Cap challenge",

    // Two layers
    layersTitle1: " Two independent layers.",
    layersTitle2: "Bypass one, the other still holds. ",
    layersBody:
      " Every challenge solves proof-of-work and runs browser instrumentation at the same time. Defeating one layer doesn't defeat the other. ",
    layersPowLabel: "Layer 01",
    layersPowTitle: "PoW and time-locks",
    layersPowBody:
      " The client solves parallel SHA-256 hashes and time-lock challenges tuned against GPU acceleration in WASM. ",
    layersKvHashes: "hashes/s",
    layersKvTarget: "target",
    layersJsLabel: "Layer 02",
    layersJsTitle: "JS instrumentation",
    layersJsBody:
      " A freshly-generated JS program runs complex JavaScript, DOM and browser checks. ",

    // Stats
    statsLabel: "CDN hits · 12mo",

    // Closer strip
    closerSizeLabel: "size",
    closerSizeNote: "vs 600 kb+ hCaptcha",
    closerTrackersLabel: "trackers",
    closerTrackersNote: "vs reCAPTCHA",
    closerCostLabel: "cost",
    closerCostNote: "vs $1k+ hCaptcha",
    closerSetupLabel: "setup",
    closerSetupNote: "docker container",

    // FAQ
    faqGdprQ: "Is it GDPR-friendly?",
    faqGdprA:
      " Yes. Cap doesn't phone home, doesn't set cookies, and doesn't fingerprint users. Your server sees the verification, no one else does. ",
    faqMigrateQ: "Can I migrate from reCAPTCHA / hCaptcha?",
    faqMigrateA:
      " Yes. Cap's siteverify API is compatible with reCAPTCHA and hCaptcha, but you'll need to swap your client-side code to use Cap's widget. ",
    faqBotsQ: "How effective is it against real bots?",
    faqBotsA:
      " Cap's instrumentation combined with proof-of-work is very effective at making abuse extremely difficult to automate at scale. ",
    faqCostQ: "What does it cost to self-host?",
    faqCostA:
      " Cap Standalone fits on a $5 VPS for most sites. There are no per-request fees, no egress to a third party, and no API quotas to hit. ",
    faqOpenQ: "What is an open-source CAPTCHA?",
    faqOpenA1:
      " An open-source CAPTCHA is bot protection whose code you can read, audit, and ",
    faqOpenLink: "self-host",
    faqOpenA2:
      ", rather than a closed third-party service. Cap is licensed under Apache 2.0 and runs entirely on your own infrastructure, so visitor data never reaches a vendor. ",
    faqAltQ: "What is the best open-source alternative to reCAPTCHA?",
    faqAltA1:
      " Cap is a privacy-first, self-hosted alternative to Google reCAPTCHA that uses proof-of-work and instrumentation instead of visual puzzles or tracking. Compare it against ",
    faqAltSep1: ", ",
    faqAltSep2: ", and ",
    faqAltA2: " to find what fits your stack. ",

    // Bottom CTA
    ctaTitle: "Ditch reCAPTCHA this afternoon.",
    ctaBody:
      " Drop the widget into your site, point it at a $5 VPS, and stop paying anyone to see your users' traffic. ",
    ctaStart: "Get started in 5 minutes",
    ctaDemo: "Try the demo ",
    ctaGithub: "Star on GitHub",

    // Footer
    ftTagline1: " Self-hosted, open-source CAPTCHA.",
    ftTagline2: " No Google. No telemetry. No puzzles. ",
    ftProductLabel: "Product",
    ftQuickstart: "Quickstart",
    ftWidget: "Widget",
    ftDemo: "Demo",
    ftCompareLabel: "Compare",
    ftVsRecaptcha: "vs reCAPTCHA",
    ftVsTurnstile: "vs Turnstile",
    ftVsHcaptcha: "vs hCaptcha",
    ftAllComparisons: "All comparisons",
    ftLearnLabel: "Learn",
    ftHowItWorks: "How it works",
    ftEffectiveness: "Effectiveness",
    ftCompliance: "Compliance",
    ftCommunity: "Community",
    ftLegal: " Not legal advice. Compliance depends on your deployment. ",
  },
  zh: {
    // Widget referral banner
    bannerRegionLabel: "来自 Cap 验证组件",
    bannerVerified: "你刚刚通过 Cap 完成了人机验证",
    bannerHostPrefix: "\u00A0·\u00A0",
    bannerVerifiedEnd: "。",
    bannerSub: "你可以关掉这个标签页了。如果好奇 Cap 是什么，欢迎继续了解。",
    bannerDismiss: "关闭",

    // Header nav
    navBrandLabel: "Cap 首页",
    navDocs: "文档",
    navFeatures: "特性",
    navDemo: "演示",

    // Hero
    heroTitle: "自托管 CAPTCHA",
    heroTitleDim: "为现代 Web 而生。",
    heroLead1: "没有 Google，没有遥测，没有图形谜题。",
    heroLead2: "几分钟就能从 reCAPTCHA 迁移过来。",
    heroCtaStart: "5 分钟上手 ",
    heroCtaPromptTitle: "为你的 AI Agent 配置好 Cap 接入",
    heroCtaPromptCopied: "提示词已复制！",
    heroCtaCopyPrompt: "复制 Agent 提示词",
    heroDashAlt: "Cap 管理后台截图",

    // Trust bar
    trustLabel: "他们已在生产环境使用 Cap",

    // Feature grid
    featPrivacyTitle: "隐私优先，零追踪。",
    featPrivacyBody: "零遥测，不连第三方网络。用户数据只留在你和用户之间。",
    featSizeTitle: "体积仅为 hCaptcha 的 1/250。",
    featSizeBody: "约 20kb，零依赖。加载按毫秒算，不是按秒算。",
    featInvisibleTitle: "没有图形谜题，始终隐形。",
    featInvisibleBody:
      "工作量证明（PoW）、时间锁质询与 instrumentation 都在后台静默运行。",
    featOpenTitle: "免费且开源",
    featOpenBody:
      "Apache 2.0 许可。可审计、可 fork、可自托管，没有厂商能釜底抽薪。",
    featLawsTitle: "为隐私法规而生。",
    featLawsBody:
      "帮你满足 GDPR、CCPA、LGPD 等法规，严格的隐私与无障碍标准开箱即用。",
    featCustomTitle: "深度可定制",
    featCustomBody:
      "颜色、尺寸、位置、图标，全都能用 CSS 变量控制，不被 iframe 锁死。",

    // Compliance
    cmplTitle: "开箱即合规。",
    cmplBody:
      "开源、自托管、隐私优先。不用 Cookie、不做追踪，任何数据都不会离开你的服务器。",
    cmplLink: "看看 Cap 如何合规 ",
    cmplPrivacyLabel: "隐私与数据",
    cmplAccessibilityLabel: "无障碍",
    cmplI18nChip: "国际化（i18n）",
    cmplRtlChip: "RTL 支持",

    // Bundle size
    speedTitle: "体积只是别人的零头",
    speedBody:
      "Cap 的验证组件很轻，全程隐形：约 20 kB JavaScript，零第三方脚本。",
    speedNote: "客户端包体积（minified gzip）",

    // Testimonial
    quoteLead: "Cap 很适合 AdGuard Temp Mail。我们把它用作",
    quoteHl1: "隐形、自托管的 CAPTCHA 层",
    quoteMid1: "，搭配",
    quoteHl2: "工作量证明与浏览器 instrumentation 质询",
    quoteMid2: "，在为服务加上滥用防护的同时，让普通用户的体验保持",
    quoteHl3: "轻量、无打扰",
    quoteEnd: "。",
    quoteRole: "AdGuard 公关负责人",

    // Comparison
    compareTitle: "横向对比",
    compareBody:
      "Cap 是免费、开源、可自托管的那一个：检测水准与大牌同级，却不会把用户数据送去第三方。",
    compareLink: "查看完整对比 ",
    compareSelfTitle: "自托管",
    compareSelfBody:
      "完全运行在你自己的服务器上。reCAPTCHA、hCaptcha 和 Turnstile 都只有云端版本。",
    compareOpenTitle: "开源",
    compareOpenBody: "Apache 2.0。可阅读、可 fork、完全归你。三巨头都是闭源。",
    comparePuzzlesTitle: "没有图形谜题",
    comparePuzzlesBody:
      "隐形的工作量证明，不用再找斑马线。reCAPTCHA 和 hCaptcha 至今仍在出图形题。",
    compareTelemetryTitle: "零第三方遥测",
    compareTelemetryBody:
      "访客数据永不离开你的服务器。Google、Cloudflare 和 hCaptcha 全都会回传数据。",
    compareFreeTitle: "规模再大也免费",
    compareFreeBody:
      "没有配额，没有按请求计费。reCAPTCHA 和 hCaptcha 要么限量、要么收钱。",
    compareLayersTitle: "分层防御",
    compareLayersBody: "工作量证明叠加动态 JavaScript instrumentation 质询",

    // Widget demo
    widgetDemoTitle: "亲手解一道 Cap 质询",

    // Two layers
    layersTitle1: "两道独立防线。",
    layersTitle2: "绕过一道，还有一道。",
    layersBody:
      "每次质询都会同时求解工作量证明并运行浏览器 instrumentation。攻破一层，另一层依然有效。",
    layersPowLabel: "防线 01",
    layersPowTitle: "PoW 与时间锁",
    layersPowBody:
      "客户端在 WASM 中并行求解 SHA-256 哈希与时间锁质询，并针对 GPU 加速做了专门对抗。",
    layersKvHashes: "哈希/秒",
    layersKvTarget: "目标",
    layersJsLabel: "防线 02",
    layersJsTitle: "JS instrumentation",
    layersJsBody:
      "每次都全新生成的 JS 程序，执行复杂的 JavaScript、DOM 与浏览器检测。",

    // Stats
    statsLabel: "CDN 请求 · 近 12 个月",

    // Closer strip
    closerSizeLabel: "体积",
    closerSizeNote: "vs 600 kb+ 的 hCaptcha",
    closerTrackersLabel: "追踪器",
    closerTrackersNote: "vs reCAPTCHA",
    closerCostLabel: "费用",
    closerCostNote: "vs $1k+ 的 hCaptcha",
    closerSetupLabel: "部署",
    closerSetupNote: "一个 Docker 容器",

    // FAQ
    faqGdprQ: "它符合 GDPR 吗？",
    faqGdprA:
      "符合。Cap 不回传数据、不设 Cookie、不做用户指纹。验证只有你的服务器看得到，别人一概看不到。",
    faqMigrateQ: "能从 reCAPTCHA / hCaptcha 迁移吗？",
    faqMigrateA:
      "能。Cap 的 siteverify API 兼容 reCAPTCHA 和 hCaptcha，只需把客户端代码换成 Cap 的验证组件。",
    faqBotsQ: "对真实机器人的防护效果如何？",
    faqBotsA:
      "很有效。instrumentation 加上工作量证明，让滥用行为很难被大规模自动化。",
    faqCostQ: "自托管要花多少钱？",
    faqCostA:
      "对多数站点而言，一台 $5 的 VPS 就能跑 Cap Standalone。没有按请求收费，没有流向第三方的流量，也没有会触顶的 API 配额。",
    faqOpenQ: "什么是开源 CAPTCHA？",
    faqOpenA1: "开源 CAPTCHA 是一种代码可读、可审计、可",
    faqOpenLink: "自托管",
    faqOpenA2:
      "的机器人防护，而非封闭的第三方服务。Cap 采用 Apache 2.0 许可，完全运行在你自己的基础设施上，访客数据永远不会到达任何厂商。",
    faqAltQ: "reCAPTCHA 最好的开源替代是什么？",
    faqAltA1:
      "Cap 是 Google reCAPTCHA 的隐私优先、自托管替代方案，以工作量证明和 instrumentation 取代图形谜题与追踪。不妨对比一下 ",
    faqAltSep1: "、",
    faqAltSep2: " 和 ",
    faqAltA2: "，看看哪个更适合你的技术栈。",

    // Bottom CTA
    ctaTitle: "今天下午，就跟 reCAPTCHA 说再见。",
    ctaBody:
      "把验证组件放进站点，指向一台 $5 的 VPS，从此不再付钱让别人看你用户的流量。",
    ctaStart: "5 分钟上手",
    ctaDemo: "试试演示 ",
    ctaGithub: "去 GitHub 点个 Star",

    // Footer
    ftTagline1: "自托管、开源的 CAPTCHA。",
    ftTagline2: "没有 Google，没有遥测，没有谜题。",
    ftProductLabel: "产品",
    ftQuickstart: "快速开始",
    ftWidget: "验证组件",
    ftDemo: "演示",
    ftCompareLabel: "对比",
    ftVsRecaptcha: "vs reCAPTCHA",
    ftVsTurnstile: "vs Turnstile",
    ftVsHcaptcha: "vs hCaptcha",
    ftAllComparisons: "全部对比",
    ftLearnLabel: "了解",
    ftHowItWorks: "工作原理",
    ftEffectiveness: "防护效果",
    ftCompliance: "合规",
    ftCommunity: "社区",
    ftLegal: "本页不构成法律建议。是否合规取决于你的部署方式。",
  },
  de: {
    // Widget referral banner
    bannerRegionLabel: "Vom Cap-Widget",
    bannerVerified: "Du hast dich gerade mit Cap als Mensch verifiziert",
    bannerHostPrefix: " auf ",
    bannerVerifiedEnd: ".",
    bannerSub:
      "Du kannst diesen Tab schließen. Oder bleib, wenn dich interessiert, was Cap ist.",
    bannerDismiss: "Schließen",

    // Header nav
    navBrandLabel: "Cap Startseite",
    navDocs: "Doku",
    navFeatures: "Features",
    navDemo: "Demo",

    // Hero
    heroTitle: "Selbst gehostetes CAPTCHA",
    heroTitleDim: "für das moderne Web.",
    heroLead1: "Kein Google. Keine Telemetrie. Keine Bilderrätsel.",
    heroLead2: "In Minuten von reCAPTCHA umsteigen.",
    heroCtaStart: "In 5 Minuten loslegen ",
    heroCtaPromptTitle: "Richtet deinen KI-Agenten für Cap ein",
    heroCtaPromptCopied: "Prompt kopiert!",
    heroCtaCopyPrompt: "Agent-Prompt kopieren",
    heroDashAlt: "Screenshot des Cap-Admin-Dashboards",

    // Trust bar
    trustLabel: "Im Produktivbetrieb im Einsatz bei",

    // Feature grid
    featPrivacyTitle: "Datenschutz zuerst. Kein Tracking.",
    featPrivacyBody:
      "Null Telemetrie. Kein Drittanbieter-Netzwerk. Die Daten deiner Nutzer bleiben zwischen euch.",
    featSizeTitle: "250x kleiner als hCaptcha.",
    featSizeBody:
      "~20 kb, keine Abhängigkeiten. Lädt in Millisekunden, nicht in Sekunden.",
    featInvisibleTitle: "Keine Bilderrätsel. Immer unsichtbar.",
    featInvisibleBody:
      "PoW, Time-Lock-Challenges und Instrumentation laufen still im Hintergrund.",
    featOpenTitle: "Kostenlos & quelloffen",
    featOpenBody:
      "Apache-2.0-Lizenz. Prüfen, forken, selbst hosten. Kein Anbieter kann dir den Boden unter den Füßen wegziehen.",
    featLawsTitle: "Für Datenschutzgesetze gebaut.",
    featLawsBody:
      "Entwickelt, damit du DSGVO, CCPA, LGPD und mehr erfüllst, mit strengen Datenschutz- und Barrierefreiheitsstandards von Haus aus.",
    featCustomTitle: "Vollständig anpassbar",
    featCustomBody:
      "Farben, Größe, Position, Icons, alles über CSS-Variablen steuerbar. Kein iframe-Lock-in.",

    // Compliance
    cmplTitle: "Von Haus aus konform.",
    cmplBody:
      "Quelloffen, selbst gehostet und datenschutzfreundlich. Keine Cookies, kein Tracking, und keine Daten verlassen deine Server.",
    cmplLink: "So erfüllt Cap die Vorgaben ",
    cmplPrivacyLabel: "Datenschutz & Daten",
    cmplAccessibilityLabel: "Barrierefreiheit",
    cmplI18nChip: "Internationalisierung (i18n)",
    cmplRtlChip: "RTL-Unterstützung",

    // Bundle size
    speedTitle: "Ein Bruchteil des Gewichts",
    speedBody:
      "Das Cap-Widget ist extrem leichtgewichtig und läuft unsichtbar: nur rund 20 kB JavaScript, ohne Drittanbieter-Skripte.",
    speedNote: "Client-Bundle-Größen (minified, gzip)",

    // Testimonial
    quoteLead: "Cap passt gut zu AdGuard Temp Mail. Wir nutzen es als ",
    quoteHl1: "unsichtbare, selbst gehostete CAPTCHA-Schicht",
    quoteMid1: " mit ",
    quoteHl2: "Proof-of-Work- und Browser-Instrumentation-Challenges",
    quoteMid2:
      ", was uns hilft, Missbrauchsschutz zu ergänzen und die Erfahrung dabei ",
    quoteHl3: "leichtgewichtig und unaufdringlich",
    quoteEnd: " für normale Nutzer zu halten. ",
    quoteRole: "Head of PR, AdGuard",

    // Comparison
    compareTitle: "Im Vergleich",
    compareBody:
      "Cap ist die kostenlose, quelloffene, selbst gehostete Option: dieselbe Erkennungsklasse wie die großen Namen, ohne die Daten deiner Nutzer an Dritte zu schicken.",
    compareLink: "Zum vollständigen Vergleich ",
    compareSelfTitle: "Selbst gehostet",
    compareSelfBody:
      "Läuft vollständig auf deinem eigenen Server. reCAPTCHA, hCaptcha und Turnstile gibt es nur in der Cloud.",
    compareOpenTitle: "Open Source",
    compareOpenBody:
      "Apache 2.0. Lies es, forke es, besitze es. Die großen drei sind Closed Source.",
    comparePuzzlesTitle: "Keine Bilderrätsel",
    comparePuzzlesBody:
      "Unsichtbarer Proof-of-Work, keine Zebrastreifen. reCAPTCHA und hCaptcha zeigen weiterhin Rätsel.",
    compareTelemetryTitle: "Null Drittanbieter-Telemetrie",
    compareTelemetryBody:
      "Die Daten deiner Besucher verlassen nie deinen Server. Google, Cloudflare und hCaptcha funken alle nach Hause.",
    compareFreeTitle: "Kostenlos in jeder Größenordnung",
    compareFreeBody:
      "Keine Kontingente, keine Gebühren pro Anfrage. reCAPTCHA und hCaptcha deckeln oder kassieren.",
    compareLayersTitle: "Gestaffelte Verteidigung",
    compareLayersBody:
      "Proof-of-Work kombiniert mit dynamischen JavaScript-Instrumentation-Challenges",

    // Widget demo
    widgetDemoTitle: "Löse selbst eine Cap-Challenge",

    // Two layers
    layersTitle1: "Zwei unabhängige Schichten.",
    layersTitle2: "Umgehst du eine, hält die andere.",
    layersBody:
      "Jede Challenge löst Proof-of-Work und führt gleichzeitig Browser-Instrumentation aus. Eine Schicht zu knacken knackt die andere nicht.",
    layersPowLabel: "Schicht 01",
    layersPowTitle: "PoW und Time-Locks",
    layersPowBody:
      "Der Client löst parallele SHA-256-Hashes und Time-Lock-Challenges, in WASM und gezielt gegen GPU-Beschleunigung ausgelegt.",
    layersKvHashes: "Hashes/s",
    layersKvTarget: "Ziel",
    layersJsLabel: "Schicht 02",
    layersJsTitle: "JS-Instrumentation",
    layersJsBody:
      "Ein frisch generiertes JS-Programm führt komplexe JavaScript-, DOM- und Browser-Checks aus.",

    // Stats
    statsLabel: "CDN-Abrufe · 12 Mon.",

    // Closer strip
    closerSizeLabel: "Größe",
    closerSizeNote: "vs. 600 kb+ bei hCaptcha",
    closerTrackersLabel: "Tracker",
    closerTrackersNote: "vs. reCAPTCHA",
    closerCostLabel: "Kosten",
    closerCostNote: "vs. $1k+ bei hCaptcha",
    closerSetupLabel: "Setup",
    closerSetupNote: "ein Docker-Container",

    // FAQ
    faqGdprQ: "Ist es DSGVO-freundlich?",
    faqGdprA:
      "Ja. Cap funkt nicht nach Hause, setzt keine Cookies und erstellt keine Fingerprints. Nur dein Server sieht die Verifizierung, sonst niemand.",
    faqMigrateQ: "Kann ich von reCAPTCHA / hCaptcha migrieren?",
    faqMigrateA:
      "Ja. Caps siteverify-API ist zu reCAPTCHA und hCaptcha kompatibel, du musst nur den Client-Code auf Caps Widget umstellen.",
    faqBotsQ: "Wie wirksam ist es gegen echte Bots?",
    faqBotsA:
      "Caps Instrumentation in Kombination mit Proof-of-Work macht es sehr schwer, Missbrauch in großem Maßstab zu automatisieren.",
    faqCostQ: "Was kostet das Selbst-Hosten?",
    faqCostA:
      "Cap Standalone läuft für die meisten Websites auf einem 5-$-VPS. Keine Gebühren pro Anfrage, kein Traffic zu Dritten und keine API-Kontingente, an die du stößt.",
    faqOpenQ: "Was ist ein Open-Source-CAPTCHA?",
    faqOpenA1:
      "Ein Open-Source-CAPTCHA ist Bot-Schutz, dessen Code du lesen, prüfen und ",
    faqOpenLink: "selbst hosten",
    faqOpenA2:
      " kannst, statt eines geschlossenen Drittanbieterdienstes. Cap steht unter der Apache-2.0-Lizenz und läuft vollständig auf deiner eigenen Infrastruktur, Besucherdaten erreichen also nie einen Anbieter.",
    faqAltQ: "Was ist die beste Open-Source-Alternative zu reCAPTCHA?",
    faqAltA1:
      "Cap ist eine datenschutzfreundliche, selbst gehostete Alternative zu Google reCAPTCHA, die Proof-of-Work und Instrumentation statt Bilderrätseln oder Tracking nutzt. Vergleiche es mit ",
    faqAltSep1: ", ",
    faqAltSep2: " und ",
    faqAltA2: ", um herauszufinden, was zu deinem Stack passt.",

    // Bottom CTA
    ctaTitle: "Wirf reCAPTCHA noch heute Nachmittag raus.",
    ctaBody:
      "Widget einbauen, auf einen 5-$-VPS zeigen und aufhören, jemanden dafür zu bezahlen, den Traffic deiner Nutzer zu sehen.",
    ctaStart: "In 5 Minuten loslegen",
    ctaDemo: "Demo ausprobieren ",
    ctaGithub: "Auf GitHub sternen",

    // Footer
    ftTagline1: "Selbst gehostetes, quelloffenes CAPTCHA.",
    ftTagline2: "Kein Google. Keine Telemetrie. Keine Rätsel.",
    ftProductLabel: "Produkt",
    ftQuickstart: "Schnellstart",
    ftWidget: "Widget",
    ftDemo: "Demo",
    ftCompareLabel: "Vergleich",
    ftVsRecaptcha: "vs reCAPTCHA",
    ftVsTurnstile: "vs Turnstile",
    ftVsHcaptcha: "vs hCaptcha",
    ftAllComparisons: "Alle Vergleiche",
    ftLearnLabel: "Lernen",
    ftHowItWorks: "Funktionsweise",
    ftEffectiveness: "Wirksamkeit",
    ftCompliance: "Compliance",
    ftCommunity: "Community",
    ftLegal:
      "Keine Rechtsberatung. Die Konformität hängt von deinem Deployment ab.",
  },
  fr: {
    // Widget referral banner
    bannerRegionLabel: "Depuis le widget Cap",
    bannerVerified: "Vous venez de prouver que vous êtes humain avec Cap",
    bannerHostPrefix: " sur ",
    bannerVerifiedEnd: ".",
    bannerSub:
      "Vous pouvez fermer cet onglet. Ou rester, si vous êtes curieux de savoir ce qu'est Cap.",
    bannerDismiss: "Fermer",

    // Header nav
    navBrandLabel: "Accueil Cap",
    navDocs: "Docs",
    navFeatures: "Fonctionnalités",
    navDemo: "Démo",

    // Hero
    heroTitle: "Le CAPTCHA auto-hébergé",
    heroTitleDim: "pour le web moderne.",
    heroLead1: "Pas de Google. Pas de télémétrie. Pas de puzzles visuels.",
    heroLead2: "Quittez reCAPTCHA en quelques minutes.",
    heroCtaStart: "Démarrer en 5 minutes ",
    heroCtaPromptTitle: "Configure votre agent IA pour Cap",
    heroCtaPromptCopied: "Prompt copié !",
    heroCtaCopyPrompt: "Copier le prompt agent",
    heroDashAlt: "Capture d'écran du tableau de bord Cap",

    // Trust bar
    trustLabel: "Utilisé en production par",

    // Feature grid
    featPrivacyTitle: "Vie privée d'abord. Aucun pistage.",
    featPrivacyBody:
      "Zéro télémétrie. Aucun réseau tiers. Les données de vos utilisateurs restent entre vous et eux.",
    featSizeTitle: "250x plus léger que hCaptcha.",
    featSizeBody:
      "~20 ko, zéro dépendance. Se charge en millisecondes, pas en secondes.",
    featInvisibleTitle: "Aucun puzzle visuel. Toujours invisible.",
    featInvisibleBody:
      "La preuve de travail, les défis à verrou temporel et l'instrumentation tournent silencieusement en arrière-plan.",
    featOpenTitle: "Gratuit et open source",
    featOpenBody:
      "Sous licence Apache 2.0. Auditez-le, forkez-le, hébergez-le. Aucun éditeur ne peut vous couper l'herbe sous le pied.",
    featLawsTitle: "Pensé pour les lois sur la vie privée.",
    featLawsBody:
      "Conçu pour vous aider à respecter le RGPD, le CCPA, la LGPD et d'autres, avec des standards stricts de confidentialité et d'accessibilité intégrés.",
    featCustomTitle: "Entièrement personnalisable",
    featCustomBody:
      "Couleurs, taille, position, icônes : tout se pilote via des variables CSS. Aucun enfermement dans une iframe.",

    // Compliance
    cmplTitle: "Conforme dès l'installation.",
    cmplBody:
      "Open source, auto-hébergé et respectueux de la vie privée. Ni cookies ni pistage, et aucune donnée ne quitte vos serveurs.",
    cmplLink: "Voir comment Cap est conforme ",
    cmplPrivacyLabel: "Vie privée et données",
    cmplAccessibilityLabel: "Accessibilité",
    cmplI18nChip: "Internationalisation (i18n)",
    cmplRtlChip: "Prise en charge RTL",

    // Bundle size
    speedTitle: "Une fraction du poids",
    speedBody:
      "Le widget Cap est extrêmement léger et s'exécute de façon invisible : environ 20 ko de JavaScript, sans aucun script tiers.",
    speedNote: "Taille des bundles client (minifiés, gzip)",

    // Testimonial
    quoteLead: "Cap convient très bien à AdGuard Temp Mail. Nous l'utilisons comme ",
    quoteHl1: "couche CAPTCHA invisible et auto-hébergée",
    quoteMid1: " avec des ",
    quoteHl2: "défis de preuve de travail et d'instrumentation du navigateur",
    quoteMid2:
      ", ce qui nous aide à renforcer la protection contre les abus tout en gardant une expérience ",
    quoteHl3: "légère et discrète",
    quoteEnd: " pour les utilisateurs normaux. ",
    quoteRole: "Head of PR, AdGuard",

    // Comparison
    compareTitle: "Le comparatif",
    compareBody:
      "Cap est l'option gratuite, open source et auto-hébergée : le même niveau de détection que les grands noms, sans envoyer les données de vos utilisateurs à un tiers.",
    compareLink: "Voir le comparatif complet ",
    compareSelfTitle: "Auto-hébergé",
    compareSelfBody:
      "Tourne entièrement sur votre propre serveur. reCAPTCHA, hCaptcha et Turnstile n'existent qu'en cloud.",
    compareOpenTitle: "Open source",
    compareOpenBody:
      "Apache 2.0. Lisez-le, forkez-le, il est à vous. Les trois grands sont propriétaires.",
    comparePuzzlesTitle: "Aucun puzzle visuel",
    comparePuzzlesBody:
      "Preuve de travail invisible, plus de passages piétons à cliquer. reCAPTCHA et hCaptcha affichent toujours des puzzles.",
    compareTelemetryTitle: "Zéro télémétrie tierce",
    compareTelemetryBody:
      "Les données de vos visiteurs ne quittent jamais votre serveur. Google, Cloudflare et hCaptcha renvoient tous des données.",
    compareFreeTitle: "Gratuit à toute échelle",
    compareFreeBody:
      "Aucun quota, aucun frais par requête. reCAPTCHA et hCaptcha limitent ou facturent.",
    compareLayersTitle: "Défense en profondeur",
    compareLayersBody:
      "Preuve de travail combinée à des défis d'instrumentation JavaScript dynamiques",

    // Widget demo
    widgetDemoTitle: "Essayez de résoudre un défi Cap",

    // Two layers
    layersTitle1: "Deux couches indépendantes.",
    layersTitle2: "Contournez l'une, l'autre tient toujours.",
    layersBody:
      "Chaque défi résout une preuve de travail et exécute en même temps l'instrumentation du navigateur. Vaincre une couche ne vainc pas l'autre.",
    layersPowLabel: "Couche 01",
    layersPowTitle: "PoW et verrous temporels",
    layersPowBody:
      "Le client résout en parallèle des hachages SHA-256 et des défis à verrou temporel, en WASM et calibrés contre l'accélération GPU.",
    layersKvHashes: "hachages/s",
    layersKvTarget: "cible",
    layersJsLabel: "Couche 02",
    layersJsTitle: "Instrumentation JS",
    layersJsBody:
      "Un programme JS généré à la volée exécute des vérifications JavaScript, DOM et navigateur complexes.",

    // Stats
    statsLabel: "requêtes CDN · 12 mois",

    // Closer strip
    closerSizeLabel: "taille",
    closerSizeNote: "contre 600 ko+ pour hCaptcha",
    closerTrackersLabel: "traqueurs",
    closerTrackersNote: "contre reCAPTCHA",
    closerCostLabel: "coût",
    closerCostNote: "contre 1 000 $+ pour hCaptcha",
    closerSetupLabel: "installation",
    closerSetupNote: "un conteneur Docker",

    // FAQ
    faqGdprQ: "Est-ce compatible avec le RGPD ?",
    faqGdprA:
      "Oui. Cap ne renvoie rien vers l'extérieur, ne pose pas de cookies et ne prend pas d'empreinte des utilisateurs. Seul votre serveur voit la vérification.",
    faqMigrateQ: "Puis-je migrer depuis reCAPTCHA / hCaptcha ?",
    faqMigrateA:
      "Oui. L'API siteverify de Cap est compatible avec reCAPTCHA et hCaptcha, il vous suffit de remplacer votre code client par le widget Cap.",
    faqBotsQ: "Quelle est son efficacité face à de vrais bots ?",
    faqBotsA:
      "L'instrumentation de Cap combinée à la preuve de travail rend l'automatisation des abus à grande échelle extrêmement difficile.",
    faqCostQ: "Combien coûte l'auto-hébergement ?",
    faqCostA:
      "Cap Standalone tient sur un VPS à 5 $ pour la plupart des sites. Aucun frais par requête, aucun transfert vers un tiers et aucun quota d'API à atteindre.",
    faqOpenQ: "Qu'est-ce qu'un CAPTCHA open source ?",
    faqOpenA1:
      "Un CAPTCHA open source est une protection anti-bot dont vous pouvez lire et auditer le code, et que vous pouvez ",
    faqOpenLink: "auto-héberger",
    faqOpenA2:
      ", au lieu d'un service tiers fermé. Cap est sous licence Apache 2.0 et tourne entièrement sur votre propre infrastructure : les données des visiteurs n'atteignent jamais un éditeur.",
    faqAltQ: "Quelle est la meilleure alternative open source à reCAPTCHA ?",
    faqAltA1:
      "Cap est une alternative auto-hébergée et respectueuse de la vie privée à Google reCAPTCHA, qui utilise la preuve de travail et l'instrumentation plutôt que des puzzles visuels ou du pistage. Comparez-le à ",
    faqAltSep1: ", ",
    faqAltSep2: " et ",
    faqAltA2: " pour trouver ce qui convient à votre stack.",

    // Bottom CTA
    ctaTitle: "Abandonnez reCAPTCHA cet après-midi.",
    ctaBody:
      "Ajoutez le widget à votre site, pointez-le vers un VPS à 5 $ et arrêtez de payer qui que ce soit pour voir le trafic de vos utilisateurs.",
    ctaStart: "Démarrer en 5 minutes",
    ctaDemo: "Essayer la démo ",
    ctaGithub: "Mettre une étoile sur GitHub",

    // Footer
    ftTagline1: "Le CAPTCHA auto-hébergé et open source.",
    ftTagline2: "Pas de Google. Pas de télémétrie. Pas de puzzles.",
    ftProductLabel: "Produit",
    ftQuickstart: "Démarrage rapide",
    ftWidget: "Widget",
    ftDemo: "Démo",
    ftCompareLabel: "Comparer",
    ftVsRecaptcha: "vs reCAPTCHA",
    ftVsTurnstile: "vs Turnstile",
    ftVsHcaptcha: "vs hCaptcha",
    ftAllComparisons: "Tous les comparatifs",
    ftLearnLabel: "Comprendre",
    ftHowItWorks: "Fonctionnement",
    ftEffectiveness: "Efficacité",
    ftCompliance: "Conformité",
    ftCommunity: "Communauté",
    ftLegal:
      "Ceci n'est pas un avis juridique. La conformité dépend de votre déploiement.",
  },
  th: {
    // Widget referral banner
    bannerRegionLabel: "จากวิดเจ็ต Cap",
    bannerVerified: "คุณเพิ่งยืนยันว่าเป็นมนุษย์ด้วย Cap",
    bannerHostPrefix: " บน ",
    bannerVerifiedEnd: "",
    bannerSub:
      "คุณปิดแท็บนี้ได้เลย หรือจะอยู่ต่อถ้าอยากรู้ว่า Cap คืออะไร",
    bannerDismiss: "ปิด",

    // Header nav
    navBrandLabel: "หน้าแรก Cap",
    navDocs: "เอกสาร",
    navFeatures: "ฟีเจอร์",
    navDemo: "เดโม",

    // Hero
    heroTitle: "CAPTCHA แบบโฮสต์เอง",
    heroTitleDim: "สำหรับเว็บยุคใหม่",
    heroLead1: "ไม่มี Google ไม่มีเทเลเมทรี ไม่มีปริศนาภาพ",
    heroLead2: "ย้ายจาก reCAPTCHA ได้ในไม่กี่นาที",
    heroCtaStart: "เริ่มใช้ใน 5 นาที ",
    heroCtaPromptTitle: "ตั้งค่า AI agent ของคุณให้ใช้ Cap",
    heroCtaPromptCopied: "คัดลอกพรอมต์แล้ว!",
    heroCtaCopyPrompt: "คัดลอกพรอมต์สำหรับ agent",
    heroDashAlt: "ภาพหน้าจอแดชบอร์ดผู้ดูแลระบบ Cap",

    // Trust bar
    trustLabel: "ใช้งานจริงบนโปรดักชันโดย",

    // Feature grid
    featPrivacyTitle: "ให้ความสำคัญกับความเป็นส่วนตัว ไม่มีการติดตาม",
    featPrivacyBody:
      "ไม่มีเทเลเมทรี ไม่เชื่อมต่อเครือข่ายบุคคลที่สาม ข้อมูลผู้ใช้อยู่ระหว่างคุณกับผู้ใช้เท่านั้น",
    featSizeTitle: "เล็กกว่า hCaptcha 250 เท่า",
    featSizeBody:
      "ประมาณ 20kb ไม่มี dependency โหลดเสร็จในหลักมิลลิวินาที ไม่ใช่หลักวินาที",
    featInvisibleTitle: "ไม่มีปริศนาภาพ ทำงานแบบล่องหนเสมอ",
    featInvisibleBody:
      "PoW, time-lock challenge และ instrumentation ทำงานเงียบ ๆ อยู่เบื้องหลัง",
    featOpenTitle: "ฟรีและโอเพนซอร์ส",
    featOpenBody:
      "ใช้สัญญาอนุญาต Apache 2.0 ตรวจสอบโค้ดได้ fork ได้ โฮสต์เองได้ ไม่มีผู้ให้บริการรายไหนดึงพรมออกจากใต้เท้าคุณได้",
    featLawsTitle: "ออกแบบมาเพื่อกฎหมายความเป็นส่วนตัว",
    featLawsBody:
      "ช่วยให้คุณปฏิบัติตาม GDPR, CCPA, LGPD และอื่น ๆ พร้อมมาตรฐานความเป็นส่วนตัวและการเข้าถึงที่เข้มงวดตั้งแต่ต้น",
    featCustomTitle: "ปรับแต่งได้เต็มที่",
    featCustomBody:
      "สี ขนาด ตำแหน่ง ไอคอน ควบคุมได้ทั้งหมดผ่านตัวแปร CSS ไม่ถูกล็อกอยู่ใน iframe",

    // Compliance
    cmplTitle: "สอดคล้องกับข้อกำหนดตั้งแต่แกะกล่อง",
    cmplBody:
      "โอเพนซอร์ส โฮสต์เอง และให้ความสำคัญกับความเป็นส่วนตัว ไม่ใช้คุกกี้ ไม่ติดตาม และไม่มีข้อมูลออกจากเซิร์ฟเวอร์ของคุณ",
    cmplLink: "ดูว่า Cap สอดคล้องอย่างไร ",
    cmplPrivacyLabel: "ความเป็นส่วนตัวและข้อมูล",
    cmplAccessibilityLabel: "การเข้าถึง",
    cmplI18nChip: "การรองรับหลายภาษา (i18n)",
    cmplRtlChip: "รองรับ RTL",

    // Bundle size
    speedTitle: "น้ำหนักเพียงเศษเสี้ยว",
    speedBody:
      "วิดเจ็ต Cap เบามากและทำงานแบบล่องหน ส่ง JavaScript เพียงราว 20 kB โดยไม่มีสคริปต์จากบุคคลที่สาม",
    speedNote: "ขนาดบันเดิลฝั่งไคลเอนต์ (minified gzip)",

    // Testimonial
    quoteLead: "Cap เข้ากับ AdGuard Temp Mail ได้ดี เราใช้มันเป็น",
    quoteHl1: "ชั้น CAPTCHA แบบล่องหนที่โฮสต์เอง",
    quoteMid1: " ร่วมกับ",
    quoteHl2: "challenge แบบ proof-of-work และ browser instrumentation",
    quoteMid2:
      " ซึ่งช่วยให้เราเพิ่มการป้องกันการใช้งานในทางที่ผิด ขณะที่ยังคงประสบการณ์ที่",
    quoteHl3: "เบาและไม่รบกวน",
    quoteEnd: "สำหรับผู้ใช้ทั่วไป",
    quoteRole: "Head of PR, AdGuard",

    // Comparison
    compareTitle: "เทียบกับเจ้าอื่น",
    compareBody:
      "Cap คือตัวเลือกที่ฟรี โอเพนซอร์ส และโฮสต์เองได้ ระดับการตรวจจับเทียบเท่าเจ้าใหญ่ โดยไม่ต้องส่งข้อมูลผู้ใช้ให้บุคคลที่สาม",
    compareLink: "ดูการเปรียบเทียบทั้งหมด ",
    compareSelfTitle: "โฮสต์เอง",
    compareSelfBody:
      "ทำงานบนเซิร์ฟเวอร์ของคุณทั้งหมด ส่วน reCAPTCHA, hCaptcha และ Turnstile มีแต่บนคลาวด์",
    compareOpenTitle: "โอเพนซอร์ส",
    compareOpenBody:
      "Apache 2.0 อ่านโค้ดได้ fork ได้ เป็นของคุณเอง ขณะที่สามเจ้าใหญ่ปิดซอร์สทั้งหมด",
    comparePuzzlesTitle: "ไม่มีปริศนาภาพ",
    comparePuzzlesBody:
      "proof-of-work แบบล่องหน ไม่ต้องกดเลือกทางม้าลาย ส่วน reCAPTCHA และ hCaptcha ยังแสดงปริศนาอยู่",
    compareTelemetryTitle: "ไม่มีเทเลเมทรีจากบุคคลที่สาม",
    compareTelemetryBody:
      "ข้อมูลผู้เข้าชมไม่เคยออกจากเซิร์ฟเวอร์ของคุณ ขณะที่ Google, Cloudflare และ hCaptcha ล้วนส่งข้อมูลกลับ",
    compareFreeTitle: "ฟรีไม่ว่าจะสเกลแค่ไหน",
    compareFreeBody:
      "ไม่มีโควตา ไม่มีค่าธรรมเนียมต่อคำขอ ส่วน reCAPTCHA และ hCaptcha จำกัดปริมาณหรือคิดเงิน",
    compareLayersTitle: "ป้องกันหลายชั้น",
    compareLayersBody:
      "proof-of-work ซ้อนกับ challenge แบบ JavaScript instrumentation ที่สร้างขึ้นใหม่ทุกครั้ง",

    // Widget demo
    widgetDemoTitle: "ลองแก้ challenge ของ Cap ดู",

    // Two layers
    layersTitle1: "สองชั้นที่เป็นอิสระต่อกัน",
    layersTitle2: "ผ่านชั้นหนึ่งไปได้ อีกชั้นก็ยังอยู่",
    layersBody:
      "ทุก challenge จะแก้ proof-of-work และรัน browser instrumentation ไปพร้อมกัน การเจาะชั้นหนึ่งได้ไม่ได้แปลว่าเจาะอีกชั้นได้",
    layersPowLabel: "ชั้นที่ 01",
    layersPowTitle: "PoW และ time-lock",
    layersPowBody:
      "ไคลเอนต์แก้แฮช SHA-256 แบบขนานและ time-lock challenge ใน WASM ซึ่งปรับมาเพื่อรับมือกับการเร่งความเร็วด้วย GPU",
    layersKvHashes: "แฮช/วินาที",
    layersKvTarget: "เป้าหมาย",
    layersJsLabel: "ชั้นที่ 02",
    layersJsTitle: "JS instrumentation",
    layersJsBody:
      "โปรแกรม JS ที่สร้างขึ้นใหม่ทุกครั้งจะรันการตรวจสอบ JavaScript, DOM และเบราว์เซอร์ที่ซับซ้อน",

    // Stats
    statsLabel: "คำขอ CDN · 12 เดือน",

    // Closer strip
    closerSizeLabel: "ขนาด",
    closerSizeNote: "เทียบกับ hCaptcha 600 kb+",
    closerTrackersLabel: "ตัวติดตาม",
    closerTrackersNote: "เทียบกับ reCAPTCHA",
    closerCostLabel: "ค่าใช้จ่าย",
    closerCostNote: "เทียบกับ hCaptcha $1k+",
    closerSetupLabel: "การติดตั้ง",
    closerSetupNote: "คอนเทนเนอร์ Docker",

    // FAQ
    faqGdprQ: "รองรับ GDPR หรือไม่?",
    faqGdprA:
      "รองรับ Cap ไม่ส่งข้อมูลกลับ ไม่ตั้งคุกกี้ และไม่เก็บลายนิ้วมือผู้ใช้ มีแค่เซิร์ฟเวอร์ของคุณที่เห็นผลการยืนยัน ไม่มีใครอื่นเห็น",
    faqMigrateQ: "ย้ายจาก reCAPTCHA / hCaptcha ได้ไหม?",
    faqMigrateA:
      "ได้ API siteverify ของ Cap เข้ากันได้กับ reCAPTCHA และ hCaptcha เพียงเปลี่ยนโค้ดฝั่งไคลเอนต์มาใช้วิดเจ็ตของ Cap",
    faqBotsQ: "ได้ผลแค่ไหนกับบอทจริง ๆ?",
    faqBotsA:
      "instrumentation ของ Cap เมื่อรวมกับ proof-of-work ทำให้การใช้งานในทางที่ผิดแบบอัตโนมัติในสเกลใหญ่ทำได้ยากมาก",
    faqCostQ: "โฮสต์เองมีค่าใช้จ่ายเท่าไร?",
    faqCostA:
      "สำหรับเว็บส่วนใหญ่ Cap Standalone รันบน VPS ราคา $5 ได้สบาย ไม่มีค่าธรรมเนียมต่อคำขอ ไม่มีทราฟฟิกออกไปหาบุคคลที่สาม และไม่มีโควตา API ให้ชน",
    faqOpenQ: "CAPTCHA แบบโอเพนซอร์สคืออะไร?",
    faqOpenA1:
      "CAPTCHA แบบโอเพนซอร์สคือระบบป้องกันบอทที่คุณอ่านโค้ด ตรวจสอบ และ",
    faqOpenLink: "โฮสต์เอง",
    faqOpenA2:
      "ได้ แทนที่จะเป็นบริการปิดจากบุคคลที่สาม Cap ใช้สัญญาอนุญาต Apache 2.0 และรันบนโครงสร้างพื้นฐานของคุณทั้งหมด ข้อมูลผู้เข้าชมจึงไม่ถูกส่งไปถึงผู้ให้บริการรายใด",
    faqAltQ: "ทางเลือกโอเพนซอร์สที่ดีที่สุดแทน reCAPTCHA คืออะไร?",
    faqAltA1:
      "Cap เป็นทางเลือกแทน Google reCAPTCHA ที่โฮสต์เองได้และให้ความสำคัญกับความเป็นส่วนตัว โดยใช้ proof-of-work และ instrumentation แทนปริศนาภาพหรือการติดตาม ลองเทียบกับ ",
    faqAltSep1: ", ",
    faqAltSep2: " และ ",
    faqAltA2: " เพื่อดูว่าตัวไหนเหมาะกับสแตกของคุณ",

    // Bottom CTA
    ctaTitle: "เลิกใช้ reCAPTCHA ได้ตั้งแต่บ่ายนี้",
    ctaBody:
      "วางวิดเจ็ตลงในเว็บของคุณ ชี้ไปที่ VPS ราคา $5 แล้วเลิกจ่ายเงินให้ใครก็ตามเพื่อแลกกับการให้เขาเห็นทราฟฟิกของผู้ใช้คุณ",
    ctaStart: "เริ่มใช้ใน 5 นาที",
    ctaDemo: "ลองเดโม ",
    ctaGithub: "ให้ดาวบน GitHub",

    // Footer
    ftTagline1: "CAPTCHA แบบโฮสต์เองและโอเพนซอร์ส",
    ftTagline2: "ไม่มี Google ไม่มีเทเลเมทรี ไม่มีปริศนา",
    ftProductLabel: "ผลิตภัณฑ์",
    ftQuickstart: "เริ่มต้นใช้งาน",
    ftWidget: "วิดเจ็ต",
    ftDemo: "เดโม",
    ftCompareLabel: "เปรียบเทียบ",
    ftVsRecaptcha: "vs reCAPTCHA",
    ftVsTurnstile: "vs Turnstile",
    ftVsHcaptcha: "vs hCaptcha",
    ftAllComparisons: "การเปรียบเทียบทั้งหมด",
    ftLearnLabel: "ทำความเข้าใจ",
    ftHowItWorks: "หลักการทำงาน",
    ftEffectiveness: "ประสิทธิภาพ",
    ftCompliance: "การปฏิบัติตามข้อกำหนด",
    ftCommunity: "ชุมชน",
    ftLegal:
      "ข้อมูลนี้ไม่ใช่คำแนะนำทางกฎหมาย การปฏิบัติตามข้อกำหนดขึ้นอยู่กับการติดตั้งใช้งานของคุณ",
  },
};
