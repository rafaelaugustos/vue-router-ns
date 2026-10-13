import { createRouter } from 'vue-router-ns'
import { session } from './store'

// Pages load lazily. Besides keeping startup light, it lets TypeScript infer
// route names and params here while the pages themselves use them.
export const router = createRouter({
  routes: [
    { path: '/', name: 'inbox', component: () => import('./pages/Inbox.vue') },
    {
      path: '/messages/:id(\\d+)',
      name: 'message',
      component: () => import('./pages/Message.vue'),
      props: true,
    },
    {
      path: '/compose',
      name: 'compose',
      component: () => import('./pages/Compose.vue'),
      modal: true,
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./pages/Settings.vue'),
    },
    {
      path: '/settings/account',
      name: 'account',
      component: () => import('./pages/Account.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/login', name: 'login', component: () => import('./pages/Login.vue') },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./pages/NotFound.vue'),
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !session.user) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})

declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }

  interface RouteMeta {
    requiresAuth?: boolean
  }
}
