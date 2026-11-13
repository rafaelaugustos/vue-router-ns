import './orbit-signature.css'
import SiteLayout from './SiteLayout.vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Clip from './Clip.vue'
import HomeExperience from './HomeExperience.vue'
import ExampleGallery from './ExampleGallery.vue'
import StackModel from './StackModel.vue'
import './custom.css'
import './experience/experience.css'

export default {
  extends: DefaultTheme,
  Layout: SiteLayout,
  enhanceApp({ app }) {
    app.component('Clip', Clip)
    app.component('HomeExperience', HomeExperience)
    app.component('ExampleGallery', ExampleGallery)
    app.component('StackModel', StackModel)
  },
} satisfies Theme
