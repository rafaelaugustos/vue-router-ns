import { onScopeDispose } from 'nativescript-vue'
import { defineRouteLoader, useRouteData } from 'vue-router-ns'

export type Product = { id: string; title: string; price: number }
const requests = new Map<string, Promise<Product>>()
export const consumers: { id: string; disposed: boolean; resolved: boolean }[] = []

export const productData = defineRouteLoader(({ to }) => {
  const id = String(to.params.id)
  let request = requests.get(id)
  if (!request) {
    request = fetch(`http://127.0.0.1:18818/products/${encodeURIComponent(id)}`).then(
      (response) => {
        if (!response.ok) throw new Error('Could not load product')
        return response.json() as Promise<Product>
      },
    )
    requests.set(id, request)
    const own = request
    void own.catch(() => {
      if (requests.get(id) === own) requests.delete(id)
    })
  }
  return request
})

export function invalidateProduct(id: string) {
  requests.delete(id)
}

export function consumeProduct() {
  const product = useRouteData(productData)
  const consumer = { id: String(consumers.length + 1), disposed: false, resolved: false }
  consumers.push(consumer)
  onScopeDispose(() => {
    consumer.disposed = true
  })
  return { product, consumer }
}
