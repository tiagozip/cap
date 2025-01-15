import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Cap",
  description: "A modern, lightning-quick PoW captcha",
  lastUpdated: true,
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => {
          return tag.toLowerCase().indexOf("cap-widget") === 0;
        },
      },
    },
  },
  themeConfig: {
    logo: '/logo.png',

    editLink: {
      pattern: 'https://github.com/tiagorangel1/cap/edit/main/docs/:path'
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "Docs", link: "/guide" },
      { text: "Demo", link: "https://cap-starter.glitch.me/" },
    ],

    sidebar: [
      { text: "Quickstart", link: "/guide/index.md" },
      { text: "Effectiveness", link: "/guide/effectiveness.md" },
      { text: "Floating mode", link: "/guide/floating.md" },
      {
        text: 'Changelogs',
        items: [
          { text: '@cap.js/server', link: '/guide/changelog/server.md' },
          { text: '@cap.js/client', link: '/guide/changelog/client.md' }
        ]
      },
      { text: "Vulnerabilities", link: "/guide/vulnerabilities.md" },
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
