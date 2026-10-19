// Optional native dependency for the foldable fixture; normal consumers opt in.
import { readFile, writeFile } from 'node:fs/promises'
const file = new URL('../../demo/App_Resources/Android/app.gradle', import.meta.url)
const source = await readFile(file, 'utf8')
if (!source.includes('androidx.window:window-java:')) {
  await writeFile(
    file,
    source +
      "\n// Router foldable acceptance fixture\ndependencies { implementation 'androidx.window:window-java:1.5.1' }\n",
  )
}
const manifest = new URL(
  '../../demo/App_Resources/Android/src/main/AndroidManifest.xml',
  import.meta.url,
)
const xml = await readFile(manifest, 'utf8')
if (!xml.includes('android:supportsRtl=')) {
  await writeFile(
    manifest,
    xml.replace('<application', '<application android:supportsRtl="true"'),
  )
}
