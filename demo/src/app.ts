import { createApp, watchEffect } from 'nativescript-vue'
import App from './App.vue'
import { router } from './router'
import { installDiagnosticsDemo } from './diagnostics'
import { session } from './store'

if (__DEV__) installDiagnosticsDemo(router)
createApp(App).use(router).start()

// home-screen shortcuts follow the session: the account one only while signed in
void router.isReady().then(() =>
  watchEffect(() =>
    router.setShortcuts([
      {
        id: 'compose',
        title: 'New message',
        to: '/compose',
        icon: { ios: 'square.and.pencil' },
      },
      { id: 'settings', title: 'Settings', to: '/settings', icon: { ios: 'gear' } },
      ...(session.user
        ? [
            {
              id: 'account',
              title: 'Account',
              to: '/settings/account',
              icon: { ios: 'person' },
            },
          ]
        : []),
    ]),
  ),
)
