# Learn vue-router-ns

Build native navigation in a NativeScript-Vue 3 app using routes, params, guards and results. The router coordinates real native stacks: pages remain alive underneath each other, each tab can have its own history, and native Back is part of the navigation flow.

<a id="where-to-start"></a>

## Start here

| Your goal                  | Start with                                | What you will have                                                  |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Add the router to an app   | [Installation](./install)                 | A native Page rendered through `RouterView`                         |
| Learn by building          | [Your first app](./first-app)             | A list, detail page and guarded modal editor, with complete source  |
| Understand the behavior    | [Pages, stacks and state](./mental-model) | A model for page lifetime, native Back, tabs and modal ownership    |
| Evaluate the possibilities | [Example gallery](./examples)             | Real recordings linked to guides, runnable code and platform limits |
| Solve an application task  | [Common tasks](./recipes)                 | A route to the relevant API and its important constraints           |

The first-app tutorial assumes basic Vue single-file components and a working NativeScript-Vue project. It introduces one stack before adding results and guards. [Fieldnotes](./native-showcase) is the next step: drawer, native search, shared actions and the same state-retention rules.

<a id="what-it-covers"></a>

## Choose a navigation structure

Start with one `RouterView`. Add [tabs](./tabs) for independent destination histories, a [drawer](./drawer) for a menu around existing content, or [list/detail](./split-view) for a compact/expanded layout. A [modal](./modals) temporarily owns a separate stack and can return a value.

The [container guide](./capabilities#choose-a-container) explains supported combinations, including why a drawer, a native tab sidebar and a UIKit split controller are different owners.

## Add the native experience

Keep titles and buttons in NativeScript's [ActionBar](./native-bars). Use [page actions](./page-actions) to share behavior between headers, menus and supported keyboard commands. Add [context menus](./context-menus), [transitions](./transitions), [focus and motion behavior](./accessibility) as the flow needs them.

For application integration, continue with [deep links](./deep-links), [system pickers](./native-flows), [state restoration](./restore) and [diagnostics](./diagnostics). File conventions and experimental integrations have their own advanced guides; explicit routes remain the default.

<a id="why-not-vue-router-itself"></a>

## Coming from Vue Router

Familiar method names help, but a mobile app has several possible native stacks and retained pages. Read [the differences](./vue-router), then the [mental model](./mental-model), before relying on web page-lifetime assumptions.

The package is a release candidate. [Compatibility](./compatibility) identifies the supported dependencies, experimental APIs and remaining validation limits. The [API reference](./api) is the lookup index once you know which part of the system you need.
