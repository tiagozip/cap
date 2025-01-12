// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import Demo from './Demo.vue'
import DemoFloating from './DemoFloating.vue'
import './style.css'

import vitepressNprogress from 'vitepress-plugin-nprogress'
import 'vitepress-plugin-nprogress/lib/css/index.css'

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  enhanceApp: (ctx) => {
    ctx.app.component('Demo', Demo)
    ctx.app.component('DemoFloating', DemoFloating)
    vitepressNprogress(ctx)
  }
}
