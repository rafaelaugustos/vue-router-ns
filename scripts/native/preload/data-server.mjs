import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

export async function startDataServer() {
  const requests = [],
    timers = new Set()
  const server = createServer((request, response) => {
    const match = /^\/products\/([AB])\/([a-z-]+)$/.exec(request.url)
    if (!match) {
      response.writeHead(404).end()
      return
    }
    const [, account, id] = match
    const report = { account, id, completed: false }
    requests.push(report)
    const timer = setTimeout(() => {
      timers.delete(timer)
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      })
      response.end(
        JSON.stringify({ account, id, title: `Product for account ${account}` }),
      )
      report.completed = true
    }, 900)
    timers.add(timer)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(18819, '127.0.0.1', resolve)
  })
  return {
    requests,
    async close() {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      const closing = new Promise((resolve) => server.close(resolve))
      server.closeAllConnections()
      await closing
    },
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startDataServer()
  console.log('Data preload fixture: http://127.0.0.1:18819; controlled 900 ms delay')
}
