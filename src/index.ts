import type { RegisteredRouter } from './typed.js'
import type { RouteLocation } from './types.js'

export { createRouter, START_LOCATION } from './router.js'
export type { Router, RouterOptions, SystemBackClaimant } from './router.js'
export { defineRouteMiddleware } from './middleware.js'
export type {
  RouteMiddleware,
  RouteMiddlewareOptions,
  RouteMiddlewareReference,
} from './middleware.js'
export { navigateTo, useNavigateTo } from './navigation.js'
export type { NavigateTo, NavigateToOptions } from './navigation.js'
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
export { getWindowRoute } from './windows.js'
export type { RouterWindow, OpenWindowOptions } from './windows.js'

export {
  useRouter,
  useRoute,
  onBeforeRouteLeave,
  onPageActivated,
  onPageDeactivated,
  useBackGesture,
} from './composables.js'
export type { LeaveGuardOptions } from './composables.js'
export { useNativeHost } from './composables.js'
export { usePageState } from './page-state.js'
export { defineNativeDestination } from './native-destinations.js'
export type {
  NativeDestinationContext,
  NativeDestinationInstance,
  NativeDestinationOptions,
} from './native-destinations.js'
export { supportsShortcuts, supportsPinnedShortcuts } from './shortcuts.js'
export { useNativeFlow, startNativeFlow } from './native-flows.js'
export type {
  NativeFlow,
  NativeFlowContext,
  NativeFlowHandle,
  NativeFlowOutcome,
  NativeFlowRunOptions,
} from './native-flows.js'
export { createDocumentPicker } from './flows/document-picker.js'
export type {
  DocumentPickerInput,
  DocumentPickerResult,
} from './flows/document-picker.js'
export type { RouteShortcut } from './shortcuts.js'
export type {
  IncomingLink,
  InitialLinkRequest,
  LinkWindow,
  LinkIgnoredReason,
  LinkListener,
  LinkOptions,
  LinkResult,
  LinkSource,
  LinksOptions,
} from './links.js'
export type { PageStateOptions, PageStateContext } from './page-state.js'
export { vRoutePreview, attachRouteMenu, detachRouteMenu } from './context-menu.js'
export { RouterTabs, RouterTab, supportsNativeTabs } from './tabs-host.js'
export type { RouterTabDescriptor, TabMinimize, TabRole } from './tabs-host.js'
export type {
  RouteMenuAction,
  RouteMenuOptions,
  RoutePreviewOptions,
} from './context-menu.js'
export { useNativeSearch } from './search.js'
export type { NativeSearch, NativeSearchOptions, SearchBarPlacement } from './search.js'
export { useNavigationCommands } from './commands.js'
export type {
  NavigationCommands,
  NavigationCommand,
  NavigationCommandState,
  NavigationShortcut,
  KeyModifier,
} from './commands.js'
export { NavigationCommandScope } from './components/NavigationCommandScope.js'
export { useNavigationFocus } from './accessibility.js'
export type {
  NavigationFocus,
  NavigationFocusOptions,
  NavigationFocusTarget,
} from './accessibility.js'
export type { MotionPolicy } from './motion.js'

export type { BackGesture, BackGestureEdge, BackGestureSession } from './android.js'
export type { BackPreview } from './back-preview.js'

export { NATIVE_HOST_VERSION } from './host.js'
export type {
  NativeHost,
  NativeHostBackOptions,
  NativeHostCapabilities,
  NativeHostDelegate,
  NativeHostHandle,
  NativeHostPart,
  NativeHostPushOptions,
  NativeHostRole,
  NativeHostVersion,
} from './host.js'
export { createFrameHost } from './hosts/frame.js'
export type { FrameHostOptions } from './hosts/frame.js'
export { createSplitFrameHost } from './hosts/split.js'
export type { SplitFrameHostOptions, SplitFrames } from './hosts/split.js'
export { mountNativeHost } from './hosts/mount.js'
export { supportsBottomSheets } from './hosts/bottom-sheet.js'

export { RouterSplitView } from './components/RouterSplitView.js'
export { RouterUIKitSplitView } from './components/RouterUIKitSplitView.js'
export { supportsUIKitSplitView, type UIKitSplitView } from './uikit-split.js'
export type { UIKitSplitFrames } from './hosts/uikit-split.js'
export { RouterDrawer } from './drawer.js'
export type { RouterDrawerHandle } from './drawer.js'
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
    RouterUIKitSplitView: typeof import('./components/RouterUIKitSplitView.js').RouterUIKitSplitView
    RouterSplitView: typeof import('./components/RouterSplitView.js').RouterSplitView
    RouterDrawer: typeof import('./drawer.js').RouterDrawer
    RouterView: typeof import('./components/RouterView.js').RouterView
    RouterLink: typeof import('./components/RouterLink.js').RouterLink
    Deferred: typeof import('./components/Deferred.js').Deferred
  }
}
