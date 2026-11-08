import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import Benchmark from "./components/Benchmark.vue";
import Compliance from "./components/Compliance.vue";
import DashboardDemo from "./components/DashboardDemo.vue";
import InstrumentationFlow from "./components/InstrumentationFlow.vue";
import Demo from "./components/Demo.vue";
import DemoReply from "./components/DemoReply.vue";
import DemoTabs from "./components/DemoTabs.vue";
import GithubStars from "./components/GithubStars.vue";
import HomeV2 from "./components/HomeV2.vue";
import "./style.css";

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "nav-bar-content-after": () => h(GithubStars) }),
  enhanceApp({ app, router, siteData }) {
    if (typeof window !== "undefined") {
      const known = Object.keys(siteData.value.locales).filter((k) => k !== "root");
      const remember = (path) => {
        const seg = path.split("/")[1];
        try {
          localStorage.setItem("cap-locale", known.includes(seg) ? seg : "root");
        } catch {}
      };
      remember(location.pathname);
      router.onAfterRouteChange = (href) => remember(new URL(href, location.origin).pathname);
    }

    app.component("Benchmark", Benchmark);
    app.component("Compliance", Compliance);
    app.component("DashboardDemo", DashboardDemo);
    app.component("InstrumentationFlow", InstrumentationFlow);
    app.component("Demo", Demo);
    app.component("DemoReply", DemoReply);
    app.component("DemoTabs", DemoTabs);
    app.component("HomeV2", HomeV2);
  },
};
