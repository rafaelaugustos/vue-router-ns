# Zoom and shared elements

Tap a card and let the page grow out of it. On Back, it shrinks into the same element. This is UIKit’s native zoom, available on iOS 18+ when the runtime exposes `UIViewControllerTransition`. Android and runtimes without that API use the normal transition or an explicit fallback.

<Clip name="ios-zoom" caption="The card opens the message with UIKit zoom and receives the return transition. iOS 26 simulator." />

## Card with RouterLink

Save as `Inbox.vue`. The single child of `RouterLink` is the source element; no ref or JavaScript animation is needed.

<<< ../snippets/ZoomCard.vue

## Destination and setup

Save the destination as `Message.vue`:

<<< ../snippets/ZoomMessage.vue

Register both pages and install the router in the app, as in the [installation guide](./install):

```ts
import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./Inbox.vue') },
    {
      path: '/messages/:id',
      name: 'message',
      component: () => import('./Message.vue'),
      props: true,
    },
  ],
})
```

Use `<RouterView />` in the app root. Try a single stack first: the first detail in an expanded split appears in another pane, without zooming from the list.

## List row with zoomFrom

Replace `Inbox.vue` with this version to use the view supplied by `itemTap`. The destination above also has the tag required for the shared transition used as a fallback.

<<< ../snippets/ZoomList.vue

### What to look for

- Tap a row: the message should open in the same stack.
- When zoom is available, the page grows from the row. Back should return to the source.
- With reduced motion enabled, the router requests an unanimated transition.
- On Android, labels with the same `sharedTransitionTag` participate in the shared transition.
- A normal sideways animation does not demonstrate zoom. Check runtime API availability and avoid `Frame.defaultTransition` on this frame.

The [demo Inbox](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Inbox.vue) uses `zoomFrom` with a fallback. To reproduce the video, open Settings → Zoom from a card in the demo. This page uses a single stack; [see its source](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/pages/Transitions.vue).

## Transition reference

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

See [interactive transition ownership and limits](./interactive-transitions) before designing custom gesture adapters.
