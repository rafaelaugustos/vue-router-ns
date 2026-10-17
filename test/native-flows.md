# Native flow validation — #54

2026-10-16, NativeScript Android runtime 9.1.1, NativeScript-Vue 3.1.2, Medium Phone emulator, Android 16 / API 36. The demo's compose sheet has an Attach action that runs `useNativeFlow(createDocumentPicker())` with `multiple: true` and shows the outcome in a label. A text file was pushed to the emulator's Downloads first.

## Android

| Check               | Result                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch              | Attach brought `com.android.documentsui.picker.PickActivity` to the front, listing the pushed file; the compose sheet and its page stayed as they were.        |
| Cancel              | Back on the picker returned to the sheet with the label "Picker cancelled" (`cancelled`, reason `user`).                                                       |
| Success             | Tapping the file returned "1 attached": the `content://` URI from the result intent.                                                                           |
| Activity recreation | Picker open, device rotated to landscape (the activity was recreated), then cancelled: the label changed to "Picker cancelled" in the same process (pid 7360). |
| History             | Nothing entered the stack: the sheet, the compose page and the trail below were unchanged throughout.                                                          |

No JavaScript errors or warnings were logged.

## iOS

`UIDocumentPickerViewController` is presented from the page's view controller with a delegate the adapter owns. The simulator offers no command-line way to drive the picker's UI, so the iOS path is covered by the automated suite against the delegate contract.

## Automated

`test/native-flows.spec.ts` covers the Android intent (`ACTION_OPEN_DOCUMENT`, MIME types, multiple selection) and its results, cancellation, single and multiple URIs, concurrent attempts kept apart by request code across an activity recreation, an attempt replaced by a newer one, a result arriving after the page left (dropped, the promise already settled as `disposed`), the `before` guard, unsupported flows, the iOS picker's delegate, and use outside a page. 300 tests pass.

## Not validated natively

- A result delivered after the originating page disappeared: the system picker covers the app, so the page cannot be popped from under it with the tools here; the automated suite covers the settlement.
- Process death while the picker is open: by design no promise survives, and the result the system hands the new process is dropped. The guide says to keep "a picker was open" in page state and ask again.
