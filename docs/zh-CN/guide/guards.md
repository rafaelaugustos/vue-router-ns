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

| 手势                                        | 行为                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Android 返回按钮，或释放滑动                | 浏览 导航守卫。                                                                      |
| iOS 向后滑动                                | 已关闭该页面，因为它无法等待异步应答。                                               |
| iOS ActionBar 返回按钮（iOS 16 及更高版本） | 看起来相同，但像 `router.back()` 一样穿过 导航守卫。在 iOS 15 上，流行音乐保持原生。 |
| 模态向下滑动，或在                          | 外部点击 运行 导航守卫，纸张保持原状，并在允许的情况下关闭模态。邮件就是这样做的。   |

其余时间，本地弹出是本地的：路由器保持其 导航栈 同步并运行 `afterEach`，但没有任何东西可以否决它。

## 继续学习 {#continue-learning}

运行 [modal 编辑器教程](./first-app) 来练习拒绝、保存和丢弃完整的源代码。对于原生手势边界，请参阅 [pages、导航栈 和 state](./mental-model#native-back-and-guards)。
