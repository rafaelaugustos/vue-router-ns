# 与 Vue Router的差异 {#differences-from-vue-router}

| Vue Router                            | vue-router-ns                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `createWebHistory()` 和朋友           | 无历史记录选项：原生 导航栈 是历史记录。                                                                 |
| `<RouterView>` 交换组件               | `<RouterView>` 是 `Frame`。每个导航都是其 导航栈 中的一个页面。                                          |
| `useRoute()` 是当前路由               | 在页面内部，是该页面的路由。                                                                             |
| `onBeforeRouteLeave` 在任何离开时运行 | 当页面离开 导航栈 时运行。按下顶部即可使其保持活力。                                                     |
| `onBeforeRouteUpdate`                 | 不可用：不同的参数意味着新页面。                                                                         |
| `router.forward()`、`go(n > 0)`       | 没有转发历史记录。                                                                                       |
| 通过 `children`                       | `children` 嵌套 `<RouterView>` 嵌套路径并合并 `meta`。嵌套 UI 是另一个 `<RouterView>`。                  |
| `beforeEnter` 在后退导航上运行        | 返回显示已存在的页面，因此仅保留 导航守卫 和全局 导航守卫 运行。                                         |
| 返回期间的 导航守卫 重定向            | 成为重定向目标的推送。                                                                                   |
| `next()` in 导航守卫                  | 仅返回值。                                                                                               |
| 未知路径不渲染任何内容                | `push` 拒绝 `No route matches`。如果您想要未找到的页面，请添加一条包罗万象的路线（`/:pathMatch(.*)*`）。 |
| `scrollBehavior`                      | 不适用。 `hash` 保存在奇偶校验位置。                                                                     |

## 这里只有什么 {#what-s-only-here}

`backTo()`、`backToRoot()`、`setStack()`、`pushForResult()`、`back({ result })`、`onPageActivated()`、`onPageDeactivated()`、`useBackGesture()`、模态路由、命名帧、`withParents`、 `restore`，和反应型`router.stack`。
