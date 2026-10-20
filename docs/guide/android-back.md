# Android predictive back

On Android 14 and later, the router shows the previous page during the back swipe. The current page shrinks and follows the finger, revealing the one below. Cancelling restores both pages; releasing finishes the motion and goes back through the router, including its guards.

The preview works between pages in the same stack, including pages inside a modal. A modal's first page still uses normal dismissal, without previewing the stack underneath. Back from the app's first page still leaves the app. Pages with an active leave guard do not start a preview. If the previous native view is unavailable, normal back navigation still works.

## Customizing

The preview is enabled by default. To replace the animation with your own, disable it on the router:

```ts
const router = createRouter({
  routes,
  backPreview: false,
})
```

`useBackGesture()` remains available with or without the preview. It hands progress to the page the swipe would close:

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

While the user drags, it's `{ progress, edge }`, with `progress` going from 0 to 1. The rest of the time it's `null`: once the swipe is cancelled or released, on iOS, on the first page (where back leaves the app), on the first page of a modal with `cancelable: false`, and while a leave guard is active, since letting go won't simply close the page then. Releasing goes back through the router like the back button, guards included.

## Enabling it

Set `android:enableOnBackInvokedCallback="true"` on `<application>` in `AndroidManifest.xml` to receive predictive back progress on Android 14 and 15, even when targeting API 36. The default opt-in for apps targeting API 36 applies only when running on Android 16 or later.

See also the [Android predictive back documentation](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture).

## Experimental Core-owned preview

The default remains the existing router preview. To test the [proposed Core API](https://github.com/NativeScript/NativeScript/pull/11558), opt in explicitly:

```ts
const router = createRouter({ routes, backPreview: 'core' })
```

Frame hosts feature-detect a version-1 `beginBackPreview()` session. Core 9.1.3 does not expose this API: with that released dependency, `'core'` uses the existing preview. Testing the candidate requires building the proposed Core revision; the router does not patch installed packages or install an unreleased Core automatically. Other custom hosts retain their own preview implementation.

The candidate keeps the previous Page detached and shows a temporary native bitmap instead. Frame owns its disposal during navigation, unload, detachment and Activity recreation. Guards and route history still belong to the router. An active leave guard suppresses the preview before it begins; global/asynchronous guards run after release and can refuse navigation. A newer navigation invalidates an older gesture.

![Core prototype during a real Android back gesture](/media/android-core-back-preview.png)

This trades synchronous capture time and memory for clearer native view ownership. The snapshot is static, bounded to 16 MiB, hidden from accessibility and released after use. SurfaceView/TextureView content, secure windows, custom/shared transitions and unsupported captures fall back to the existing preview. A modal Frame previews only its own previous Page.

The candidate also fixes an existing Core attachment race after Activity recreation. That correction belongs to the upstream proposal; this router option alone does not fix the released Core. See the [Android 14/15/16 comparison and reproduction commands](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-predictive-back.md). Emulator measurements are not a physical-device performance guarantee, and the default will not switch on the strength of this prototype alone.
