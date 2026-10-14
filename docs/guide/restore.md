# Restoring the stack after the app is killed

Android kills apps in the background all the time, and brings a native app back on the screen it was on, with its back stack. Every page here is a path, so the stack is a list of strings and the router can save it for you:

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

`save` runs after every navigation with the paths of every named `<RouterView>`, and with `null` when the app exits on its own, so a fresh start after the user left stays fresh. When a `<RouterView>` mounts, the router asks `load` once (it can be async) and rebuilds the saved stack without animating, through the guards, so a page that needs a session still sends you to the login.

Saves older than `maxAge` (30 minutes by default) are ignored; pass `Infinity` to always restore.

## What can't come back

Modals, and `props` passed through `push`. A page that relies on them should cope with their absence, by reading its params instead. If a saved path matches no route anymore, after an update for example, the stack starts from `initial` instead.
