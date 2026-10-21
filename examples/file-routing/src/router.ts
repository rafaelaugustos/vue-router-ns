import { createRouter, type RouteComponent } from 'vue-router-ns'
import { mergeFileRoutes } from 'vue-router-ns/file-routing'
import { routes, layouts, installFileRouting } from './generated/router'

export const router = createRouter({
  routes: mergeFileRoutes(routes, [
    {
      path: '/about',
      name: 'about',
      component: (): Promise<RouteComponent> =>
        import('./About.vue').then((m) => m.default),
      meta: { title: 'About this example' },
    },
  ]),
  layouts,
  defaultLayout: 'default',
})
export const stopFileRouting = installFileRouting(router)

declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }
}
