import { readFile, writeFile } from 'node:fs/promises'
const path = new URL(
  '../../../demo/App_Resources/Android/src/main/AndroidManifest.xml',
  import.meta.url,
)
let xml = await readFile(path, 'utf8')
xml = xml.replace(/android:launchMode="[^"]*"/, 'android:launchMode="standard"')
await writeFile(path, xml)

const plist = new URL('../../../demo/App_Resources/iOS/Info.plist', import.meta.url)
const info = await readFile(plist, 'utf8')
await writeFile(
  plist,
  info.replace(
    /(<key>UIApplicationSupportsMultipleScenes<\/key>\s*)<false\/>/,
    '$1<true/>',
  ),
)
