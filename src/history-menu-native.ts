import { isAndroid, isIOS, type View } from '@nativescript/core'

interface MenuOptions {
  title: string
  cancelTitle: string
  labels: readonly string[]
  select(index: number): void
  close(): void
}
interface MenuBinding {
  dismiss(): void
}

/** Native fallback for app-owned Back controls, also invokable from the keyboard. */
export function presentHistoryMenu(
  source: View,
  options: MenuOptions,
): MenuBinding | undefined {
  if (isIOS) return presentIOS(source, options)
  if (isAndroid) return presentAndroid(source, options)
}

declare const UIAlertController: any
declare const UIAlertControllerStyle: any
declare const UIAlertAction: any
declare const UIAlertActionStyle: any

function presentIOS(source: View, options: MenuOptions): MenuBinding | undefined {
  const presenter = source.page?.ios
  if (!presenter?.view?.window || presenter.presentedViewController || !source.ios) return
  const sheet = UIAlertController.alertControllerWithTitleMessagePreferredStyle(
    options.title,
    null,
    UIAlertControllerStyle.ActionSheet,
  )
  let dismissed = false
  const finish = (callback?: () => void) => {
    if (dismissed) return
    dismissed = true
    // Finish UIKit's dismissal before asking the router to pop its owning Page.
    sheet.dismissViewControllerAnimatedCompletion(true, callback ?? null)
  }
  options.labels.forEach((label, index) =>
    sheet.addAction(
      UIAlertAction.actionWithTitleStyleHandler(label, UIAlertActionStyle.Default, () =>
        finish(() => options.select(index)),
      ),
    ),
  )
  sheet.addAction(
    UIAlertAction.actionWithTitleStyleHandler(
      options.cancelTitle,
      UIAlertActionStyle.Cancel,
      () => finish(options.close),
    ),
  )
  const popover = sheet.popoverPresentationController
  if (popover) {
    popover.sourceView = source.ios
    popover.sourceRect = source.ios.bounds
  }
  presenter.presentViewControllerAnimatedCompletion(sheet, true, null)
  return { dismiss: () => finish() }
}

declare const android: any

function presentAndroid(source: View, options: MenuOptions): MenuBinding | undefined {
  const anchor = source.android
  if (!anchor?.getWindowToken?.()) return
  const popup = new android.widget.PopupMenu(anchor.getContext(), anchor)
  options.labels.forEach((label, index) => popup.getMenu().add(0, index, index, label))
  let dismissed = false
  let selected = false
  const dismiss = () => {
    if (dismissed) return
    dismissed = true
    popup.dismiss()
  }
  popup.setOnMenuItemClickListener(
    new android.widget.PopupMenu.OnMenuItemClickListener({
      onMenuItemClick(item: { getItemId(): number }) {
        if (dismissed) return true
        selected = true
        dismiss()
        options.select(item.getItemId())
        return true
      },
    }),
  )
  popup.setOnDismissListener(
    new android.widget.PopupMenu.OnDismissListener({
      onDismiss() {
        dismissed = true
        if (!selected) options.close()
      },
    }),
  )
  popup.show()
  return { dismiss }
}
