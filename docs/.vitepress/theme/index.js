// https://vitepress.dev/guide/custom-theme

import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import Benchmark from "./components/Benchmark.vue";
import Demo from "./components/Demo.vue";
import DemoReply from "./components/DemoReply.vue";
import EthicalAd from "./components/EthicalAd.vue";
import HomeStickyAd from "./components/HomeStickyAd.vue";
import HomeV2 from "./components/HomeV2.vue";
import StickyMobileAd from "./components/StickyMobileAd.vue";
import "./style.css";

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(EthicalAd, { variant: "doctop", position: "top" }),
      "doc-footer-before": () =>
        h(EthicalAd, { variant: "docbottom", position: "bottom" }),
      "layout-bottom": () => h(StickyMobileAd),
    });
  },
  enhanceApp({ app }) {
    app.component("Benchmark", Benchmark);
    app.component("Demo", Demo);
    app.component("DemoReply", DemoReply);
    app.component("HomeV2", HomeV2);
    app.component("EthicalAd", EthicalAd);
    app.component("HomeStickyAd", HomeStickyAd);
    app.component("StickyMobileAd", StickyMobileAd);
  },
};
