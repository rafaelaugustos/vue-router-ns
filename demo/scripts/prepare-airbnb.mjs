import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'

const resources = new URL('../App_Resources/', import.meta.url)
const branding = new URL('../branding/airbnb/', import.meta.url)
const plistPath = new URL('iOS/Info.plist', resources)
let plist = await readFile(plistPath, 'utf8')
for (const key of ['CFBundleDisplayName', 'CFBundleName']) {
  const entry = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`)
  if (!entry.test(plist)) throw new Error(`Missing ${key} in iOS/Info.plist`)
  plist = plist.replace(entry, '$1Airbnb NS$2')
}

const values = new URL('Android/src/main/res/values/', resources)
const stringsPath = new URL('strings.xml', values)
let strings
try {
  strings = await readFile(stringsPath, 'utf8')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  strings = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n'
}
for (const key of ['app_name', 'title_activity_kimera']) {
  const entry = new RegExp(
    `<string\\b[^>]*\\bname=["']${key}["'][^>]*>[\\s\\S]*?</string>`,
  )
  const replacement = `    <string name="${key}">Airbnb NS</string>`
  strings = entry.test(strings)
    ? strings.replace(entry, replacement.trimStart())
    : strings.replace('</resources>', `${replacement}\n</resources>`)
}

await cp(branding, resources, { recursive: true })
await writeFile(plistPath, plist)
await mkdir(values, { recursive: true })
await writeFile(stringsPath, strings)
console.log('Applied Airbnb NS name and icons to iOS and Android resources.')
