import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const path = new URL(
  '../../../demo/App_Resources/Android/src/main/AndroidManifest.xml',
  import.meta.url,
)
let xml = await readFile(path, 'utf8')
xml = xml.replace(/android:launchMode="[^"]*"/, 'android:launchMode="standard"')
await writeFile(path, xml)

const plist = new URL('../../../demo/App_Resources/iOS/Info.plist', import.meta.url)
execFileSync('python3', [
  '-c',
  `
import plistlib, sys
path = sys.argv[1]
with open(path, 'rb') as source:
    info = plistlib.load(source)
info['UIRequiresFullScreen'] = False
manifest = info.setdefault('UIApplicationSceneManifest', {})
manifest['UIApplicationSupportsMultipleScenes'] = True
manifest.setdefault('UIApplicationPreferredDefaultSceneSessionRole', 'UIWindowSceneSessionRoleApplication')
with open(path, 'wb') as target:
    plistlib.dump(info, target, sort_keys=False)
`,
  fileURLToPath(plist),
])
