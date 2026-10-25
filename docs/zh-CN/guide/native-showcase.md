# Fieldnotes：集成的原生导航示例 {#fieldnotes-an-integrated-native-navigation-example}

刚接触路由器？从 [袖珍笔记](./first-app) 开始，然后使用本指南来编写原生功能。有关生命周期模型，请参阅 [pages、导航栈 和 state](./mental-model)。

<Clip name="native-showcase" aspect="402 / 874" caption="实际 iOS 26 模拟器：抽屉导航、原生搜索和菜单、共享标题操作、模态结果、未保存编辑 导航守卫 并返回保留列表。" />

Fieldnotes 是一个小型、可运行的列表/详细信息应用程序。 抽屉导航 开通目的地；原生页面标题和搜索引导到注释中；标题和上下文菜单操作共享状态；编辑器保护未保存的更改；原生模式将结果返回到相同的详细信息页面。

它使用公共路由器 API 和 **0.1.0-rc.3**。之前的 rc.2 已经提供了原生标题、iOS 大标题、搜索、上下文菜单、导航守卫、模态结果和导航焦点。这里使用的 iOS 抽屉导航 和共享页面操作是 rc.3 的新增内容。构建此结账以运行完整的示例；单独安装 rc.2 并不能提供这些附加功能。

## 从结账处运行 {#run-from-a-checkout}

使用 [NativeScript setup](https://docs.nativescript.org/setup/) 安装 NativeScript CLI 和平台 SDK。从存储库根目录：

```sh
npm ci
npm run build

# Generate native resources once; App_Resources is ignored by Git.
if [ ! -d demo/App_Resources ]; then
  showcase_resources=$(mktemp -d)
  ns create showcase-resources --template @nativescript/template-blank-ts --path "$showcase_resources"
  cp -R "$showcase_resources/showcase-resources/App_Resources" demo/App_Resources
fi

cd demo
npm install
npm run showcase:ios
# or:
npm run showcase:android
```

这些脚本选择`--env.showcase`；邮件演示仍然是默认条目。两者都使用 `org.nativescript.vuerouterns`，因此在所选设备上安装一个会替换另一个。通过 `-- --device <id>` 选择模拟器/仿真器。测试的基线是Core 9.1.3、NativeScript-Vue 3.1.2、iOS运行时9.1.0和Android运行时9.1.1。

## 遵循完整流程 {#follow-the-complete-flow}

1. 打开**菜单→关于本例**，然后**返回库**。当导航提交时，覆盖层关闭。 抽屉导航 本身不添加历史记录条目。
2. 点击 **Search**，输入 `coast`，然后按住匹配的卡片。选择**星注**。该操作属于该项目，而不是目录中的其他注释。
3. 开**沿海**。其标头显示 **Unstar**，因为上下文操作更改了相同的内存中注释。切换标题操作，或按住详细信息卡以使用其共享的原生菜单。
4. 在模式中点击 **审阅 → 标记为已审阅**。该工作表关闭，原始详细信息页面显示 **今天已审核**。取消稍后的审核会保留之前的值不变。
5. 打开**Edit**，更改注释，然后使用原生Back。选择**继续编辑**。打开 抽屉导航 并尝试 **Library**：相同的 导航守卫 保护该离开，拒绝使 抽屉导航 保持打开状态。关闭窗格，然后关闭 **Save**。
6. 从详细信息返回到列表。原始列表页面及其`coast`查询保留；搜索不会自动重新打开键盘。

样本笔记是虚构的，仅存储在内存中。保存内存中注释的更新；这不是云同步或重新启动后的持久性。列表查询属于保留列表Page；该草稿属于编辑Page。要在进程终止后保留，请添加应用程序存储并选择加入 [页面状态恢复](./restore)。

## 每个功能所在的位置 {#where-each-feature-lives}

| 来源 `demo/src/showcase`                                                                                                         | 责任                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`App.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/App.vue)                                 | 1个`RouterDrawer`围绕1个`RouterView`。库显式返回根；关于推送路线。抽屉选择不会创建第二个导航实现。                        |
| [`router.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/router.ts)                             | 惰性列表/详细信息/编辑/关于路线和原生模态路线。                                                                           |
| [`pages/Library.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Library.vue)             | 原生 `ActionBar`、`iosLargeTitle`、`useNativeSearch`、页面拥有的查询和原生 ScrollView。导航使搜索集成能够管理其生命周期。 |
| [`components/NoteCard.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/components/NoteCard.vue) | 可访问的原生“打开”按钮以及特定于项目的上下文菜单。稳定的键使动作所有权与正确的音符相关联。                                |
| [`pages/Note.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Note.vue)                   | `usePageActions` 由 `PageActionItem` 和原生菜单共享；键入的模态结果；焦点返回目标。                                       |
| [`pages/Edit.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Edit.vue)                   | Page - 本地草稿，有条件离开 导航守卫 和原生确认对话框。返回之前保存更新的应用程序数据。                                   |
| [`pages/Review.vue`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/pages/Review.vue)               | 原生模态 Page，取消和 `back({ result })`。                                                                                |
| [`state.ts`](https://github.com/rafaelaugustos/vue-router-ns/blob/main/demo/src/showcase/state.ts)                               | 小虚构目录和共享 抽屉导航 ref。它不拥有本土历史。                                                                         |

该应用程序有一个原生 Frame 导航栈。 About是导航栈中的一个路由，不是一个独立的选项卡。如果需要独立的目标历史记录，请按照 [容器选择](./capabilities) 中的说明在选项卡中组合命名框架。运行此示例不需要自适应 抽屉导航、诊断可视化和转换适配器。

## 原生演示和可访问的替代方案 {#native-presentation-and-accessible-alternatives}

在 iOS 上，`iosLargeTitle` 使用实际的 UIKit 导航栏和原生滚动内容，而 `useNativeSearch` 安装页面拥有的搜索控制器。 Android 保留其正常的工具栏，并在标题区域暂时呈现原生 SearchView。该示例不会绘制假的折叠 Android 大标题或替换原生 导航栈 来模仿过渡。

每条路线仍然可以通过原生按钮到达。卡片有一个明确的“打开”按钮；上下文操作也可以在详细信息标题上或通过其“审阅”按钮使用。 `useNavigationFocus` 声明列表/详细信息/模式导航的初始标题和返回目标。 抽屉导航 提供其现有的可访问性隔离和恢复。该应用程序请求默认的系统动作策略，无需额外的自定义动作。

三卡 ScrollView 使示例保持较小。使用大型目录的虚拟化列表并重新测试行重用/菜单所有权和任何缩放源。这个例子特意使用了正常的转换； [交互式转换限制](./interactive-transitions) 仍然适用。

## 验证和记录 {#validation-and-recordings}

参见[native验收报告](https://github.com/rafaelaugustos/vue-router-ns/blob/main/test/native-showcase.md)和[复制脚本](https://github.com/rafaelaugustos/vue-router-ns/tree/main/scripts/native/showcase)。它们区分真实的 UI 输入、基于诊断的身份检查、记录的平台和手动可访问性边界。仅成功的构建并不能证明导航或焦点有效。

可选的 `--env.showcaseTest` 条目运行 **相同的应用程序** 并写入有界诊断快照以供接受。普通`--env.showcase`不包括轮询/文件桥；两者都不包含在路由器包装中。
