import { createApp } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'
import { installDiagnosticsDemo } from './diagnostics'

if (__DEV__) installDiagnosticsDemo(router)
createApp(App).use(router).start()
