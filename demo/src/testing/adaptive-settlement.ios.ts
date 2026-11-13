// Keep the existing UIKit acceptance timing separate from the Android fix.
export function observeDrawerSettlement(_host: unknown) {
  return {
    async wait() {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return undefined
    },
    dispose() {},
  }
}
