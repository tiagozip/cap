import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";
import { homeV2Strings } from "./theme/components/homeV2.strings.js";

const GITHUB_STARS = 6632;

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
  [s.faqGdprQ, s.faqGdprA.trim()],
  [s.faqMigrateQ, s.faqMigrateA.trim()],
  [s.faqBotsQ, s.faqBotsA.trim()],
  [s.faqCostQ, s.faqCostA.trim()],
  [s.faqOpenQ, `${s.faqOpenA1}${s.faqOpenLink}${s.faqOpenA2}`.trim()],
  [
    s.faqAltQ,
    `${s.faqAltA1}reCAPTCHA${s.faqAltSep1}hCaptcha${s.faqAltSep2}Turnstile${s.faqAltA2}`.trim(),
  ],
];

const FAQ_ITEMS = faqItemsFromStrings(homeV2Strings.en);

const FAQ_PAGE = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(([name, text]) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  })),
};

const ZH_FAQ_ITEMS = faqItemsFromStrings(homeV2Strings.zh);

const ZH_FAQ_PAGE = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "zh-CN",
  mainEntity: ZH_FAQ_ITEMS.map(([name, text]) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  })),
};

const ZH_SOFTWARE_APPLICATION = {
  ...SOFTWARE_APPLICATION,
  inLanguage: "zh-CN",
  description:
    "Cap 是一个免费、开源的 CAPTCHA 替代方案。可自托管、隐私优先、无 Google。基于工作量证明与 instrumentation，无视觉谜题。Apache 2.0 许可。",
};

const COMPARE_SIDEBAR = [
  {
    text: "Compare Cap",
    items: [
      { text: "← Back to docs", link: "/guide/" },
      { text: "Feature comparison", link: "/guide/alternatives.md" },
      { text: "Migrate from reCAPTCHA", link: "/guide/alternatives/migrate-from-recaptcha.md" },
    ],
  },
  {
    text: "vs",
    items: [
      { text: "reCAPTCHA", link: "/guide/alternatives/recaptcha.md" },
      { text: "Turnstile", link: "/guide/alternatives/turnstile.md" },
      { text: "hCaptcha", link: "/guide/alternatives/hcaptcha.md" },
      { text: "Altcha", link: "/guide/alternatives/altcha.md" },
      { text: "FriendlyCaptcha", link: "/guide/alternatives/friendlycaptcha.md" },
      { text: "SilentShield", link: "/guide/alternatives/silentshield.md" },
      { text: "Anubis", link: "/guide/alternatives/anubis.md" },
    ],
  },
  {
    text: "Guides",
    items: [
      { text: "Best CAPTCHA alternatives", link: "/guide/best-captcha-alternatives.md" },
      { text: "CAPTCHA & conversion rate", link: "/guide/captcha-conversion-rate.md" },
      { text: "Open-source CAPTCHA", link: "/guide/open-source-captcha.md" },
      { text: "Mobile form bot protection", link: "/guide/mobile-form-bot-protection.md" },
    ],
  },
];

const ZH_COMPARE_SIDEBAR = [
  {
    text: "对比 Cap",
    items: [
      { text: "← 返回文档", link: "/zh/guide/" },
      { text: "功能对比", link: "/zh/guide/alternatives.md" },
      { text: "从 reCAPTCHA 迁移", link: "/zh/guide/alternatives/migrate-from-recaptcha.md" },
    ],
  },
  {
    text: "vs",
    items: [
      { text: "reCAPTCHA", link: "/zh/guide/alternatives/recaptcha.md" },
      { text: "Turnstile", link: "/zh/guide/alternatives/turnstile.md" },
      { text: "hCaptcha", link: "/zh/guide/alternatives/hcaptcha.md" },
      { text: "Altcha", link: "/zh/guide/alternatives/altcha.md" },
      { text: "FriendlyCaptcha", link: "/zh/guide/alternatives/friendlycaptcha.md" },
      { text: "SilentShield", link: "/zh/guide/alternatives/silentshield.md" },
      { text: "Anubis", link: "/zh/guide/alternatives/anubis.md" },
    ],
  },
  {
    text: "指南",
    items: [
      { text: "最佳 CAPTCHA 替代方案", link: "/zh/guide/best-captcha-alternatives.md" },
      { text: "CAPTCHA 与转化率", link: "/zh/guide/captcha-conversion-rate.md" },
      { text: "开源 CAPTCHA", link: "/zh/guide/open-source-captcha.md" },
      { text: "移动端表单机器人防护", link: "/zh/guide/mobile-form-bot-protection.md" },
    ],
  },
];

const ZH_SIDEBAR = [
  { text: "快速开始", link: "/zh/guide/index.md" },
  { text: "功能对比", link: "/zh/guide/alternatives.md" },
  {
    text: "Standalone",
    collapsed: false,
    items: [
      { text: "快速开始", link: "/zh/guide/standalone/index.md" },
      { text: "API", link: "/zh/guide/standalone/api.md" },
      { text: "配置选项", link: "/zh/guide/standalone/options.md" },
    ],
  },
  {
    text: "验证组件",
    collapsed: false,
    items: [
      { text: "使用方法", link: "/zh/guide/widget.md" },
      { text: "编程模式", link: "/zh/guide/programmatic.md" },
      { text: "浮动模式", link: "/zh/guide/floating.md" },
    ],
  },
  {
    text: "库",
    collapsed: true,
    items: [
      { text: "核心库", link: "/zh/guide/capjs-core.md" },
      { text: "社区库", link: "/zh/guide/community.md" },
    ],
  },
  {
    text: "深入了解",
    collapsed: true,
    items: [
      { text: "有效性", link: "/zh/guide/effectiveness.md" },
      { text: "Instrumentation", link: "/zh/guide/instrumentation.md" },
      { text: "RSW 时间锁谜题", link: "/zh/guide/rsw.md" },
      { text: "Cap 是如何工作的？", link: "/zh/guide/workings.md" },
    ],
  },
  { text: "性能基准", link: "/zh/guide/benchmark.md" },
  { text: "合规", link: "/zh/guide/compliance.md" },
  { text: "演示", link: "/zh/guide/demo.md" },
  { text: "GitHub", link: "https://github.com/tiagozip/cap" },
];

const humanize = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ZH_SEG_NAMES = {
  alternatives: "对比",
  middleware: "中间件",
  standalone: "Standalone",
  troubleshooting: "故障排查",
};

function breadcrumbList(pageData) {
  const isZh = pageData.relativePath.startsWith("zh/");
  const rel = pageData.relativePath.replace(/^zh\//, "");
  const segs = rel
    .replace(/index\.md$/, "")
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean);
  if (segs[0] !== "guide") return null;
  const prefix = isZh ? "/zh" : "";
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: isZh ? "首页" : "Home",
      item: `https://trycap.dev${prefix}/`,
    },
  ];
  let acc = `https://trycap.dev${prefix}`;
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === segs.length - 1;
    const name =
      seg === "guide"
        ? isZh
          ? "文档"
          : "Docs"
        : isLast
          ? pageData.title
          : isZh
            ? (ZH_SEG_NAMES[seg] ?? humanize(seg))
            : humanize(seg);
    const item = isLast
      ? acc + (rel.endsWith("index.md") ? "/" : ".html")
      : seg === "guide"
        ? `${acc}/`
        : `${acc}.html`;
    items.push({ "@type": "ListItem", position: i + 2, name, item });
  });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

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
    root: {
      label: "English",
      lang: "en-US",
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      title: "Cap – 开源、可自托管的 reCAPTCHA 替代方案",
      titleTemplate: ":title – Cap 人机验证",
      description:
        "Cap 是一个轻量、现代的开源 CAPTCHA 替代方案，基于工作量证明、时间锁与 instrumentation 质询",
      themeConfig: {
        nav: [
          { text: "首页", link: "/zh/" },
          { text: "文档", link: "/zh/guide/" },
          { text: "GitHub", link: "https://github.com/tiagozip/cap" },
        ],
        sidebar: {
          "/zh/guide/best-captcha-alternatives": ZH_COMPARE_SIDEBAR,
          "/zh/guide/captcha-conversion-rate": ZH_COMPARE_SIDEBAR,
          "/zh/guide/open-source-captcha": ZH_COMPARE_SIDEBAR,
          "/zh/guide/mobile-form-bot-protection": ZH_COMPARE_SIDEBAR,
          "/zh/guide/alternatives/": ZH_COMPARE_SIDEBAR,
          "/zh/": ZH_SIDEBAR,
        },
        editLink: {
          pattern: "https://github.com/tiagozip/cap/edit/main/docs/:path",
          text: "在 GitHub 上编辑此页",
        },
        outline: { label: "本页目录" },
        docFooter: { prev: "上一页", next: "下一页" },
        lastUpdated: { text: "最后更新于" },
        returnToTopLabel: "返回顶部",
        sidebarMenuLabel: "菜单",
        darkModeSwitchLabel: "外观",
        langMenuLabel: "切换语言",
        footer: {
          message: "基于 Apache 2.0 许可发布",
          copyright: "<a href='https://tiago.zip' target='_blank'>made by tiago.zip</a>",
        },
      },
    },
  },
  vite: {
    plugins: [llmstxt({ ignoreFiles: ["zh/**"] })],
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
    const baseRel = pageData.relativePath.replace(/^zh\//, "");
    head.push(
      ["link", { rel: "alternate", hreflang: "en", href: toUrl(baseRel) }],
      ["link", { rel: "alternate", hreflang: "zh-CN", href: toUrl(`zh/${baseRel}`) }],
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
    if (pageData.relativePath === "index.md") {
      head.push(jsonLd(SOFTWARE_APPLICATION), jsonLd(ORGANIZATION), jsonLd(FAQ_PAGE));
    } else if (pageData.relativePath === "zh/index.md") {
      head.push(jsonLd(ZH_SOFTWARE_APPLICATION), jsonLd(ORGANIZATION), jsonLd(ZH_FAQ_PAGE));
    } else if (pageData.relativePath.replace(/^zh\//, "") === "about.md") {
      const isZh = pageData.relativePath.startsWith("zh/");
      const aboutUrl = `https://trycap.dev/${isZh ? "zh/" : ""}about.html`;
      head.push(
        jsonLd(ORGANIZATION),
        jsonLd({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "@id": aboutUrl,
          name: isZh ? "关于 Cap" : "About Cap",
          url: aboutUrl,
          description,
          ...(isZh && { inLanguage: "zh-CN" }),
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
      `(function(){try{if(location.pathname==='/'||location.pathname==='/index.html'||location.pathname==='/zh/'||location.pathname==='/zh/index.html'){document.documentElement.classList.add('home-v2-active');}}catch(e){}})();`
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
        src: "https://cdn.jsdelivr.net/npm/cap-widget@0.1.50",
        async: true,
      },
    ],
  ],
  themeConfig: {
    search: {
      provider: "algolia",
      options: {
        appId: "B8THEYC8QW",
        apiKey: "ebdc4d8bd68e388cbeca09c14b982a85",
        indexName: "cap-tiagorangel",
        // Note: no per-locale `searchParameters.facetFilters` needed here.
        // VitePress's VPAlgoliaSearchBox strips any user-provided `lang:*`
        // facet filter and always injects `lang:<current locale lang>` itself,
        // so English pages query with lang:en-US and zh pages with lang:zh-CN
        // automatically (requires `lang` to be a facet attribute on the index).
        locales: {
          zh: {
            placeholder: "搜索文档",
            translations: {
              button: { buttonText: "搜索", buttonAriaLabel: "搜索" },
              modal: {
                searchBox: {
                  cancelButtonText: "取消",
                  resetButtonTitle: "清除查询",
                },
                noResultsScreen: { noResultsText: "没有找到相关结果" },
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                  closeText: "关闭",
                  searchByText: "搜索服务由",
                },
              },
            },
          },
        },
      },
    },
    logo: "/logo.png",
    siteTitle: "Cap",

    editLink: {
      pattern: "https://github.com/tiagozip/cap/edit/main/docs/:path",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Docs", link: "/guide" },
      { text: "GitHub", link: "https://github.com/tiagozip/cap" },
    ],

    sidebar: {
      "/guide/best-captcha-alternatives": COMPARE_SIDEBAR,
      "/guide/captcha-conversion-rate": COMPARE_SIDEBAR,
      "/guide/open-source-captcha": COMPARE_SIDEBAR,
      "/guide/mobile-form-bot-protection": COMPARE_SIDEBAR,
      "/guide/alternatives/": COMPARE_SIDEBAR,
      "/": [
        { text: "Quickstart", link: "/guide/index.md" },
        { text: "Feature comparison", link: "/guide/alternatives.md" },
        {
          text: "Standalone",
          collapsed: false,
          items: [
            { text: "Quickstart", link: "/guide/standalone/index.md" },
            { text: "API", link: "/guide/standalone/api.md" },
            { text: "Options", link: "/guide/standalone/options.md" },
          ],
        },
        {
          text: "Widget",
          collapsed: false,
          items: [
            { text: "Usage", link: "/guide/widget.md" },
            { text: "Programmatic mode", link: "/guide/programmatic.md" },
            { text: "Floating mode", link: "/guide/floating.md" },
          ],
        },
        {
          text: "Libraries",
          collapsed: true,
          items: [
            { text: "Core", link: "/guide/capjs-core.md" },
            { text: "Community libraries", link: "/guide/community.md" },
          ],
        },
        {
          text: "Details",
          collapsed: true,
          items: [
            { text: "Effectiveness", link: "/guide/effectiveness.md" },
            { text: "Instrumentation", link: "/guide/instrumentation.md" },
            { text: "RSW time-lock puzzles", link: "/guide/rsw.md" },
            { text: "How does Cap work?", link: "/guide/workings.md" },
          ],
        },
        { text: "Benchmark", link: "/guide/benchmark.md" },
        { text: "Compliance", link: "/guide/compliance.md" },
        { text: "Demo", link: "/guide/demo.md" },
        { text: "GitHub", link: "https://github.com/tiagozip/cap" },
      ],
    },

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
        "guide/standalone/usage.html",
        "guide/standalone/installation.html",
      ];
      return items.filter(
        (item) =>
          !item.url.includes("/public/") &&
          !excluded.some((path) => item.url.endsWith(path)),
      );
    },
  },
});
