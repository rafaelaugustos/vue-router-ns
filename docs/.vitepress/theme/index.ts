import OrbitSignature from './OrbitSignature.vue'
import './orbit-signature.css'
import { h } from 'vue'
import VersionBadge from './VersionBadge.vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import HomeExperience from './HomeExperience.vue'
import ExampleGallery from './ExampleGallery.vue'
import StackModel from './StackModel.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(OrbitSignature),
      'nav-bar-title-after': () => h(VersionBadge),
    }),
  enhanceApp({ app }) {
    app.component('Clip', Clip)
    app.component('HomeExperience', HomeExperience)
    app.component('ExampleGallery', ExampleGallery)
    app.component('StackModel', StackModel)
  },
} satisfies Theme
