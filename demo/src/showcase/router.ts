import { createRouter } from 'vue-router-ns'
export const router = createRouter({
  diagnostics: true,
  routes: [
    { path: '/', component: () => import('./pages/Library.vue') },
    { path: '/about', component: () => import('./pages/About.vue') },
    { path: '/notes/:id', component: () => import('./pages/Note.vue'), props: true },
    { path: '/notes/:id/edit', component: () => import('./pages/Edit.vue'), props: true },
    {
      path: '/notes/:id/review',
      component: () => import('./pages/Review.vue'),
      props: true,
      modal: true,
    },
  ],
})
