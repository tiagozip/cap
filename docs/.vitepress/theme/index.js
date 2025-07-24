// https://vitepress.dev/guide/custom-theme

import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import Benchmark from "./components/Benchmark.vue";
import Demo from "./components/Demo.vue";
import "./style.css";

/** @type {import('vitepress').Theme} */
export default {
	extends: DefaultTheme,
	Layout: () => {
		return h(DefaultTheme.Layout, null, {
			// https://vitepress.dev/guide/extending-default-theme#layout-slots
		});
	},
	enhanceApp({ app }) {
		app.component("Benchmark", Benchmark);
		app.component("Demo", Demo);
	},
};
