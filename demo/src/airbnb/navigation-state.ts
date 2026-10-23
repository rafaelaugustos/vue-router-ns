import { ApplicationSettings } from '@nativescript/core'
import type { SavedStacks } from 'vue-router-ns'

const key = 'airbnb.navigation.v1'
export const navigationState = {
  maxAge: 24 * 60 * 60 * 1000,
  save(state: SavedStacks | null) {
    if (state) ApplicationSettings.setString(key, JSON.stringify(state))
    else ApplicationSettings.remove(key)
  },
  load(): SavedStacks | null {
    try {
      const state = JSON.parse(ApplicationSettings.getString(key, 'null'))
      if (
        state?.version !== 2 ||
        !Number.isFinite(state.savedAt) ||
        !state.stacks ||
        typeof state.stacks !== 'object' ||
        !Object.values(state.stacks).every(
          (paths) =>
            Array.isArray(paths) && paths.every((path) => typeof path === 'string'),
        )
      )
        return null
      return state
    } catch {
      return null
    }
  },
}
