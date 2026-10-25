# 构建第一个应用 {#build-your-first-app}

构建 **Pocket notes**：搜索笔记列表，打开一条笔记，在原生模态页面中编辑，然后返回保存的文本。离开守卫保护未保存的草稿；返回列表时，搜索条件仍然保留。

本教程使用显式路由和公开 API。你需要了解 Vue 单文件组件的基础知识，并完成 [NativeScript-Vue 项目配置](./install)。笔记是虚构的，仅保存在内存中；此示例不包含持久化、身份验证或后端。

<Clip name="first-app" caption="在 iOS 26 模拟器中运行 Pocket notes：保留列表搜索条件、使用原生模态编辑器、拒绝取消导航并返回保存结果。演示应用使用同一份教程源码。" />

## 1. 创建文件 {#_1-create-the-files}

安装路由器后，将以下**七个完整文件**放入应用的 `src` 目录。使用这些文件替换初始项目的应用入口和根组件；保留原生资源与构建配置。代码直接引用[可运行的教程源码](https://github.com/rafaelaugustos/vue-router-ns/tree/main/demo/src/tutorial)，所有语言版本共用同一实现。示例应用中的界面文字仍为英文。

```text
src/
  app.ts
  App.vue
  router.ts
  notes.ts
  pages/
    Home.vue
    Note.vue
    Edit.vue
```

根组件中的 `RouterView` 创建一个原生 Frame。每个路由组件渲染一个 Page。不要在这个 RouterView 外再套一层 Frame。

**`src/router.ts`**：`/` 对应列表，`:id` 选择笔记，`modal: true` 为编辑器提供独立的 Frame。`props: true` 将路由参数传给页面。

<<< ../../../demo/src/tutorial/router.ts

**`src/app.ts`**：在启动应用前安装路由器。

<<< ../../../demo/src/tutorial/app.ts

**`src/App.vue`**：保持导航宿主处于挂载状态。

<<< ../../../demo/src/tutorial/App.vue

## 2. 添加数据与列表 {#_2-add-data-and-the-list}

**`src/notes.ts`**：列表、详情和编辑器共享的应用数据。保存操作修改这个响应式数组，不会写入磁盘。

<<< ../../../demo/src/tutorial/notes.ts

**`src/pages/Home.vue`**：`query` 属于当前页面。打开笔记会覆盖 Home，但不会销毁页面或清除搜索条件。

<<< ../../../demo/src/tutorial/pages/Home.vue

这个仅有两项的列表使用普通原生 Button。大型目录应使用虚拟列表。TextField 提供简单的搜索输入；之后可以升级为[原生标题栏搜索](./native-bars)。

## 3. 打开详情并等待结果 {#_3-open-a-detail-and-wait-for-a-result}

**`src/pages/Note.vue`**：`id` 属性属于当前路由条目。`pushForResult<string>` 等待编辑器返回；关闭时没有结果则返回 `undefined`。显式检查结果可保留用户有意保存的空字符串。

<<< ../../../demo/src/tutorial/pages/Note.vue

模态页面打开期间，原详情页仍然挂载。泛型描述这两个页面之间的契约，不会在运行时验证任意数据。

## 4. 保护草稿并保存 {#_4-protect-the-draft-then-save}

**`src/pages/Edit.vue`**：草稿是编辑器的局部状态。只有草稿与已保存的笔记不同时，条件离开守卫才会请求确认。保存时临时允许离开，并通过 `back({ result })` 返回草稿。

<<< ../../../demo/src/tutorial/pages/Edit.vue

**Cancel** 通过守卫请求离开。选择 **Keep editing** 会保留编辑器及其草稿；选择 **Discard** 会关闭编辑器，但不修改笔记。保存操作将值返回详情页，由应用代码更新 `notes`。

离开守卫保护的是页面被移除，而不是被另一个页面覆盖。在 iOS 上，活动守卫会改变哪些手势能够关闭或弹出页面。请查看[守卫的平台行为矩阵](./guards#what-the-platform-does-while-a-guard-is-active)，不要假设所有手势都能等待确认对话框。

## 5. 运行并验证完整流程 {#_5-run-and-check-the-complete-flow}

在已创建的 NativeScript-Vue 项目中运行：

```sh
ns run ios
# or:
ns run android
```

1. 在 **Find a note** 中输入 `coast`。列表中只剩 **Along the coast**。
2. 打开该笔记，点击 **Edit in a modal**。
3. 修改文本。点击 **Cancel → Keep editing**，确认草稿仍然保留。
4. 点击 **Save note**。原详情页显示返回的文本。
5. 使用原生返回操作。Home 中仍有 `coast`，过滤后的列表保持不变。
6. 再次打开编辑器、修改文本，并选择 **Cancel → Discard**。上次保存的文本不变。

如果想运行仓库中的版本，请先完成[仓库检出与资源配置](./native-showcase#run-from-a-checkout)，再从 `demo` 运行 `npm run tutorial:ios` 或 `npm run tutorial:android`。传入 `-- --device <id>` 可选择设备。教程与其他演示入口共用应用 ID，因此安装会替换该设备上的另一版演示应用。

## 下一步 {#what-to-build-next}

现在你已经有了一个保留状态的导航栈、一个模态导航栈、页面局部草稿，以及由应用处理的返回结果。通过[交互式导航栈模型](./mental-model)可以分别观察这些对象的生命周期。

继续学习 [Fieldnotes](./native-showcase)，添加抽屉导航、页面所属的原生搜索、标题栏与菜单共享操作，以及显式的导航焦点管理。如果应用需要其他结构，请选择[标签页或分栏导航](./capabilities)。当状态需要在进程结束后保留时，再添加[持久化存储与恢复](./restore)。
