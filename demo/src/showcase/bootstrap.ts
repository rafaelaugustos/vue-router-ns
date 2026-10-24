import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'
import './style.css'
export function startShowcase() {
  createApp(App).use(router).start()
}
