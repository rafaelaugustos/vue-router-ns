import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Clip', Clip)
  },
} satisfies Theme
