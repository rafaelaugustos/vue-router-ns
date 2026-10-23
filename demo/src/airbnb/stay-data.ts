import { defineRouteLoader } from 'vue-router-ns'

// The demo stays offline. Each navigation owns its result, including when the
// same stay is opened in two tabs. A real catalog client can replace this import.
export const stayData = defineRouteLoader(async ({ to }) => {
  const { stays } = await import('./data')
  return stays.find((stay) => stay.id === String(to.params.id)) ?? null
})
