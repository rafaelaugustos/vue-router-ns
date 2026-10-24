# Common application tasks

Start with what the application needs to do. These paths lead to a working pattern, then the API details and platform constraints. For complete running apps, use the [example gallery](./examples).

| I want to…                                         | Use this pattern                                                         | Check before shipping                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Open a detail and return to the same list          | [First app](./first-app), `push` / `back`                                | Keep query state in the retained list page; [visibility is not mounting](./mental-model#visibility-is-different-from-mounting) |
| Ask before losing an edit                          | [Conditional leave guard](./guards#leave-guards)                         | Activate only while dirty; iOS swipe-back is disabled while the guard is active                                                |
| Return a selected or edited value                  | [`pushForResult` and `back({ result })`](./modals#getting-a-result-back) | Handle `undefined` for cancellation; generic `T` is not runtime validation                                                     |
| Require login before a destination                 | [Global or route guards](./guards)                                       | Redirect to an allowed route; a leave guard does not run just because another page is pushed                                   |
| Keep separate histories for top-level destinations | [Named stacks in tabs](./tabs)                                           | A drawer alone does not create one stack per menu item                                                                         |
| Keep a menu visible in a wide window               | [Adaptive drawer](./drawer#adaptive-presentation)                        | Measure the container width; permanent pane visibility differs from overlay `open`                                             |
| Show list and detail together                      | [Split navigation](./split-view)                                         | Choose Frame split or UIKit split; follow the documented root/container constraints                                            |
| Share an action between header and menu            | [Page actions](./page-actions)                                           | The app still owns business operations, confirmations and permissions                                                          |
| Search within a retained page                      | [Native search](./native-bars#search-owned-by-a-page)                    | Search query is application state; typing does not add navigation entries                                                      |
| Open a destination from an OS link                 | [Deep links](./deep-links)                                               | Configure the native manifest/entitlements, route mapping and target stack                                                     |
| Receive an image or system document                | [Native flows](./native-flows)                                           | Distinguish cancellation from failure and respect page/window ownership                                                        |
| Recover after the OS kills the app                 | [State restoration](./restore)                                           | Persist serializable app state; JavaScript Promises do not survive process death                                               |
| Return accessible focus after a modal              | [Navigation focus](./accessibility)                                      | Provide stable native target IDs and test with actual assistive technology                                                     |
| Explain a failed or slow navigation                | [Diagnostics](./diagnostics) and [report viewer](./diagnostics-viewer)   | Export from the affected app; synthetic sample reports are not device benchmarks                                               |

## Choose the next level of detail

- **Learn a full flow:** [first app](./first-app), then [Fieldnotes](./native-showcase).
- **Find copyable native patterns:** [feature cookbook](./demo).
- **Look up a method or type:** [API reference](./api).
- **Decide whether a capability fits a platform:** [capability map](./capabilities) and [compatibility](./compatibility).

## When optional features help

[File routes](./file-routing) can replace a large explicit route table; [layouts](./layouts) and [middleware](./middleware) organize shared conventions. [Route loaders](./data-loading), [native Suspense](./suspense), [windows](./windows) and custom hosts/destinations remain experimental where marked. Add them for a concrete application requirement after the basic navigation flow is working.
