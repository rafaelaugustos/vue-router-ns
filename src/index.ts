import type { RegisteredRouter } from './typed.js'
import type { RouteLocation } from './types.js'

export { createRouter, START_LOCATION } from './router.js'
export type { Router, RouterOptions } from './router.js'
export type {
  DiagnosticsOptions,
  RouterDiagnostics,
  DiagnosticsExport,
  DiagnosticSnapshot,
  DiagnosticStack,
  DiagnosticHost,
  DiagnosticEntry,
  DiagnosticIssue,
  DiagnosticIssueCode,
  DiagnosticEvent,
  DiagnosticPhase,
  DiagnosticOutcome,
} from './diagnostics.js'

export {
  useRouter,
  useRoute,
  onBeforeRouteLeave,
  onPageActivated,
  onPageDeactivated,
  useBackGesture,
} from './composables.js'
export type { LeaveGuardOptions } from './composables.js'
export { useNativeSearch } from './search.js'
export type { NativeSearch, NativeSearchOptions } from './search.js'
export { useNavigationCommands } from './commands.js'
export type {
  NavigationCommands,
  NavigationCommand,
  NavigationCommandState,
  NavigationShortcut,
  KeyModifier,
} from './commands.js'
export { NavigationCommandScope } from './components/NavigationCommandScope.js'

export type { BackGesture, BackGestureEdge } from './android.js'

export { RouterSplitView } from './components/RouterSplitView.js'
export { RouterView } from './components/RouterView.js'
export { RouterLink } from './components/RouterLink.js'
export { Deferred } from './components/Deferred.js'

export { NavigationFailureType, isNavigationFailure } from './errors.js'
export type { NavigationFailure } from './errors.js'

export type {
  Register,
  RegisteredRouter,
  RouteMapFrom,
  RouteMapGeneric,
  RouteNames,
  RouteLocationOf,
  RouteLocationRawOf,
  ParamsFromPath,
} from './typed.js'

export type * from './types.js'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $router: RegisteredRouter
    /** Inside a page, that page's route. */
    $route: RouteLocation
  }

  interface GlobalComponents {
    NavigationCommandScope: typeof import('./components/NavigationCommandScope.js').NavigationCommandScope
    RouterSplitView: typeof import('./components/RouterSplitView.js').RouterSplitView
    RouterView: typeof import('./components/RouterView.js').RouterView
    RouterLink: typeof import('./components/RouterLink.js').RouterLink
    Deferred: typeof import('./components/Deferred.js').Deferred
  }
}
