# 守卫 {#guards}

全局 导航守卫 和 `beforeEnter` 的工作方式与 Vue Router 4 中的工作方式相同：返回 `false` 进行取消，返回一个位置进行重定向，或者不继续。它们可以是异步的。第三个参数告诉您它是什么类型的导航：

```ts
router.beforeEach((to, from, { type }) => {
  // type: 'push' | 'replace' | 'back'
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})
```

<Clip name="ios-guards" caption="帐户重定向至登录。输入名称会激活离开 导航守卫，这可以使页面保持打开状态。 iOS 26模拟器。" />

`beforeResolve`、`afterEach` 和 `onError` 也在那里，带有 Vue Router的签名。

## 离开导航守卫 {#leave-guards}

`onBeforeRouteLeave` 在其页面即将从 导航栈 中删除时运行：在背面、替换或 `clearHistory` 上，以及在 Android 后退按钮上，路由器会拦截该按钮，以便您的 导航守卫 获得发言权。将另一个页面推到顶部会使该页面保持活动状态，因此 导航守卫 不会运行。

```ts
import { computed, ref } from 'nativescript-vue'
import { Dialogs } from '@nativescript/core'
import { onBeforeRouteLeave } from 'vue-router-ns'

const draft = ref('')
const dirty = computed(() => draft.value.trim() !== '')

onBeforeRouteLeave(() => Dialogs.confirm('Discard this draft?'), { when: dirty })
```

`when` 是可选项，对 iOS 尤其重要。滑动返回无法等待异步守卫，因此离开守卫活动期间，路由器会禁用该页面的滑动返回。提供 `when` 后，只有其值为真时守卫才会阻止手势；草稿为空时仍可正常滑动返回。

## 导航守卫 处于活动状态时平台会执行哪些操作 {#what-the-platform-does-while-a-guard-is-active}

| 手势                               | 行为                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Android 返回按钮，或释放滑动       | 浏览 导航守卫。                                                                                                        |
| iOS 向后滑动                       | 已关闭该页面，因为它无法等待异步应答。                                                                                 |
| iOS ActionBar Back/历史（iOS 16+） | 当可移除页面有启用的离开守卫时，临时使用 router 控制的原生项目；点击和历史选择均运行守卫。iOS 15 的 pop 仍由原生处理。 |
| 模态向下滑动，或在                 | 外部点击 运行 导航守卫，纸张保持原状，并在允许的情况下关闭模态。邮件就是这样做的。                                     |

其余时间，本地弹出是本地的：路由器保持其 导航栈 同步并运行 `afterEach`，但没有任何东西可以否决它。

原生历史跳转可能移除多个页面，因此受保护的 ActionBar 也会考虑当前页面下方的守卫。菜单使用稳定的条目地址以及现有的守卫、结果和释放流程。等待确认不会变成选择同一路由新一次访问的许可。通过 Page 的公开 `ActionBar.update()` 扩展标题栏，并在交还控制或释放时恢复；导航 delegate 保持不变。这适用于带 ActionBar 的 NativeScript 路由 Page。iOS 15 保留此前原生 pop 的限制。

仅有全局守卫不会禁用原生手势或启用此控件。当可移除历史中没有启用的页面离开守卫时，原生 Back 仍在系统 pop 后进行同步。对于必须防止原生历史跳转丢失的状态，使用带 `when` 的 `onBeforeRouteLeave`。根条目的守卫不会替换历史控件，因为选择根条目会保留它。

标题栏或守卫变化会关闭标题栏中已打开的上下文菜单；被覆盖、已变化或已释放页面的旧回调将被忽略。

<Clip name="guarded-back-history" :width="480" aspect="3 / 4" caption="受保护的原生 Back：顶部/被覆盖页面的守卫、Stay/Leave 确认、精确选择重复条目、标题栏更新和恢复。iOS 18.6 模拟器；演示标签为英文。" />

## 继续学习 {#continue-learning}

运行 [modal 编辑器教程](./first-app) 来练习拒绝、保存和丢弃完整的源代码。对于原生手势边界，请参阅 [pages、导航栈 和 state](./mental-model#native-back-and-guards)。
