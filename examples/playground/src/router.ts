import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
    { path: '/items/:id', name: 'item', component: () => import('./pages/Item.vue') },
    {
      path: '/compose',
      name: 'compose',
      component: () => import('./pages/Compose.vue'),
      modal: true,
    },
  ],
})

declare module 'vue-router-ns' {
  interface Register {
    router: typeof router
  }
}
