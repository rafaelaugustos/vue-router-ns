import { h } from 'vue'
import VersionBadge from './VersionBadge.vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(VersionBadge),
    }),
  enhanceApp({ app }) {
    app.component('Clip', Clip)
  },
} satisfies Theme
