# 学习 vue-router-ns {#learn-vue-router-ns}

使用路线、参数、导航守卫 和结果在 NativeScript-Vue 3 应用程序中构建原生导航。路由器协调真正的原生 导航栈：页面在彼此之下保持活动状态，每个选项卡都可以有自己的历史记录，原生 Back 是导航流的一部分。

<a id="where-to-start"></a>

## 从这里开始 {#start-here}

| 目标                   | 从这里开始                             | 你将获得                                                     |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------ |
| 将路由器添加到应用程序 | [安装](./install)                      | 通过 `RouterView` 呈现的原生 Page                            |
| 通过实践学习           | [第一个应用](./first-app)              | 列表、详细信息页面和受守卫保护的模态编辑器，具有完整的源代码 |
| 了解行为               | [Pages、导航栈 和状态](./mental-model) | 页面生命周期、原生 Back、选项卡和模态页面的所有权的模型      |
| 评估可能性             | [示例库](./examples)                   | 链接到指南、可运行代码和平台限制的实际运行录像               |
| 解决应用程序任务       | [常见任务](./recipes)                  | 到相关 API 的路线及其重要约束                                |

第一个应用程序教程假设基本的 Vue 单文件组件和一个工作的 NativeScript-Vue 项目。在添加结果和 导航守卫 之前先介绍了一个 导航栈。 [Fieldnotes](./native-showcase) 是下一步：抽屉导航、原生搜索、共享操作和相同的状态保留规则。

<a id="what-it-covers"></a>

## 选择导航结构 {#choose-a-navigation-structure}

从一个 `RouterView` 开始。添加 [标签页](./tabs) 用于独立的目标历史记录，添加 [抽屉导航](./drawer) 用于围绕现有内容的菜单，或添加 [列表/详情](./split-view) 用于紧凑/扩展布局。 [模态页面](./modals) 暂时拥有一个单独的 导航栈 并且可以返回一个值。

[容器指南](./capabilities#choose-a-container)解释了支持的组合，包括为什么抽屉导航、原生选项卡侧边栏和UIKit分离控制器是不同的所有者。

## 添加原生体验 {#add-the-native-experience}

将标题和按钮保留在NativeScript的[ActionBar](./native-bars)中。使用 [页面操作](./page-actions) 在标题、菜单和支持的键盘命令之间共享行为。根据流程需要添加 [上下文菜单](./context-menus)、[转场](./transitions)、[焦点和运动行为](./accessibility)。

对于应用程序集成，请继续使用 [深层链接](./deep-links)、[系统选择器](./native-flows)、[状态恢复](./restore) 和[诊断](./diagnostics)。文件约定和实验性集成都有自己的高级指南；显式路由仍为默认值。

<a id="why-not-vue-router-itself"></a>

## 从 Vue Router 迁移 {#coming-from-vue-router}

熟悉的方法名称会有所帮助，但移动应用程序有多个可能的原生 导航栈 和保留页面。在依赖网页生命周期假设之前，先阅读 [差异](./vue-router)，然后阅读 [导航模型](./mental-model)。

该软件包是候选版本。 [兼容性](./compatibility) 标识支持的依赖项、实验性 API 和剩余验证限制。 [API 参考](./api) 是您知道需要系统的哪一部分后的查找索引。
