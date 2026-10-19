import { defineRouteMiddleware } from 'vue-router-ns'
import { signedIn, navigationLocked } from '../state'
export default defineRouteMiddleware((to) =>
  navigationLocked.value
    ? false
    : signedIn.value
      ? undefined
      : { name: 'login', query: { next: to.fullPath } },
)
