import { withMermaid } from "vitepress-plugin-mermaid";
import llmstxt from "vitepress-plugin-llms";
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
          "account security, abuse detection, abuse prevention, api abuse, api defense, api analytics, api protection, api security, anti-abuse, anti-automation, anti-bot, anti-ddos, anti-dos, anti-exploitation, anti-spam, application security, automated attacks, automated scraping, bot defense, bot detection, bot management, bot mitigation, bot prevention, bot traffic, brute force, challenge generator, challenge string, challenge verifier, challenge-response, challenge-response protocol, client-server architecture, computational challenge, computational complexity, computational defense, computational puzzle, crypto puzzle, cryptographic algorithm, cryptographic challenge, cryptographic defense, cryptographic puzzle, cybersecurity, ddos, ddos protection, defense mechanism, digital security, form security, fraud detection, fraud prevention, hash function, hash puzzle, hashcash, hcaptcha, captcha alternative, human test, human verification, internet security, invisible captcha, login security, malicious traffic, pow, proof of work, proof-of-work, recaptcha, security challenge, security component, security library, server defense, spam bots, spam filtering, spam mitigation, spam prevention, target difficulty, threat intelligence, traffic management, traffic monitoring, turing test, unwanted traffic, user experience, web application protection, web application security, web defense, web defense system, website defense, website protection, website security",
      },
    ],
    ["meta", { name: "author", content: "Tiago Rangel" }],
    [
      "meta",
      {
        property: "og:title",
        content: "Cap — Modern, Open-source PoW CAPTCHA for JavaScript",
      },
    ],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Cap.js is a fast, privacy-friendly proof-of-work CAPTCHA alternative to reCAPTCHA and hCaptcha. Zero dependencies, developer-friendly, and effective against spam, DDoS, and automation.",
      },
    ],
    ["meta", { property: "og:url", content: "https://capjs.js.org" }],
    [
      "meta",
      { property: "og:image", content: "https://capjs.js.org/logo.png" },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    [
      "meta",
      {
        name: "twitter:title",
        content: "Cap — Modern, Open-source PoW CAPTCHA for JavaScript",
      },
    ],
    [
      "meta",
      {
        name: "twitter:description",
        content:
          "Cap.js is a fast, privacy-friendly proof-of-work CAPTCHA alternative to reCAPTCHA and hCaptcha.",
      },
    ],
    [
      "meta",
      { name: "twitter:image", content: "https://capjs.js.org/logo.png" },
    ],
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
        src: "https://plsb.tiagorangel.com/js/script.hash.outbound-links.pageview-props.tagged-events.js",
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
  "description": "Cap is a lightweight, modern open-source CAPTCHA alternative designed using SHA-256 proof-of-work",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "All",
  "image": "https://capjs.js.org/logo.png",
  "author": {
    "@type": "Person",
    "name": "Tiago Rangel",
    "url": "https://tiagorangel.com"
  },
  "license": "https://github.com/tiagorangel1/cap/blob/main/LICENSE",
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
        src: "https://cdn.jsdelivr.net/npm/@cap.js/widget@latest",
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
      pattern: "https://github.com/tiagorangel1/cap/edit/main/docs/:path",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Docs", link: "/guide" },
    ],

    sidebar: [
      { text: "Quickstart", link: "/guide/index.md" },
      { text: "Alternatives", link: "/guide/alternatives.md" },
      { text: "Philosophy", link: "/guide/philosophy.md" },
      {
        text: "Modes",
        items: [
          { text: "Standalone mode", link: "/guide/standalone.md" },
          { text: "Floating mode", link: "/guide/floating.md" },
          { text: "Invisible mode", link: "/guide/invisible.md" },
        ],
      },
      {
        text: "Libraries",
        items: [
          { text: "@cap.js/server", link: "/guide/server.md" },
          { text: "@cap.js/widget", link: "/guide/widget.md" },
          { text: "@cap.js/solver", link: "/guide/solver.md" },
          { text: "@cap.js/cli", link: "/guide/cli.md" },
        ],
      },
      {
        text: "Checkpoints",
        items: [
          { text: "About", link: "/guide/middleware/index.md" },
          { text: "Elysia", link: "/guide/middleware/elysia.md" },
          { text: "Hono", link: "/guide/middleware/hono.md" },
        ],
      },
      {
        text: "Proof-of-work",
        items: [
          { text: "Effectiveness", link: "/guide/effectiveness.md" },
          { text: "How does it work", link: "/guide/workings.md" },
        ],
      },
      { text: "Benchmark", link: "/guide/benchmark.md" },
      { text: "Demo", link: "/guide/demo.md" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/tiagorangel1/cap" },
      { icon: "twitter", link: "https://x.com/0xtiago_" },
    ],

    footer: {
      message: "Released under the Apache 2.0 License.",
      copyright:
        "Copyright © 2025-present <a href='https://tiagorangel.com' target='_blank'>Tiago Rangel</a>",
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
