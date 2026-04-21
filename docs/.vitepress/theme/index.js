// https://vitepress.dev/guide/custom-theme

import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import Benchmark from "./components/Benchmark.vue";
import Demo from "./components/Demo.vue";
import EthicalAd from "./components/EthicalAd.vue";
import HomeV2 from "./components/HomeV2.vue";
import "./style.css";

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(EthicalAd, { variant: "doctop", position: "top" }),
      "doc-footer-before": () =>
        h(EthicalAd, { variant: "docbottom", position: "bottom" }),
    });
  },
  enhanceApp({ app }) {
    app.component("Benchmark", Benchmark);
    app.component("Demo", Demo);
    app.component("HomeV2", HomeV2);
    app.component("EthicalAd", EthicalAd);
  },
};
