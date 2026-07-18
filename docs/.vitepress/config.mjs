import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";
// import { defineConfig } from "vitepress";

const GITHUB_STARS = 6632;

const jsonLd = (obj) => ["script", { type: "application/ld+json" }, JSON.stringify(obj)];

const SOFTWARE_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
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
  name: "Cap",
  url: "https://trycap.dev",
  logo: "https://trycap.dev/logo.png",
  sameAs: ["https://github.com/tiagozip/cap", "https://x.com/tiagozip_"],
};

const FAQ_ITEMS = [
  [
    "Is it GDPR-friendly?",
    "Yes. Cap doesn't phone home, doesn't set cookies, and doesn't fingerprint users. Your server sees the verification, no one else does.",
  ],
  [
    "Can I migrate from reCAPTCHA / hCaptcha?",
    "Yes. Cap's siteverify API is compatible with reCAPTCHA and hCaptcha, but you'll need to swap your client-side code to use Cap's widget.",
  ],
  [
    "How effective is it against real bots?",
    "Cap's instrumentation combined with proof-of-work is very effective at making abuse extremely difficult to automate at scale.",
  ],
  [
    "What does it cost to self-host?",
    "Cap Standalone fits on a $5 VPS for most sites. There are no per-request fees, no egress to a third party, and no API quotas to hit.",
  ],
  [
    "What is an open-source CAPTCHA?",
    "An open-source CAPTCHA is bot protection whose code you can read, audit, and self-host, rather than a closed third-party service. Cap is licensed under Apache 2.0 and runs entirely on your own infrastructure, so visitor data never reaches a vendor.",
  ],
  [
    "What is the best open-source alternative to reCAPTCHA?",
    "Cap is a privacy-first, self-hosted alternative to Google reCAPTCHA that uses proof-of-work and instrumentation instead of visual puzzles or tracking. Compare it against reCAPTCHA, hCaptcha, and Turnstile to find what fits your stack.",
  ]
];

const FAQ_PAGE = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(([name, text]) => ({
    "@type": "Question",
    name,
    acceptedAnswer: { "@type": "Answer", text },
  })),
};

const humanize = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function breadcrumbList(pageData) {
  const rel = pageData.relativePath;
  const segs = rel
    .replace(/index\.md$/, "")
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean);
  if (segs[0] !== "guide") return null;
  const items = [{ "@type": "ListItem", position: 1, name: "Home", item: "https://trycap.dev/" }];
  let acc = "https://trycap.dev";
  segs.forEach((seg, i) => {
    acc += `/${seg}`;
    const isLast = i === segs.length - 1;
    const name = seg === "guide" ? "Docs" : isLast ? pageData.title : humanize(seg);
    const item = isLast ? acc + (rel.endsWith("index.md") ? "/" : ".html") : `${acc}/`;
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
  vite: {
    plugins: [llmstxt()],
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
    if (pageData.relativePath === "index.md") {
      head.push(jsonLd(SOFTWARE_APPLICATION), jsonLd(ORGANIZATION), jsonLd(FAQ_PAGE));
    } else {
      const bc = breadcrumbList(pageData);
      if (bc) head.push(jsonLd(bc));
    }
    return head;
  },
  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
    ["link", { rel: "preconnect", href: "https://cdn.jsdelivr.net" }],
    ["link", { rel: "preconnect", href: "https://a.tiago.zip" }],
    ["link", { rel: "preconnect", href: "https://fullres-script-proxy.tiag.workers.dev" }],
    ["link", { rel: "preconnect", href: "https://media.ethicalads.io" }],
    ["link", { rel: "dns-prefetch", href: "https://cdn.jsdelivr.net" }],
    ["link", { rel: "dns-prefetch", href: "https://a.tiago.zip" }],
    ["link", { rel: "dns-prefetch", href: "https://fullres-script-proxy.tiag.workers.dev" }],
    ["link", { rel: "dns-prefetch", href: "https://media.ethicalads.io" }],
    ["link", { rel: "dns-prefetch", href: "https://server.ethicalads.io" }],
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
      `(function(){try{if(location.pathname==='/'||location.pathname==='/index.html'){document.documentElement.classList.add('home-v2-active');}}catch(e){}})();`
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
    [
      "script",
      {
        async: true,
        src: "https://media.ethicalads.io/media/client/ethicalads.min.js",
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
      "/guide/alternatives/": [
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
            { text: "Anubis", link: "/guide/alternatives/anubis.md" },
          ],
        },
      ],
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
