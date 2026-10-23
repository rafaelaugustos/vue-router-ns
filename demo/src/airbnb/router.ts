import { createRouter } from 'vue-router-ns'
import { stayData } from './stay-data'
import { navigationState } from './navigation-state'

export const router = createRouter({
  restore: navigationState,
  links: {
    schemes: ['vuerouterns'],
    frame: (location) => {
      const tab = location.path.split('/')[1]
      return ['saved', 'trips', 'messages', 'profile'].includes(tab) ? tab : 'explore'
    },
  },
  routes: [
    { path: '/', component: () => import('./pages/Explore.vue') },
    {
      path: '/destinations/:id',
      props: true,
      component: () => import('./pages/Destination.vue'),
    },
    {
      path: '/stays/:id',
      name: 'stay',
      component: () => import('./pages/Stay.vue'),
      meta: { tabBarVisibility: 'hidden', loaders: stayData },
    },
    { path: '/saved', component: () => import('./pages/Saved.vue') },
    {
      path: '/trips',
      props: { section: 'trips' },
      component: () => import('./pages/Collection.vue'),
    },
    {
      path: '/messages',
      props: { section: 'messages' },
      component: () => import('./pages/Collection.vue'),
    },
    {
      path: '/profile',
      props: { section: 'profile' },
      component: () => import('./pages/Collection.vue'),
    },
    { path: '/search', modal: true, component: () => import('./pages/Search.vue') },
  ],
})
