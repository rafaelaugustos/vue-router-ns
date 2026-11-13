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

| Gesture                                     | Behavior                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android back button, or releasing the swipe | Goes through the guard.                                                                                                                                                  |
| iOS swipe back                              | Turned off for that page, since it can't wait for an async answer.                                                                                                       |
| iOS ActionBar Back/history (iOS 16+)        | Temporarily uses a native router-controlled item while a removable page has an active leave guard; both tap and history selection run guards. iOS 15 pops remain native. |
| Modal swiped down, or tapped outside        | Runs the guard with the sheet staying put, and closes the modal if it allows. Mail does this.                                                                            |

The rest of the time, a native pop is native: the router keeps its stack in sync and runs `afterEach`, but nothing can veto it.

A native history jump may remove several pages, so the protected ActionBar includes guards below the current page. Its menu uses stable entry addresses and the existing guard/result/disposal path. A pending confirmation never becomes permission to select a newer occurrence of the same route. Headers are extended through the Page's public `ActionBar.update()` and restored on handoff or teardown; navigation delegates are unchanged. This applies to routed NativeScript Pages with an ActionBar. iOS 15 retains the earlier native-pop limit.

Global guards alone do not disable native gestures or activate this control. With no active page leave guard in removable history, native Back still reconciles after the OS pop. Use `onBeforeRouteLeave` with `when` for state that must be protected from native history. A root guard does not replace a history control because selecting the root retains it.

Header updates or guard changes dismiss any open header context menu; callbacks from a covered, changed or disposed page are ignored.

<Clip name="guarded-back-history" :width="480" aspect="3 / 4" caption="Guarded native Back: top/covered guards, Stay/Leave confirmation, exact duplicate selection, header updates and restoration. iOS 18.6 simulator; English fixture labels." />

## Continue learning

Run the [modal editor tutorial](./first-app) to exercise refusal, saving and discarding with complete source. For native gesture boundaries, see [pages, stacks and state](./mental-model#native-back-and-guards).
