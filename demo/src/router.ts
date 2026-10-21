import { ApplicationSettings } from '@nativescript/core'
import { createRouter } from 'vue-router-ns'
import { session } from './store'

export const router = createRouter({
  diagnostics: __DEV__,
  restore: {
    save: (state) => ApplicationSettings.setString('stacks', JSON.stringify(state)),
    load: () => JSON.parse(ApplicationSettings.getString('stacks', 'null')),
  },
  links: {
    schemes: ['https', 'vuerouterns'],
    hosts: ['vue-router-ns.rafaelaugusto.dev'],
    // the stack decides the tab: <RouterTabs> brings it forward before the page shows
    frame(location) {
      const settings = location.path.startsWith('/settings') || location.path === '/login'
      return settings ? 'settings' : 'inbox'
    },
  },
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
