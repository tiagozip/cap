import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "en-US",
  title: "Cap",
  description:
    "Cap is a lightweight, modern open-source CAPTCHA alternative using SHA-256 proof-of-work",
  lastUpdated: true,
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
          "proof of work captcha, pow captcha, open source captcha, captcha alternative, recaptcha alternative, bot protection, anti-spam captcha, account security, abuse detection, abuse prevention, api abuse, api defense, api analytics, api protection, api security, algorithm, algorithm implementation, alerting, anti-abuse, anti-automation, anti-bot, anti-bot component, anti-ddos, anti-dos, anti-exploitation, anti-spam, application security, authentication, authentication protocol, automated attacks, automated scraping, behavioral analysis, bot defense, bot detection, bot detection monitoring, bot management, bot mitigation, bot prevention, bot traffic, bots, brute force, bun, bun runtime, challenge generator, challenge string, challenge verifier, challenge-response, challenge-response protocol, client defense, client-side, client-server architecture, compute, compute bound, computation, computational challenge, computational complexity, computational defense, computational puzzle, configuration, cpu bound, cross-platform, crypto, crypto puzzle, cryptographic algorithm, cryptographic challenge, cryptographic defense, cryptographic puzzle, cryptography, cryptography library, customization, cybersecurity, ddos, ddos protection, defense mechanism, degree of difficulty, dependencies, deployment, design, developer tool, development, development environment, difficulty, digest, digital security, distributed computing, dos, encryption, exploit mitigation, form security, fraud detection, fraud prevention, frontend development, frontend js, fullstack js, hash function, hash puzzle, hashcash, hashing, hashing library, hcaptcha, human test, human verification, image captcha, incident response, infrastructure security, integration, integrity, internet security, invisible captcha, js, js runtime, javascript, javascript tool, library, lightweight, logging, logic, login security, low overhead, machine learning, malicious traffic, minimal, mining, mitigation technique, module, modules, monitoring, minimalist, node, node.js, node.js runtime, node.js tool, nonce, non-blocking i/o, online security, open source, optimization, package, parallel computation, performant, performance, performance monitoring, performance optimization, performance testing, pnpm, pow, process, production, programming, proof, proof generation, proof generator, proof of work, proof verification, proof verifier, proof-of-work, quick, rate limiting, ratelimit, recaptcha, reliability, request, resilience, resource efficient, scrapers, secure hashing, security analytics, security challenge, security component, security library, security measure, security model, security monitoring, security protocol, security system, security technique, security testing, server defense, software development, solver, spam bots, spam filtering, spam mitigation, spam prevention, target difficulty, threat intelligence, traffic management, traffic monitoring, turing test, unwanted traffic, user experience, validation, validation process, verification, verification process, verifier, vulnerability, web application protection, web application security, web defense, web defense system, web development, web scraping, web security, web security tool, web services, web worker, web workers, website defense, website protection, website security, work validation, worker thread, workers, captcha solver",
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
        type: "application/ld+json",
      },
      `
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Cap",
      "url": "https://capjs.js.org",
      "description": "Lightweight, modern open-source CAPTCHA alternative using SHA-256 proof-of-work",
      "applicationCategory": "SecurityApplication",
      "operatingSystem": "All"
    }
    `,
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
      provider: "local",
    },

    logo: "/logo.png",

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
