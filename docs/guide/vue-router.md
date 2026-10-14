# Differences from Vue Router

| Vue Router                                 | vue-router-ns                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `createWebHistory()` and friends           | No history option: the native stack is the history.                                                              |
| `<RouterView>` swaps components            | `<RouterView>` is a `Frame`. Every navigation is a page in its stack.                                            |
| `useRoute()` is the current route          | Inside a page, it's that page's route.                                                                           |
| `onBeforeRouteLeave` runs on any departure | Runs when the page leaves the stack. A push on top keeps it alive.                                               |
| `onBeforeRouteUpdate`                      | Not available: different params mean a new page.                                                                 |
| `router.forward()`, `go(n > 0)`            | There is no forward history.                                                                                     |
| Nested `<RouterView>` through `children`   | `children` nest paths and merge `meta`. Nested UI is another `<RouterView>`.                                     |
| `beforeEnter` runs on back navigations     | Going back reveals a page that already exists, so only leave guards and global guards run.                       |
| A guard redirect during back               | Becomes a push to the redirect target.                                                                           |
| `next()` in guards                         | Return values only.                                                                                              |
| Unknown paths render nothing               | `push` rejects with `No route matches`. Add a catch-all route (`/:pathMatch(.*)*`) if you want a not-found page. |
| `scrollBehavior`                           | Not applicable. `hash` is kept in locations for parity.                                                          |

## What's only here

`backTo()`, `backToRoot()`, `setStack()`, `pushForResult()`, `back({ result })`, `onPageActivated()`, `onPageDeactivated()`, `useBackGesture()`, modal routes, named frames, `withParents`, `restore`, and a reactive `router.stack`.
