import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

// Real HTTP with driver-controlled responses makes pending/cancellation assertions
// independent of CI speed. Standalone mode delays responses for the interactive demo.
export async function startServer({ controlled = false } = {}) {
  const counts = new Map()
  const pending = new Map()
  const server = createServer((request, response) => {
    const match = /^\/products\/([^/?]+)$/.exec(request.url)
    if (!match) {
      response.writeHead(404).end()
      return
    }
    const id = decodeURIComponent(match[1])
    const count = (counts.get(id) ?? 0) + 1
    counts.set(id, count)
    const complete = () => {
      response.writeHead(id === 'error' && count === 1 ? 500 : 200, {
        'Content-Type': 'application/json',
      })
      response.end(JSON.stringify({ id, title: `Product ${id}`, price: 42 }))
    }
    if (controlled) {
      const queue = pending.get(id) ?? []
      queue.push(complete)
      pending.set(id, queue)
    } else setTimeout(complete, 1200).unref()
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(18818, '127.0.0.1', resolve)
  })
  return {
    counts,
    release(id) {
      const queue = pending.get(id) ?? []
      pending.delete(id)
      for (const complete of queue) complete()
    },
    async close() {
      pending.clear()
      const closed = new Promise((resolve) => server.close(resolve))
      server.closeAllConnections()
      await closed
    },
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer()
  console.log(
    'Product API listening on http://127.0.0.1:18818 (first /products/error request fails)',
  )
}
