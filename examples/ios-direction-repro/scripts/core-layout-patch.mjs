import { readFileSync, writeFileSync } from 'node:fs'

// Research-only dependency patch. Never imported by the router or applied on install.
const core = new URL('../node_modules/@nativescript/core/', import.meta.url)
const { version } = JSON.parse(readFileSync(new URL('package.json', core), 'utf8'))
if (version !== '9.1.3') throw new Error(`Expected Core 9.1.3, found ${version}`)
const file = new URL('ui/core/view/index.ios.js', core)
const original = `        if (this.viewController && this.viewController.view !== nativeView) {
            this.viewController.view.setNeedsLayout();
        }`
const candidate = `        // Invalidating layout must not load a controller before UIApplicationMain.
        const controllerView = this.viewController?.viewIfLoaded;
        if (controllerView && controllerView !== nativeView) {
            controllerView.setNeedsLayout();
        }`
const command = process.argv[2]
if (!['apply', 'revert'].includes(command)) throw new Error('Use apply or revert')
const [from, to] = command === 'apply' ? [original, candidate] : [candidate, original]
const source = readFileSync(file, 'utf8')
if (source.includes(to) && !source.includes(from)) {
  console.log(`Core layout patch already ${command === 'apply' ? 'applied' : 'reverted'}`)
} else {
  if (source.split(from).length !== 2)
    throw new Error('Unexpected Core source; refusing to patch')
  writeFileSync(file, source.replace(from, to))
  console.log(`Core layout patch: ${command}`)
}
