import { readFile, writeFile } from 'node:fs/promises'
const path = 'demo/App_Resources/iOS/Info.plist'
let plist = await readFile(path, 'utf8')
// Full-screen compatibility mode scales a screenshot instead of resizing UIKit.
plist = plist.replace(/(<key>UIRequiresFullScreen<\/key>\s*)<true\s*\/>/, '$1<false/>')
await writeFile(path, plist)
