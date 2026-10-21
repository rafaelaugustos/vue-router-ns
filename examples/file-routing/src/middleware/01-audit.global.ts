import { defineRouteMiddleware } from 'vue-router-ns'
import { globalVisits } from '../state'
export default defineRouteMiddleware(() => {
  globalVisits.value++
})
