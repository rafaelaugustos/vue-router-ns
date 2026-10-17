import { Device, isIOS, type View } from '@nativescript/core'

export type MotionPolicy = 'system' | 'full' | 'reduced'
declare const UIAccessibilityIsReduceMotionEnabled: (() => boolean) | undefined
declare const android: any

/** Read at each navigation/gesture, so changing the OS setting needs no restart. */
export function reduceMotion(policy: MotionPolicy = 'system', view?: View): boolean {
  if (policy !== 'system') return policy === 'reduced'
  if (isIOS)
    return (
      typeof UIAccessibilityIsReduceMotionEnabled === 'function' &&
      UIAccessibilityIsReduceMotionEnabled()
    )
  if (typeof android === 'undefined') return false
  if (parseFloat(Device.sdkVersion) >= 26)
    return !android.animation.ValueAnimator.areAnimatorsEnabled()
  const context = view?.nativeViewProtected?.getContext?.()
  return (
    !!context &&
    android.provider.Settings.Global.getFloat(
      context.getContentResolver(),
      'animator_duration_scale',
      1,
    ) === 0
  )
}
