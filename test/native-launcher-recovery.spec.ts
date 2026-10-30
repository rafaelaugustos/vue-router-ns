import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error standalone .mjs tooling
import { createLauncherRecovery } from '../scripts/native/adaptive-drawer/launcher-recovery.mjs'

// Unmodified hierarchy from native-foldable-android, run 40311133442.
const launcher = readFileSync(
  new URL('./evidence/foldable-launcher-anr.xml', import.meta.url),
  'utf8',
)
function harness() {
  const dependencies = {
    pid: vi.fn().mockResolvedValue('1234'),
    capture: vi.fn().mockResolvedValue(undefined),
    tap: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    saveReport: vi.fn().mockResolvedValue(undefined),
  }
  return { ...dependencies, recover: createLauncherRecovery(dependencies) }
}

describe('adaptive input launcher ANR recovery', () => {
  it('recovers the archived system dialog, preserving evidence and the app PID', async () => {
    const h = harness()
    await expect(h.recover(launcher)).resolves.toBe(true)
    expect(h.capture).toHaveBeenCalledWith(launcher, 1)
    expect(h.capture.mock.invocationCallOrder[0]).toBeLessThan(
      h.tap.mock.invocationCallOrder[0]!,
    )
    expect(h.tap).toHaveBeenCalledExactlyOnceWith(1104, 920)
    expect(h.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        status: 'recovered',
        applicationPidBefore: '1234',
        applicationPidAfter: '1234',
      }),
    )
  })

  it('does not spend its single recovery on an ordinary app hierarchy', async () => {
    const h = harness()
    await expect(
      h.recover(
        '<hierarchy><node text="permanent" package="org.nativescript.vuerouterns" /></hierarchy>',
      ),
    ).resolves.toBe(false)
    expect(h.pid).not.toHaveBeenCalled()
    expect(h.tap).not.toHaveBeenCalled()
    await expect(h.recover(launcher)).resolves.toBe(true)
  })

  it('fails a repeated launcher ANR without clicking again', async () => {
    const h = harness()
    await h.recover(launcher)
    await expect(h.recover(launcher)).rejects.toThrow('Repeated Pixel Launcher ANR')
    expect(h.tap).toHaveBeenCalledTimes(1)
    expect(h.capture).toHaveBeenLastCalledWith(launcher, 2)
    expect(h.saveReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ attempt: 2, status: 'failed' }),
    )
  })

  it.each(['vue-router-ns', 'System UI', 'Another Launcher'])(
    'never dismisses an ANR from %s',
    async (name) => {
      const h = harness()
      await expect(h.recover(launcher.replace('Pixel Launcher', name))).rejects.toThrow(
        'Unexpected app ANR',
      )
      expect(h.tap).not.toHaveBeenCalled()
      expect(h.saveReport).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      )
    },
  )

  it('ignores an app-owned imitation of the system dialog', async () => {
    const h = harness()
    await expect(
      h.recover(
        launcher.replaceAll(
          'package="android"',
          'package="org.nativescript.vuerouterns"',
        ),
      ),
    ).resolves.toBe(false)
    expect(h.tap).not.toHaveBeenCalled()
  })

  it.each([
    ['android:id/aerr_close', 'android:id/missing', 'Missing ANR Close app button'],
    ['[539,857][1669,983]', '[0,0][0,0]', 'Empty ANR Close app bounds'],
    ['[539,857][1669,983]', 'invalid', 'Invalid ANR Close app bounds'],
  ])('rejects unsafe close targets: %s → %s', async (from, to, error) => {
    const h = harness()
    await expect(h.recover(launcher.replace(from, to))).rejects.toThrow(error)
    expect(h.tap).not.toHaveBeenCalled()
  })

  it('fails if the fixture process is already missing', async () => {
    const h = harness()
    h.pid.mockResolvedValue('')
    await expect(h.recover(launcher)).rejects.toThrow('Fixture process is missing')
    expect(h.tap).not.toHaveBeenCalled()
  })

  it('fails if the fixture dies or restarts during recovery', async () => {
    const h = harness()
    h.pid.mockResolvedValueOnce('1234').mockResolvedValueOnce('5678')
    await expect(h.recover(launcher)).rejects.toThrow('Fixture process changed')
    expect(h.saveReport).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', applicationPidAfter: '5678' }),
    )
  })

  it('does not dismiss the dialog if evidence cannot be captured', async () => {
    const h = harness()
    h.capture.mockRejectedValue(new Error('disk full'))
    await expect(h.recover(launcher)).rejects.toThrow('disk full')
    expect(h.tap).not.toHaveBeenCalled()
  })
})
