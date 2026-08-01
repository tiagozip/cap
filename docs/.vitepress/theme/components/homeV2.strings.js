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
};
