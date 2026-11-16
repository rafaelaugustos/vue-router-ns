import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error standalone native acceptance tooling
import * as evidence from '../scripts/native/flows-android-evidence.mjs'

const {
  androidCrash,
  assertAndroidHealthy,
  assertPickerVisible,
  hasPackage,
  readFreshHierarchy,
} = evidence

const picker = 'com.google.android.documentsui'
const app = 'org.nativescript.vuerouterns'
const original = readFileSync(
  new URL('./evidence/android-picker-183/original/runtime.log', import.meta.url),
  'utf8',
)
const returned = readFileSync(
  new URL('./evidence/android-picker-183/original/system-picker.xml', import.meta.url),
  'utf8',
)

describe('native flow evidence', () => {
  it('rejects the original system crash despite the subsequent user-cancellation result', () => {
    expect(original).toContain('"name":"pick:user"')
    expect(androidCrash(original, [app, picker])).toMatchObject({
      pid: 2679,
      process: picker,
    })
    expect(() => assertAndroidHealthy(original, [app, picker])).toThrow(
      'AsyncTaskLoader.onCancelLoad',
    )
  })

  it('refuses Back on the original post-crash capture of the app', () => {
    expect(hasPackage(returned, app)).toBe(true)
    expect(() => assertPickerVisible(returned, picker)).toThrow('Refusing Back')
  })

  it('does not mistake a package mentioned in text for the active window', () => {
    const xml = `<hierarchy><node package="${app}" text="${picker}" /></hierarchy>`
    expect(hasPackage(xml, picker)).toBe(false)
    expect(() => assertPickerVisible(xml, picker)).toThrow('Refusing Back')
    expect(() =>
      assertPickerVisible(`<hierarchy><node package="${picker}" /></hierarchy>`, picker),
    ).not.toThrow()
  })

  it('keeps interleaved crash blocks attached to their actual processes', () => {
    const log = `E/AndroidRuntime(11): FATAL EXCEPTION: main
E/AndroidRuntime(12): FATAL EXCEPTION: main
E/AndroidRuntime(11): Process: unrelated.app, PID: 11
E/AndroidRuntime(12): Process: ${app}:worker, PID: 12
E/AndroidRuntime(11): java.lang.Error: unrelated failure
E/AndroidRuntime(12): java.lang.Error: app failure`
    const crash = androidCrash(log, [app, picker])
    expect(crash).toMatchObject({ pid: 12, process: `${app}:worker` })
    expect(crash.lines.join('\n')).not.toContain('unrelated failure')
    expect(() => assertAndroidHealthy(log, [picker])).not.toThrow()
  })

  it('ignores normal automation shutdown logs without accepting an empty window', () => {
    expect(() =>
      assertAndroidHealthy('D/AndroidRuntime(55): Shutting down VM', [app, picker]),
    ).not.toThrow()
    expect(() => assertPickerVisible('', picker)).toThrow('Refusing Back')
  })

  it('never reuses an old hierarchy when a transition produces no dump', async () => {
    const path = '/data/local/tmp/test-ui.xml'
    let file: string | undefined = `<node package="${picker}" />`
    let ready = false
    const run = async (...args: string[]) => {
      if (args[1] === 'rm') file = undefined
      if (args[1] === 'uiautomator') {
        if (ready) file = `<node package="${picker}" text="fresh" />`
        return { stdout: '', stderr: ready ? '' : 'ERROR: null root node returned' }
      }
      if (args[1] === 'cat' && file === undefined)
        throw { code: 1, stderr: `cat: ${path}: No such file or directory\n` }
      return { stdout: file ?? '', stderr: '' }
    }
    const missing = await readFreshHierarchy(run, path)
    expect(missing.xml).toBe('')
    expect(missing.unavailable.stderr).toContain('null root node')
    expect(() => assertPickerVisible(missing.xml, picker)).toThrow('Refusing Back')
    ready = true
    expect((await readFreshHierarchy(run, path)).xml).toContain('text="fresh"')
  })

  it('preserves command and permission failures instead of polling them away', async () => {
    for (const stage of ['rm', 'uiautomator', 'cat']) {
      const failure = { code: 1, stderr: 'Permission denied' }
      const run = async (...args: string[]) => {
        if (args[1] === stage) throw failure
        return { stdout: '', stderr: '' }
      }
      await expect(readFreshHierarchy(run, '/data/local/tmp/test-ui.xml')).rejects.toBe(
        failure,
      )
    }
  })
})
