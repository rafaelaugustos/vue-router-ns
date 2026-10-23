import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'
import './app.css'

createApp(App).use(router).start()
