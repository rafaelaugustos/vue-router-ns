// The rotation fixture is iOS-only; keep the shared adaptive fixture buildable.
export function nativeIdentity(_value: unknown): number | null {
  return null
}
export function rotationReport(): null {
  return null
}
export function finishUnobservedGesture(): void {
  throw new Error('iOS-only rotation fixture')
}
export function rotateDuringNavigation(..._args: unknown[]): never {
  throw new Error('iOS-only rotation fixture')
}
