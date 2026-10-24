import type { View } from '@nativescript/core'
import type { Entry } from './stack.js'

/** Internal ownership check shared by adapters; never a global action registry. */
export const ACTION_OWNER = Symbol('page action owner')
export interface ActionOwner {
  [ACTION_OWNER]: {
    entry: Entry
    accepts(view: View): boolean
  }
}
