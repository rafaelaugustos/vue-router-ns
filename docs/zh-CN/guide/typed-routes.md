# 类型化路由 {#typed-routes}

注册路由器一次，并在应用程序中检查路由名称和参数，从路由表中推断出来，无需生成代码：

```ts
declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }
  interface RouteMeta {
    requiresAuth?: boolean
  }
}
```

```ts
router.push({ name: 'message', params: { id: 1 } }) // ✓
router.push({ name: 'mesage' }) // ✗ Did you mean 'message'?
router.push({ name: 'message' }) // ✗ missing param `id`

const route = useRoute('message')
route.params.id // string
```

参数来自路径：`/users/:id` 给出 `{ id: string }`，`:id?` 使其可选，`:path+` 和 `:path*` 给出数组。嵌套的 `children` 加入它们的路径。

## 预先导入的页面 {#pages-imported-up-front}

如上所述，在 `createRouter` 中声明 `routes` 内联，并通过函数提供组件：`() => import('./Message.vue')` 或 `() => Message` 对于您希望预先导入的页面。

直接引用（`component: Message`）会使 `<script setup>` 页面的类型成为路由表类型的一部分，而页面自身又使用路由表的类型。TypeScript 无法解决这个循环依赖，会报错：`'router' implicitly has type 'any'`。通过函数返回页面，可将页面类型的求值推迟到之后。
