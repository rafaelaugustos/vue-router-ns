# 应用程序被杀死后恢复导航栈 {#restoring-the-stack-after-the-app-is-killed}

Android 始终在后台杀死应用程序，并将原生应用程序带回其所在的屏幕上，其背面为 导航栈。这里的每个页面都是一个路径，因此 导航栈 是一个字符串列表，路由器可以为您保存它：

```ts
import { ApplicationSettings } from '@nativescript/core'

const router = createRouter({
  routes,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
})
```

<Clip name="android-restore" aspect="9 / 20" caption="演示进入后台后，会返回键入的名称，其进程被终止，然后再次打开。 Android 16 模拟器。" />

`save` 在每次导航后以及应用程序转到后台时运行，其中包含每个名为 `<RouterView>` 的路径，以及当应用程序自行退出时使用 `null`，因此用户离开后的新开始保持新鲜感。当 `<RouterView>` 安装时，路由器会询问 `load` 一次（可以是异步的），并通过 导航守卫 重建保存的 导航栈 而无需动画，因此需要会话的页面仍会将您发送到登录。

早于 `maxAge`（默认 30 分钟）的保存将被忽略；通过 `Infinity` 始终恢复。

## 什么不能回来 {#what-can-t-come-back}

模态框，`props` 穿过 `push`。依赖它们的页面应该通过读取其参数来应对它们的缺失。如果保存的路径不再与任何路线匹配，例如更新后，导航栈 将从 `initial` 开始。

## 格式和限制 {#format-and-limits}

`SavedStacks` 的形状为 `{ version: 2, savedAt: number, stacks: Record<string, string[]>, entries: Record<string, SavedEntry[]> }`。 `savedAt` 是以毫秒为单位的时间戳。保持 导航栈 名称稳定；拆分视图将列表和详细信息保存为一个 导航栈。 `load()` 每个路由器实例运行一次，每个视图在安装时恢复其 导航栈。

恢复从路径重新创建页面。它本身不保存本地引用、滚动偏移或任意对象；页面保留那些带有 [`usePageState()`](#page-state) 的内容。 `maxAge` 属于 `restore` 内部，例如 `restore: { save, load, maxAge: Infinity }`。

## Page 状态 {#page-state}

路径将页面带回；用户拥有什么是另一回事。如果页面说明了要保留的内容，则草稿、阅读位置或选择也可以返回：

```ts
import { usePageState } from 'vue-router-ns'

const body = ref('')
usePageState('draft', {
  save: () => (body.value ? { body: body.value } : undefined),
  restore: (value) => (body.value = value.body),
})
```

`save` 在每次导航后以及应用程序转到后台时运行，并且必须返回小型、JSON 兼容的数据：没有原生视图、闭包或承诺。返回 `undefined` 不保留任何内容，这就是页面留下敏感草稿的方式。 `restore` 在页面的原生视图加载后运行一次，并保留 `save` 的内容；它接收保存时使用的版本和原生 `Page`，以防滚动偏移必须等待布局。只想知道它回来的页面可以在 `restore` 内设置一个标志。

每个页面都会获得一个稳定的密钥，保存在其路径旁边，因此同一路径上的两个页面都会恢复自己的状态。 `SavedStacks.entries` 中的按键和状态行程，与 `stacks` 对齐； `version: 2` 格式仍然加载仅路径保存，它根本没有状态。

### 版本和迁移 {#versions-and-migrations}

当形状改变时，给它一个 `version` ，并给一个 `migrate` 来将旧的保存提前：

```ts
usePageState('draft', {
  version: 2,
  save: () => ({ subject: subject.value, body: body.value }),
  restore: (value) => Object.assign(form, value),
  migrate: (old, version) =>
    version === 1 ? { subject: '', body: (old as { text: string }).text } : undefined,
})
```

另一个版本的保存经过`migrate`；如果没有，或者当它返回 `undefined` 时，页面会重新开始。开发中报告了抛出的 `restore` 或 `migrate` ，并且页面也重新开始。

### 重命名和删除路线 {#renamed-and-removed-routes}

Page 状态 `migrate` 更改钩子的数据形状。它不会重命名路线。保存的历史记录包含路径，因此仅更改路线名称不会更改其保存位置。当路径更改时，在返回快照之前将其转换为 `restore.load`：

```ts
import type { SavedStacks } from 'vue-router-ns'

function migratePaths(saved: SavedStacks | null): SavedStacks | null {
  if (!saved) return null
  return {
    ...saved,
    stacks: Object.fromEntries(
      Object.entries(saved.stacks).map(([name, paths]) => [
        name,
        paths.map((path) => (path === '/legacy-edit' ? '/edit' : path)),
      ]),
    ),
  }
}

// Inside restore:
// load: () => migratePaths(JSON.parse(ApplicationSettings.getString('stacks', 'null')))
```

此示例仅映射该确切路径。为应用程序的旧 URL 显式处理参数/查询字符串。保持条目顺序和 `entries` 对齐：两个 `/legacy-edit` 条目仍然保留其单独的密钥和草稿。如果删除或重新排序路径，请在相同索引处转换其相应条目。保留 `savedAt`，以便迁移不会恢复过期状态，并保留 `windowKey`，以便不同的窗口无法使用它。

如果没有显式迁移，则不可用路径会将 导航栈 重置为其 `initial` 路由。恢复期间警卫仍在运行。如果 导航守卫 将保存的页面重定向到其他路径，则其草稿不会传输到重定向的页面。对于注销，清除应用程序存储的快照和敏感数据以及强制授权导航守卫； 导航守卫 不是存储擦除机制。

### 应用程序拥有什么 {#what-stays-app-owned}

- 无法生存 `JSON.stringify` 的状态将在开发过程中被删除并发出警告，状态超过 `restore.stateLimit`（默认情况下为 8 KiB）的页面也是如此。
- 在其他地方恢复的页面，因为 导航守卫 重定向了它，留下了它保存的状态：状态遵循路径。
- `pushForResult()` 承诺不会在进程死亡后继续存在。正在等待的页面返回时没有返回；稍后需要答案的流程应该将其保存在自己的存储中，或者保存在询问页面的状态中。
- 模态未恢复。坚持并自行重新选择活动选项卡。窗口范围的快照带有 `windowKey`，但应用程序必须提供稳定的文档密钥并将其重新连接到正确的原生窗口；请参见 [native windows](#native-windows)。

## 原生窗口 {#native-windows}

在 Core 9.1.3+ 上，绑定到 `NativeWindow` 的路由器接收 `save(state, context)` 和 `load(context)` 中的窗口上下文。使用`restore.key`和`context.key`来分离快照。在这种模式下，进程退出会保留历史记录；关闭窗口仅保存该窗口的 `null`。上面的退出时清除行为适用于没有所属窗口的传统模式。有关引导和限制，请参阅 [native windows](./windows#persistence-by-window)。

### 所有权和经过验证的行为 {#ownership-and-validated-behavior}

| 数据                                           | 所有者                                              |
| ---------------------------------------------- | --------------------------------------------------- |
| 命名 导航栈 路径、稳定的输入键和选择的页面状态 | 路由器快照，由您的 `save` 回调保留。                |
| Page 状态架构迁移                              | 每个 `usePageState` 挂钩的 `version` 和 `migrate`。 |
| 路径迁移、帐户更改和存储清理                   | 您的应用程序的 `load`/存储策略。                    |
| 选定的选项卡和窗口/文档标识                    | 您的应用程序；每个文档使用独立的快照键。            |
| 待处理的模式/结果承诺和原生对象                | 未持久化。从应用程序数据重建可恢复的工作。          |

可运行的原生示例：[`state-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/state-app.ts) (`--env.stateTest`) 涵盖重复草稿和滚动位置、模式迁移、到期、删除路线和注销； [`windows-app.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/testing/windows-app.ts) (`--env.windowsTest`) 在独立窗口中恢复重复的草稿和输入键。在构建它们之前，请按照演示设置和 [窗口资源准备](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/windows) 进行操作。

所需的 CI 验证 API 34/36 上的真正 Android 进程死亡和原始任务恢复，以及 iPadOS 18.6 上新进程中的原始 UIKit 场景重建。 [验收报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-page-state.md) 将此与普通后台恢复和同进程重新连接区分开来。这些是仿真器/模拟器的结果；窗口所有权仍处于试验阶段，其 [平台限制](./windows#original-tasks-and-scene-sessions) 仍然适用。
