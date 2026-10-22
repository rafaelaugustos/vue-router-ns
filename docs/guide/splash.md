# Splash above the first page

Keep a startup splash above `<RouterView>` so the first native page can mount underneath it. Removing the overlay reveals that same page, without adding a splash entry to the navigation history.

If the splash is a route, calling `replace()` creates the destination when the splash exits. On Android, that work can compete with the exit animation on the UI thread. An overlay lets page creation finish before its exit animation starts; it does not move initialization work off the UI thread.

## Keep RouterView mounted

After the [normal router installation](./install), save this as `App.vue` and the next component as `Splash.vue` in the same directory:

<<< ../snippets/SplashApp.vue

Both children occupy the same `GridLayout` cell. The splash comes last, above the router. The wrapper keeps the covered page out of touch interaction and accessibility traversal until the splash is removed.

Only the overlay has `v-if`. Do not put `<RouterView>` behind `v-if="!showSplash"`: that would postpone page creation until the splash disappears. Do not await `router.isReady()` before `createApp(App).use(router).start()` either: the router needs its view to mount first.

## Reveal the page

This component waits for initial navigation, fades the overlay and emits `done`. It stays visible with an error message if initialization throws or the initial guard leaves no destination:

<<< ../snippets/Splash.vue

The fade is an application animation. Bind `:fade="false"` when your app's reduced-motion preference is enabled; the router's [motion policy](./accessibility#reduced-motion) controls routed transitions, not this custom animation.

`isReady()` waits for initial navigation, not every hidden tab or the page's own network requests. Add any required app initialization to the readiness condition. For onboarding, emit `done` when the user completes the onboarding instead; keep `<RouterView>` mounted throughout.

## Match the iOS launch screen

Set `iosOverflowSafeArea="true"` on the overlay's root layout so its background extends beyond the safe area. Use the same background, artwork, size and positioning as `App_Resources/iOS/LaunchScreen.storyboard` to avoid a visible jump when iOS hands over to the running app. Check the alignment on the iPhone and iPad sizes you support.

This overlay appears after NativeScript starts. It complements the operating system's launch screen; it cannot replace the screen shown before JavaScript runs. `iosOverflowSafeArea` is specific to iOS.

## Guards still run underneath

Initial navigation, redirects and [guards](./guards) run as usual while the splash is visible. It hides the page visually; it does not delay authentication or bypass guards. Redirect an unauthenticated initial visit to a usable login page. A splash is not an access-control boundary.

No router API change, extra route, `push()` or `replace()` is needed to remove the overlay. Back returns through the actual app history and does not bring the splash back.
