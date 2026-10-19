import { createApp } from 'nativescript-vue'
import { router } from './router'
import App from './App.vue'
import './app.css'

createApp(App).use(router).start()
if (__FILE_ROUTING_TEST__)
  void import('./acceptance').then(({ run }) => run(router, __FILE_ROUTING_WATCH__))
