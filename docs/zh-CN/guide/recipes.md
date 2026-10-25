# 常见应用程序任务 {#common-application-tasks}

从应用程序需要执行的操作开始。这些路径导致工作模式，然后是 API 详细信息和平台限制。对于完整运行的应用程序，请使用 [示例库](./examples)。

| 我想要...                    | 使用此图案                                                              | 发货前检查                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 打开明细，返回同一个列表     | [第一应用](./first-app)、`push` / `back`                                | 在保留列表页中保留查询状态； [可见性未安装](./mental-model#visibility-is-different-from-mounting) |
| 丢弃修改前请求确认           | [条件离开守卫](./guards#leave-guards)                                   | 仅在有未保存修改时激活；守卫活动期间禁用 iOS 滑动返回                                             |
| 返回选定或编辑的值           | [`pushForResult` 和 `back({ result })`](./modals#getting-a-result-back) | 取消处理 `undefined`；通用 `T` 不是运行时验证                                                     |
| 需要在目的地                 | [Global 或路由 导航守卫](./guards)                                      | 之前登录 重定向到允许的路由；离开 导航守卫 不会仅仅因为推送另一个页面而运行                       |
| 为顶级目标保留单独的历史记录 | [在选项卡中命名为 导航栈](./tabs)                                       | 单独的 抽屉导航 不会为每个菜单项创建一个 导航栈                                                   |
| 保持菜单在宽窗口中可见       | [自适应 抽屉导航](./drawer#adaptive-presentation)                       | 测量容器宽度；永久窗格可见性与覆盖层 `open` 不同                                                  |
| 列表和明细一起显示           | [分体导航](./split-view)                                                | 选择Frame分体或UIKit分体；遵循记录的根/容器约束                                                   |
| 在标题和菜单之间共享操作     | [Page 操作](./page-actions)                                             | 该应用程序仍然拥有业务操作、确认和权限                                                            |
| 在保留页面内搜索             | [原生搜索](./native-bars#search-owned-by-a-page)                        | 搜索查询是应用程序状态；打字不添加导航条目                                                        |
| 从操作系统链接打开目标       | [深层链接](./deep-links)                                                | 配置原生清单/权利、路由映射和目标 导航栈                                                          |
| 接收图像或系统文档           | [原生流](./native-flows)                                                | 区分取消与失败并尊重页面/窗口所有权                                                               |
| 操作系统杀死应用程序后恢复   | [状态恢复](./restore)                                                   | 保留可序列化的应用程序状态； JavaScript 承诺无法在进程死亡后继续存在                              |
| 模态后返回可访问焦点         | [导航焦点](./accessibility)                                             | 提供稳定的原生目标 ID 并使用实际辅助技术进行测试                                                  |
| 解释导航失败或缓慢           | [Diagnostics](./diagnostics) 和 [报告查看器](./diagnostics-viewer)      | 从受影响的应用程序导出；合成样本报告不是设备基准                                                  |

## 选择下一个详细级别 {#choose-the-next-level-of-detail}

- **学习完整流程：** [首先应用](./first-app)，然后[Fieldnotes](./native-showcase)。
- **查找可复制的原生模式：** [功能食谱](./demo)。
- **查找方法或类型：** [API参考](./api)。
- **决定某个能力是否适合平台：** [能力图](./capabilities)和[兼容性](./compatibility)。

## 当可选功能有帮助时 {#when-optional-features-help}

[文件路由](./file-routing)可以替代大型显式路由表； [layouts](./layouts) 和 [middleware](./middleware) 组织共享约定。 [路由加载器](./data-loading)、[native Suspense](./suspense)、[windows](./windows)和自定义主机/目标在标记处仍处于实验状态。在基本导航流程运行后，根据具体的应用程序需求添加它们。
