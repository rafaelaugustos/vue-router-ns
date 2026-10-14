# Zoom and shared elements

`transition` takes NativeScript's `SharedTransition`, which morphs the views that share a `sharedTransitionTag` from one page into the next, on both platforms:

```vue
<!-- in the list -->
<Image :src="photo.thumb" :sharedTransitionTag="`photo-${photo.id}`" />

<!-- in the photo page -->
<Image :src="photo.full" :sharedTransitionTag="`photo-${photo.id}`" />
```

```ts
import { PageTransition, SharedTransition } from '@nativescript/core'

router.push(`/photos/${photo.id}`, {
  transition: SharedTransition.custom(new PageTransition()),
})
```

Going back plays it in reverse. Its interactive dismissal (`interactive: { dismiss }`, iOS only) is a native pop, like the swipe back: the router follows it, but a leave guard can't stop it.

On iOS 18 and later, `zoomFrom` hands the animation to UIKit's zoom: the page grows out of a view, and shrinks back into it when it closes, through the back button, an edge swipe or a drag down. While a leave guard is active, the drag is held, like the swipe back.

```ts
function open({ index, view }: ItemEventData) {
  router.push(`/photos/${photos[index].id}`, { zoomFrom: view })
}
```

`zoomFrom` takes a view, a template ref's element or a component, and `<RouterLink zoom>` zooms out of its own child. If the view is gone by the time the page closes, the page closes without zooming. Where the zoom doesn't apply (Android, iOS before 18, `animated: false`), the page gets its usual transition, so passing both gives each platform its own:

```ts
router.push(to, {
  zoomFrom: view, // iOS 18
  transition: SharedTransition.custom(new PageTransition()), // everywhere else
})
```

A default transition set on the frame (`Frame.defaultTransition`) takes the animation back from UIKit, so leave it unset where you zoom.
