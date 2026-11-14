import { Utils, type NativeWindow } from '@nativescript/core'

/** App-owned setup, iPadOS 17+. A placement preference, not a layout guarantee. */
export function requestAdjacentWindow(
  source: NativeWindow,
  requestId: string,
  onError: (error: NSError) => void,
) {
  const scene = source.ios?.scene as UIWindowScene | undefined
  if (!scene || source.state === 'closed') throw new Error('Source window unavailable')
  const activity = NSUserActivity.alloc().initWithActivityType(
    `${NSBundle.mainBundle.bundleIdentifier}.scene`,
  )
  // Correlation only. No router, credentials, pending Promise or destination policy.
  activity.userInfo = Utils.dataSerialize({ dropWindowRequest: requestId })
  const request = UISceneSessionActivationRequest.requestWithRole(
    UIWindowSceneSessionRoleApplication,
  )
  const options = UIWindowSceneActivationRequestOptions.new()
  options.requestingScene = scene
  options.placement = UIWindowSceneStandardPlacement.standardPlacement()
  request.userActivity = activity
  request.options = options
  UIApplication.sharedApplication.activateSceneSessionForRequestErrorHandler(
    request,
    onError,
  )
}
