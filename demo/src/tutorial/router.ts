import { createRouter } from 'vue-router-ns'

export const router = createRouter({
  routes: [
    { path: '/', component: () => import('./pages/Home.vue') },
    {
      path: '/notes/:id',
      component: () => import('./pages/Note.vue'),
      props: true,
    },
    {
      path: '/notes/:id/edit',
      component: () => import('./pages/Edit.vue'),
      props: true,
      modal: true,
    },
  ],
})
