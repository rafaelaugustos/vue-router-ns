# Android predictive back

Since Android 14, the back swipe reports its progress while the finger moves. `useBackGesture()` hands it to the page the swipe would close, so the page can follow the finger:

```vue
<script setup lang="ts">
import { computed } from 'nativescript-vue'
import { useBackGesture } from 'vue-router-ns'

const gesture = useBackGesture()
const scale = computed(() => 1 - (gesture.value?.progress ?? 0) * 0.1)
</script>

<template>
  <Page>
    <GridLayout :scaleX="scale" :scaleY="scale">...</GridLayout>
  </Page>
</template>
```

While the user drags, it's `{ progress, edge }`, with `progress` going from 0 to 1. The rest of the time it's `null`: once the swipe is cancelled or released, on iOS, on the first page (where back leaves the app), on a modal with `cancelable: false`, and while a leave guard is active, since letting go won't simply close the page then. Releasing goes back through the router like the back button, guards included.

## Enabling it

Apps that target Android 16 (API 36) get predictive back by default. Earlier targets opt in with `android:enableOnBackInvokedCallback="true"` on `<application>` in `AndroidManifest.xml`.

## What's not there

The page below doesn't show through during the swipe. `@nativescript/core` doesn't keep it in a fragment back stack the system could preview, so what happens on screen is up to the page. [#19](https://github.com/rafaelaugustos/vue-router-ns/issues/19) tracks it.
