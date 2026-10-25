# 导航 {#navigating}

使用`push`打开页面，`back`返回，`replace`交换当前条目。在路由页面内，从 `vue-router-ns` 获取带有 `const router = useRouter()` 的实例；在外部页面，导入您配置的路由器。 [first-app 教程](./first-app) 显示了完整的设置。

```ts
router.push('/messages/42?from=push')
router.push({ name: 'message', params: { id: 42 }, query: { from: 'push' } })
router.replace('/login')
router.back()
router.go(-2)
router.backTo({ name: 'inbox' }) // closest page below that matches
router.backToRoot() // first page of the stack
```

<Clip name="ios-navigation" caption="打开两封邮件，然后在一次导航中返回收件箱。 iOS 26模拟器。" />

一旦页面出现在屏幕上，一切都会返回一个承诺，当 导航守卫 停止它时，会返回 `NavigationFailure`，就像 Vue Router一样。

## 选项 {#options}

第二个参数采用仅在设备上有意义的内容：

```ts
router.push('/messages/42', {
  transition: 'slideLeft', // or a full NativeScript transition object
  animated: false,
  clearHistory: true, // nothing left to go back to
  props: { preview }, // any value, unlike params
  frame: 'profile', // a named <RouterView>
  modal: true, // present modally, whatever the route says
  withParents: true, // push the route's parents first
  zoomFrom: thumbnail, // iOS 18: grow out of this view
})
```

`back()` 采用 `animated`、`frame` 和 `result`（参见 [模态和结果](./modals)）。

## 双击 {#double-taps}

导航队列位于原生转换后面，因此双击按钮会打开页面一次：第二个 `push` 发现页面已经位于顶部，并以 `duplicated` 失败的方式解决。

## `<RouterLink>`

`RouterLink` 使其唯一的子级点击导航，而不添加视图：

```vue
<RouterLink to="/settings">
  <Button text="Settings" />
</RouterLink>
```

需要`to`、`replace`、`clearHistory`、`withParents`、`zoom`、`transition`和`frame`。

## 失败和错误 {#failures-and-errors}

完成的导航解析为 `undefined`。当 导航守卫 返回 `false` 时，预期中断解析为 `NavigationFailure`：`aborted`；当目的地已位于顶部时，解析为 `duplicated`；当较新的导航取代仍待处理的导航时，解析为 `cancelled`。

```ts
import { isNavigationFailure, NavigationFailureType } from 'vue-router-ns'

const failure = await router.push('/messages/42')
if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
  // The current page remains open.
}
```

不匹配的路由、失败的加载程序或抛出的 导航守卫 错误拒绝承诺。在呼叫站点使用 `try/catch`，并在全局观察使用 `router.onError((error, to, from) => …)`。 `afterEach((to, from, failure) => …)` 收到预期的导航故障；这些与例外情况不同。

要推送当前位置的另一个实例，请使用 `router.push({ path: '/messages/42', force: true })`。如果没有 `force`，对参数、查询或哈希的更改已经代表了不同的位置。
