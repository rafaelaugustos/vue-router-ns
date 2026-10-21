import { Device, isAndroid, isIOS } from '@nativescript/core'
import type { NativeFlow } from '../native-flows.js'

export interface DocumentPickerInput {
  /** MIME types to offer, like `['application/pdf', 'image/*']`. Everything by default. */
  types?: readonly string[]
  multiple?: boolean
}

export interface DocumentPickerResult {
  /** Selected URI strings: `content://` on Android, `file://` on iOS. Access lifetime is app-owned. */
  uris: string[]
}

declare const android: {
  content: {
    Intent: {
      new (action: string): AndroidIntent
      ACTION_OPEN_DOCUMENT: string
      CATEGORY_OPENABLE: string
      EXTRA_MIME_TYPES: string
      EXTRA_ALLOW_MULTIPLE: string
    }
  }
  app: { Activity: { RESULT_OK: number } }
}
interface AndroidIntent {
  addCategory(category: string): AndroidIntent
  setType(type: string): AndroidIntent
  putExtra(name: string, value: unknown): AndroidIntent
  getData(): { toString(): string } | null
  getClipData(): {
    getItemCount(): number
    getItemAt(index: number): { getUri(): { toString(): string } }
  } | null
}

declare const NSObject: { extend(methods: object, options: object): { new (): any } }
declare const UIDocumentPickerDelegate: unknown
declare const UIDocumentPickerViewController: {
  alloc(): { initForOpeningContentTypes(types: unknown): any }
}
declare const UTType: {
  typeWithMIMEType(mime: string): unknown
  typeWithIdentifier(identifier: string): unknown
}
declare const NSArray: { arrayWithArray(items: unknown[]): unknown }

const presentingWindows = new WeakSet<object>()

let PickerDelegate: { new (): any } | undefined

/**
 * The system document picker: `ACTION_OPEN_DOCUMENT` on Android,
 * `UIDocumentPickerViewController` on iOS 14 and later. Returns scoped URIs,
 * never filesystem paths; reading them and keeping access is the app's.
 */
export function createDocumentPicker(): NativeFlow<
  DocumentPickerInput,
  DocumentPickerResult
> {
  return {
    kind: 'document-picker',
    supported() {
      if (isAndroid) return typeof android !== 'undefined' && !!android.content?.Intent
      if (isIOS)
        return (
          typeof UIDocumentPickerViewController !== 'undefined' &&
          parseFloat(Device.sdkVersion) >= 14
        )
      return false
    },
    start(input, context) {
      if (isAndroid) return startAndroid(input, context)
      return startIOS(input, context)
    },
  }
}

function startAndroid(
  input: DocumentPickerInput,
  context: Parameters<NativeFlow<DocumentPickerInput, DocumentPickerResult>['start']>[1],
) {
  const Intent = android.content.Intent
  const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
    .addCategory(Intent.CATEGORY_OPENABLE)
    .setType(input.types?.length === 1 ? input.types[0]! : '*/*')
  if (input.types && input.types.length > 1)
    intent.putExtra(Intent.EXTRA_MIME_TYPES, input.types)
  if (input.multiple) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
  context.launchActivity(intent, (resultCode, result: AndroidIntent | null) => {
    if (resultCode !== android.app.Activity.RESULT_OK) {
      context.cancel()
      return
    }
    const uris: string[] = []
    const clip = result?.getClipData?.()
    if (clip) {
      for (let index = 0; index < clip.getItemCount(); index++)
        uris.push(String(clip.getItemAt(index).getUri().toString()))
    } else {
      const data = result?.getData?.()
      if (data) uris.push(String(data.toString()))
    }
    context.complete({ uris })
  })
}

function startIOS(
  input: DocumentPickerInput,
  context: Parameters<NativeFlow<DocumentPickerInput, DocumentPickerResult>['start']>[1],
) {
  const controller = context.page?.ios
  if (!controller)
    throw new Error(
      '[vue-router-ns] No view controller to present a document picker from',
    )
  const owner = controller.view?.window ?? controller
  if (
    presentingWindows.has(owner) ||
    controller.presentedViewController ||
    controller.beingDismissed
  )
    throw new Error(
      '[vue-router-ns] The originating controller is already presenting native UI',
    )
  PickerDelegate ??= NSObject.extend(
    {
      documentPickerDidPickDocumentsAtURLs(this: any, _picker: unknown, urls: any) {
        const uris: string[] = []
        for (let index = 0; index < (urls?.count ?? 0); index++)
          uris.push(String(urls.objectAtIndex(index).absoluteString))
        this._context?.complete({ uris })
        this._context = undefined
      },
      documentPickerWasCancelled(this: any) {
        this._context?.cancel()
        this._context = undefined
      },
    },
    { protocols: [UIDocumentPickerDelegate] },
  )
  const wildcards: Record<string, string> = {
    '*/*': 'public.item',
    'image/*': 'public.image',
    'audio/*': 'public.audio',
    'video/*': 'public.movie',
    'text/*': 'public.text',
  }
  const types = (input.types?.length ? input.types : ['*/*']).map((mime) => {
    const type = wildcards[mime]
      ? UTType.typeWithIdentifier(wildcards[mime]!)
      : UTType.typeWithMIMEType(mime)
    if (!type) throw new Error(`[vue-router-ns] Unsupported document MIME type: ${mime}`)
    return type
  })
  const picker = UIDocumentPickerViewController.alloc().initForOpeningContentTypes(
    NSArray.arrayWithArray(types),
  )
  picker.allowsMultipleSelection = !!input.multiple
  const delegate = new PickerDelegate()
  delegate._context = context
  picker.delegate = delegate
  presentingWindows.add(owner)
  try {
    controller.presentViewControllerAnimatedCompletion(picker, true, null)
  } catch (error) {
    presentingWindows.delete(owner)
    delegate._context = undefined
    throw error
  }
  return () => {
    presentingWindows.delete(owner)
    delegate._context = undefined
    if (picker.presentingViewController)
      picker.dismissViewControllerAnimatedCompletion(true, null)
  }
}
