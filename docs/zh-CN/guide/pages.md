# 每个页面都保留其路线 {#every-page-keeps-its-route}

推动页面不会破坏下面的页面：它保持安装状态，直到离开 导航栈。这就是为什么页面内的 `useRoute()` 返回该页面的路由，并且它永远不会改变。虽然 `/messages/2` 位于 `/messages/1` 之上，但第一页仍然看到 `id: '1'`，并且不会因为另一个页面移动而重新运行。

<Clip name="ios-navigation" caption="每条消息都将其自己的条目添加到底部显示的 导航栈 中。 iOS 26模拟器。" />

外部页面（例如，在 `App.vue` 中），`useRoute()` 跟随屏幕上的页面。 `router.currentRoute` 始终是屏幕上的页面，而 `router.stack` 是整个 导航栈，从下到上，反应式：

```ts
const { stack } = useRouter()
const canGoBack = computed(() => stack.value.length > 1)
```

页面内的 `useRouter()` 在页面所在的 导航栈 中导航：其选项卡或其模态。

## 属性 {#props}

路由记录的 ​​`props` 的工作方式与 Vue Router中的工作方式相同：`true` 将参数作为 props 传递，对象按原样传递，函数映射路由。最重要的是，`push` 将 `props` 用作不能作为参数的值，例如在加载真实对象时预览的对象。

## 当页面重新出现时 {#when-a-page-comes-back-into-view}

停留在导航栈中的页面在返回时不会再次挂载，因此`onMounted`不会帮助您刷新它。使用这些代替：

```ts
onPageActivated(() => refresh()) // shown, and every time the user comes back
onPageDeactivated(() => pause()) // covered by another page or a modal
```

当页面离开 导航栈 时，它被卸载，因此清理工作在 `onUnmounted` 中进行。

## 有很多内容需要布局的页面 {#pages-with-a-lot-to-lay-out}

在 NativeScript 中，JavaScript 在主线程上运行，因此需要一段时间构建的页面会延迟其自己的推送动画：框架在移动之前等待视图。 `<Deferred>` 让转换在安装其内容之前完成：它渲染其 `fallback` 直到页面出现在屏幕上，在转换之后，然后才渲染其内容。

```vue
<Page>
  <ActionBar title="Report" />
  <Deferred>
    <template #fallback><ActivityIndicator busy /></template>
    <ReportBody :report="report" />
  </Deferred>
</Page>
```

在 Android 模拟器上测量，`StackLayout` 中的页面有 400 行：点击后 1.1 到 2.7 秒完成转换； `<Deferred>` 内的行为 0.3 至 0.7 秒。行本身花费的时间与以前一样长，因为工作不会消失：它发生在页面打开之后而不是之前。对于长列表，`ListView` 或 `CollectionView` 仍然是答案，因为它们只构建可见的内容。

## 开发期间的 HMR {#hmr-during-development}

自 beta.6 起，重新加载路由组件会通过 NativeScript-Vue 的原生 Page 替换。如果另一个页面在同一个 导航栈 中覆盖它，则重新加载会等待，直到 Frame 完成返回到它。堆栈顺序被保留，并且更新的内容在返回时出现。

A reload that remounts a component can reset its local state; preserving history does not preserve every setup ref. Template-only updates follow Vue's HMR behavior. Changes to the router module, app root or native resources may require restarting the app.此行为仅适用于开发。
