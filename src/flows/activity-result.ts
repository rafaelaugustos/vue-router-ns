import { Application, type Page } from '@nativescript/core'

declare const android: any
declare const androidx: any

/** Resolve the page's Activity, including ContextThemeWrapper used by modals. */
export function flowActivity(page: Page | undefined): any {
  let context = page?.nativeViewProtected?.getContext?.() ?? page?._context
  const seen = new Set()
  while (context && !seen.has(context)) {
    if (
      typeof context.getActivityResultRegistry === 'function' ||
      (typeof android !== 'undefined' &&
        typeof android.app?.Activity === 'function' &&
        context instanceof android.app.Activity)
    )
      return context
    seen.add(context)
    context = context.getBaseContext?.()
  }
}

/** Register against the originating Activity, rebind the same key after recreation. */
export function launchActivityResult(
  page: Page | undefined,
  key: string,
  intent: unknown,
  result: (code: number, intent: any) => void,
  disposed: () => void,
  failed: (error: unknown) => void,
): () => void {
  let activity = flowActivity(page)
  if (!activity?.getActivityResultRegistry || typeof androidx === 'undefined')
    throw new Error('[vue-router-ns] Native flows require an owning AndroidX Activity')
  let launcher: any
  let ended = false
  let generation = 0
  const events = Application.android
  const stop = () => {
    if (ended) return
    ended = true
    generation++
    events.off('saveActivityState', save)
    events.off('activityCreated', created)
    events.off('activityDestroyed', destroyed)
    launcher?.unregister()
    launcher = undefined
    activity = undefined
  }
  const bind = () => {
    const current = ++generation
    const registered = activity.getActivityResultRegistry().register(
      key,
      new androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult(),
      new androidx.activity.result.ActivityResultCallback({
        onActivityResult(value: any) {
          if (ended || generation !== current) return
          try {
            result(value.getResultCode(), value.getData())
          } catch (error) {
            failed(error)
          } finally {
            stop()
          }
        },
      }),
    )
    if (ended) registered.unregister()
    else launcher = registered
  }
  const save = (args: any) => {
    if (args.activity === activity) args.bundle.putBoolean(key, true)
  }
  const created = (args: any) => {
    if (ended || !args.bundle?.getBoolean(key, false)) return
    activity = args.activity
    try {
      bind()
    } catch (error) {
      stop()
      failed(error)
    }
  }
  const destroyed = (args: any) => {
    if (args.activity !== activity) return
    generation++
    launcher?.unregister()
    launcher = undefined
    if (!activity.isChangingConfigurations()) {
      stop()
      disposed()
    }
  }
  events.on('saveActivityState', save)
  events.on('activityCreated', created)
  events.on('activityDestroyed', destroyed)
  try {
    bind()
    launcher?.launch(intent)
  } catch (error) {
    stop()
    throw error
  }
  return stop
}
