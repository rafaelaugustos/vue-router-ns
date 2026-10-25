import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const installed = require('vue-router-ns/package.json')
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)))
const entry = lock.packages['node_modules/vue-router-ns']
assert.equal(installed.version, '0.1.0-rc.3')
assert.equal(entry.version, installed.version)
assert.equal(
  entry.resolved,
  'https://registry.npmjs.org/vue-router-ns/-/vue-router-ns-0.1.0-rc.3.tgz',
)
assert.equal(
  entry.integrity,
  'sha512-AX9oDC+2XTM2MJt27DvxT5Zz/Kmrc7SuID3oIuSFShzxNh8BYgMioc91vCfjOLDFKlTOFTmyqBInDgxgwEBFsA==',
)
console.log(
  JSON.stringify(
    { version: installed.version, resolved: entry.resolved, integrity: entry.integrity },
    null,
    2,
  ),
)
