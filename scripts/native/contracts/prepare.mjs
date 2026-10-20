import { readFile, writeFile } from 'node:fs/promises'
const path = new URL(
  '../../../demo/App_Resources/Android/src/main/AndroidManifest.xml',
  import.meta.url,
)
let text = await readFile(path, 'utf8')
for (const name of ['enableOnBackInvokedCallback', 'supportsRtl']) {
  const attribute = new RegExp(`android:${name}="[^"]*"`)
  text = attribute.test(text)
    ? text.replace(attribute, `android:${name}="true"`)
    : text.replace('<application', `<application android:${name}="true"`)
}
await writeFile(path, text)
