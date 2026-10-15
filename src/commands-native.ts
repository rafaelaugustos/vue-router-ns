import { GridLayout, isIOS, type View } from '@nativescript/core'
import type { NavigationCommandState } from './commands.js'

type Binding = Omit<NavigationCommandState, 'enabled'>
interface Dispatch {
  list(editing: boolean): readonly Binding[]
  dispatch(id: string): void
  escape(): boolean
}
export interface NativeCommandsHost {
  focus(): boolean
  dispose(): void
}
declare const UIView: any
declare const UIKeyCommand: any
declare const NSMutableArray: any
declare const interop: any
declare const android: any
declare const androidx: any
let Responder: any

/** A native layout ancestor puts commands on the actual focused responder chain. */
export class CommandLayout extends GridLayout {
  override createNativeView(): any {
    if (!isIOS || typeof UIView === 'undefined') return super.createNativeView()
    Responder ??= UIView.extend(
      {
        get canBecomeFirstResponder() {
          return true
        },
        get keyCommands() {
          return (this as any).routerKeys?.() ?? null
        },
        'routerCommand:'(this: any, sender: any) {
          this.routerDispatch?.(String(sender.propertyList))
        },
        canPerformActionWithSender(this: any, action: string, sender: any) {
          if (action === 'routerCommand:')
            return !!this.routerEnabled?.(String(sender?.propertyList))
          return this.super.canPerformActionWithSender(action, sender)
        },
      },
      {
        name: 'VueRouterCommandResponder',
        exposedMethods: {
          'routerCommand:': { returns: interop.types.void, params: [interop.types.id] },
        },
      },
    )
    return Responder.new()
  }
}

const flags = { shift: 1 << 17, ctrl: 1 << 18, alt: 1 << 19, meta: 1 << 20 }
const iosInputs: Record<string, string> = {
  Escape: '\u001b',
  ArrowUp: '\uf700',
  ArrowDown: '\uf701',
  ArrowLeft: '\uf702',
  ArrowRight: '\uf703',
  Enter: '\r',
  Tab: '\t',
}
function firstResponder(view: any): any {
  if (view.isFirstResponder) return view
  const children = view.subviews
  for (let i = 0; i < (children?.count ?? 0); i++) {
    const found = firstResponder(children.objectAtIndex(i))
    if (found) return found
  }
}
function iosEditing(native: any): boolean {
  const responder = native.window && firstResponder(native.window)
  return !!responder && typeof responder.insertText === 'function'
}

export function bindCommands(view: View, dispatch: Dispatch): NativeCommandsHost {
  const native = view.nativeViewProtected
  if (isIOS && native && typeof UIKeyCommand !== 'undefined') {
    const available = () => {
      const responder = native.window && firstResponder(native.window)
      return responder?.markedTextRange ? [] : dispatch.list(iosEditing(native))
    }
    native.routerKeys = () => {
      // Return an Objective-C array. UIKit retains/enumerates these outside
      // the JS call; a runtime adapter around a temporary JS array is unsafe.
      const result = NSMutableArray.new()
      for (const command of available()) {
        const mask = (command.shortcut.modifiers ?? []).reduce(
          (value, key) => value | flags[key],
          0,
        )
        const key =
          UIKeyCommand.commandWithTitleImageActionInputModifierFlagsPropertyList(
            command.title,
            null,
            'routerCommand:',
            iosInputs[command.shortcut.input] ?? command.shortcut.input.toLowerCase(),
            mask,
            command.id,
          )
        key.discoverabilityTitle = command.title
        result.addObject(key)
      }
      return result
    }
    native.routerEnabled = (id: string) =>
      available().some((command) => command.id === id)
    native.routerDispatch = (id: string) => {
      const responder = native.window && firstResponder(native.window)
      if (responder?.markedTextRange) return
      const command = available().find((command) => command.id === id)
      if (!command) return
      if (command.shortcut.input === 'Escape' && dispatch.escape()) return
      dispatch.dispatch(id)
    }
    return {
      focus() {
        if (!native.window || iosEditing(native)) return false
        return native.becomeFirstResponder()
      },
      dispose() {
        if (native.isFirstResponder) native.resignFirstResponder()
        native.routerKeys = native.routerEnabled = native.routerDispatch = null
      },
    }
  }
  if (!isIOS && native && typeof android !== 'undefined')
    return bindAndroid(native, dispatch)
  return { focus: () => false, dispose() {} }
}

function bindAndroid(native: any, dispatch: Dispatch): NativeCommandsHost {
  const compat = androidx.core.view.ViewCompat
  const held = new Set<number>()
  const listener = new compat.OnUnhandledKeyEventListenerCompat({
    onUnhandledKeyEvent(_view: any, event: any) {
      const code = event.getKeyCode()
      if (event.getAction() === 1) return held.delete(code)
      if (event.getAction() !== 0 || event.isCanceled()) return false
      if (held.has(code)) return true
      const focus = native.getRootView().findFocus()
      const editable = focus?.getEditableText?.()
      if (
        editable &&
        android.view.inputmethod.BaseInputConnection.getComposingSpanStart(editable) >= 0
      )
        return false
      const inputs: Record<number, string> = {
        111: 'Escape',
        21: 'ArrowLeft',
        22: 'ArrowRight',
        19: 'ArrowUp',
        20: 'ArrowDown',
        61: 'Tab',
        66: 'Enter',
      }
      const unicode = event.getUnicodeChar(0)
      if (unicode & 0x80000000) return false
      const input =
        inputs[code] ?? (unicode ? String.fromCharCode(unicode).toLowerCase() : '')
      const modifiers = {
        shift: event.isShiftPressed(),
        ctrl: event.isCtrlPressed(),
        alt: event.isAltPressed(),
        meta: event.isMetaPressed(),
      }
      const command = dispatch
        .list(!!editable)
        .find(
          (command) =>
            command.shortcut.input.toLowerCase() === input.toLowerCase() &&
            Object.entries(modifiers).every(
              ([key, value]) =>
                value ===
                !!command.shortcut.modifiers?.includes(key as keyof typeof flags),
            ),
        )
      if (!command) return false
      held.add(code)
      if (input === 'Escape' && dispatch.escape()) return true
      dispatch.dispatch(command.id)
      return true
    },
  })
  compat.addOnUnhandledKeyEventListener(native, listener)
  return {
    focus() {
      if (native.getRootView().findFocus()?.getEditableText?.()) return false
      native.setFocusableInTouchMode(true)
      return native.requestFocus()
    },
    dispose() {
      held.clear()
      compat.removeOnUnhandledKeyEventListener(native, listener)
    },
  }
}
