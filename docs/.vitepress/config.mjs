import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";
// import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default withMermaid({
  lang: "en-US",
  title: "Cap — Modern, lightning-quick PoW captcha",
  description:
    "Cap is a lightweight, modern open-source CAPTCHA alternative using SHA-256 proof-of-work",
  lastUpdated: true,
  vite: {
    plugins: [llmstxt()],
  },
  transformPageData(pageData) {
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      "link",
      {
        rel: "canonical",
        href: `https://capjs.js.org/${pageData.relativePath}`
          .replace(/index\.md$/, "")
          .replace(/\.md$/, ".html"),
      },
    ]);
  },
  head: [
    ["link", { rel: "icon", href: "/logo.png" }],
    [
      "meta",
      {
        name: "keywords",
        content:
          "proof-of-work, computational challenge, cryptographic puzzle, challenge-response protocol, human verification, anti-bot, anti-abuse, automated attacks, bot detection, bot mitigation, api protection, account security, form security, spam prevention, ddos protection, malicious traffic, web application security, security library, challenge generator, captcha, hcaptcha, turnstile",
      },
    ],
    ["meta", { name: "author", content: "tiagozip" }],
    [
      "meta",
      {
        property: "og:title",
        content: "Cap is the self-hosted CAPTCHA for the modern web.",
      },
    ],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Lightweight, privacy-first, and designed to put you first. Switch from reCAPTCHA in minutes.",
      },
    ],
    ["meta", { property: "og:url", content: "https://capjs.js.org" }],
    ["meta", { property: "og:image", content: "https://capjs.js.org/logo.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:title",
        content: "Cap is the self-hosted CAPTCHA for the modern web.",
      },
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Lightweight, privacy-first, and designed to put you first. Switch from reCAPTCHA in minutes.",
      },
    ],
    ["meta", { name: "twitter:image", content: "https://capjs.js.org/logo.png" }],
    [
      "meta",
      {
        name: "google-site-verification",
        content: "_qNXNJhgoxAeT8hv5PctRvPqfwRKOGo-TtjAhFewmYw",
      },
    ],
    [
      "script",
      {
        defer: true,
        "data-domain": "capjs.js.org",
        src: "https://a.tiago.zip/js/script.hash.outbound-links.pageview-props.tagged-events.js",
      },
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
        type: "application/ld+json",
      },
      `{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Cap",
  "url": "https://capjs.js.org",
  "description": "Lightweight, privacy-first, and designed to put you first. Switch from reCAPTCHA in minutes.",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "All",
  "image": "https://capjs.js.org/logo.png",
  "author": {
    "@type": "Person",
    "name": "tiago",
    "url": "https://tiago.zip"
  },
  "license": "https://github.com/tiagozip/cap/blob/main/LICENSE",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}`,
    ],
    [
      "script",
      {
        src: "https://cdn.jsdelivr.net/npm/@cap.js/widget@0.1.39",
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

    sidebar: [
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
          { text: "Invisible mode", link: "/guide/invisible.md" },
          { text: "Floating mode", link: "/guide/floating.md" },
        ],
      },
      {
        text: "Libraries",
        collapsed: true,
        items: [
          { text: "Server", link: "/guide/server.md" },
          { text: "M2M", link: "/guide/solver.md" },
          { text: "Community libraries", link: "/guide/community.md" },
        ],
      },
      {
        text: "Proof-of-work",
        collapsed: true,
        items: [
          { text: "Effectiveness", link: "/guide/effectiveness.md" },
          { text: "How does it work", link: "/guide/workings.md" },
        ],
      },
      { text: "Benchmark", link: "/guide/benchmark.md" },
      { text: "Demo", link: "/guide/demo.md" },
      { text: "GitHub", link: "https://github.com/tiagozip/cap" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/tiagozip/cap" },
      { icon: "twitter", link: "https://x.com/0xtiago_" },
    ],

    footer: {
      message: "Built in Europe 🇪🇺<br>Released under the Apache 2.0 License.",
      copyright: "Copyright © 2025-present <a href='https://tiago.zip' target='_blank'>Tiago</a>",
    },
  },
  markdown: {
    image: {
      lazyLoading: true,
    },
  },
  sitemap: {
    hostname: "https://capjs.js.org",
  },
});
