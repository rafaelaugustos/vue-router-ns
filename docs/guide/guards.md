# Guards

Global guards and `beforeEnter` work as in Vue Router 4: return `false` to cancel, a location to redirect, or nothing to continue. They can be async. A third argument tells you what kind of navigation it is:

```ts
router.beforeEach((to, from, { type }) => {
  // type: 'push' | 'replace' | 'back'
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})
```

<Clip name="ios-guards" caption="Account redirects to sign-in. A typed name activates the leave guard, which can keep the page open. iOS 26 simulator." />

`beforeResolve`, `afterEach` and `onError` are there too, with Vue Router's signatures.

## Leave guards

`onBeforeRouteLeave` runs when its page is about to be removed from the stack: on back, replace or `clearHistory`, and also on the Android back button, which the router intercepts so your guard gets a say. Pushing another page on top keeps the page alive, so the guard doesn't run then.

```ts
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave } from 'vue-router-ns'

const draft = ref('')
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), { when: dirty })
```

`when` is optional, and it matters on iOS. A swipe back can't wait for an async guard, so while a leave guard is active the router turns swipe-back off for that page. With `when`, the guard only blocks while it's true: with an empty draft, the page swipes away as usual.

## What the platform does while a guard is active

| Gesture                                      | Behavior                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Android back button, or releasing the swipe  | Goes through the guard.                                                                          |
| iOS swipe back                               | Turned off for that page, since it can't wait for an async answer.                               |
| iOS ActionBar back button (iOS 16 and later) | Looks the same, but goes through the guard like `router.back()`. On iOS 15 the pop stays native. |
| Modal swiped down, or tapped outside         | Runs the guard with the sheet staying put, and closes the modal if it allows. Mail does this.    |

The rest of the time, a native pop is native: the router keeps its stack in sync and runs `afterEach`, but nothing can veto it.

## Continue learning

Run the [modal editor tutorial](./first-app) to exercise refusal, saving and discarding with complete source. For native gesture boundaries, see [pages, stacks and state](./mental-model#native-back-and-guards).
