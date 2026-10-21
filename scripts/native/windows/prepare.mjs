import { readFile, writeFile } from 'node:fs/promises'
const path = new URL(
  '../../../demo/App_Resources/Android/src/main/AndroidManifest.xml',
  import.meta.url,
)
let xml = await readFile(path, 'utf8')
xml = xml.replace(/android:launchMode="[^"]*"/, 'android:launchMode="standard"')
await writeFile(path, xml)
