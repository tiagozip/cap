import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Cap",
  description: "A modern, lightning-quick PoW captcha",
  lastUpdated: true,
  themeConfig: {
    logo: '/logo.png',

    editLink: {
      pattern: 'https://github.com/tiagorangel1/cap/edit/main/docs/:path'
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Docs", link: "/guide" },
    ],

    sidebar: [
      { text: "Quickstart", link: "/guide/index.md" },
      { text: "Effectiveness", link: "/guide/effectiveness.md" },
      { text: "Alternatives", link: "/guide/alternatives.md" },
      {
        text: 'Modes',
        items: [
          { text: 'Standalone mode', link: '/guide/standalone.md' },
          { text: 'Floating mode', link: '/guide/floating.md' },
          { text: 'Invisible mode', link: '/guide/invisible.md' }
        ]
      },
      {
        text: 'Libraries',
        items: [
          { text: '@cap.js/server', link: '/guide/server.md' },
          { text: '@cap.js/widget', link: '/guide/widget.md' }
        ]
      },
      { text: "Demo", link: "https://cap-starter.glitch.me/" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/tiagorangel1/cap" },
    ],
    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the AGPLv3 License.",
      copyright:
        "Copyright © 2025-present <a href='https://tiagorangel.com' target='_blank'>Tiago Rangel</a>",
    },
  },
  markdown: {
    image: {
      lazyLoading: true,
    },
  },
  ssr: {
    noExternal: ["vitepress-plugin-nprogress"],
  }
});
