import { cp, mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = fileURLToPath(new URL('..', import.meta.url))
const destination = resolve(root, 'App_Resources')
let exists = true
try {
  await access(destination)
} catch {
  exists = false
}
if (!exists) {
  const temporary = await mkdtemp(join(tmpdir(), 'router-files-template-'))
  try {
    execFileSync(
      'ns',
      [
        'create',
        'nativefiles',
        '--template',
        '@nativescript/template-blank-ts',
        '--path',
        temporary,
      ],
      { stdio: 'inherit' },
    )
    await cp(join(temporary, 'nativefiles/App_Resources'), destination, {
      recursive: true,
    })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}
