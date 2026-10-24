import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('../../', import.meta.url)
const result = await build({
  entryPoints: [fileURLToPath(new URL('main.ts', import.meta.url))],
  bundle: true,
  write: false,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outdir: 'viewer',
})
const js = result.outputFiles
  .find((file) => file.path.endsWith('.js'))
  .text.replaceAll('</script', '<\\/script')
const css = result.outputFiles
  .find((file) => file.path.endsWith('.css'))
  .text.replaceAll('</style', '<\\/style')
const template = await readFile(new URL('index.html', import.meta.url), 'utf8')
const html = template
  .replace('<html lang="en">', '<html lang="en" data-standalone="true">')
  .replace(
    '</head>',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'" /><style>${css}</style></head>`,
  )
  .replace(
    '<script type="module" src="./main.ts"></script>',
    `<script type="module">${js}</script>`,
  )
const output = new URL('docs/public/diagnostics-viewer/', root)
await mkdir(output, { recursive: true })
await writeFile(new URL('index.html', output), html)
console.log('Built standalone diagnostics viewer (no remote assets or transport)')
