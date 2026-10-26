import type { Frame } from '@nativescript/core'
export function nativeIdentity(value: object | undefined): number | null
export function rotationReport(): unknown
export function finishUnobservedGesture(): void
export function rotateDuringNavigation(
  frame: Frame,
  operation: string,
  landscape: boolean,
  navigate: () => Promise<unknown>,
  snapshot: () => unknown,
): void
