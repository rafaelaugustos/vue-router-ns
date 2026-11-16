import assert from 'node:assert/strict'

const dump = [
  'shell',
  'dumpsys',
  'activity',
  'service',
  'com.android.systemui/.SystemUIService',
]

// Only this read-only diagnostic may be repeated. Never replay a gesture,
// Activity command or app launch after losing the ADB transport.
export async function readSystemUi({ run, bootId, appPid, record, now = Date.now }) {
  const deadline = now() + 15000
  const read = (args) => {
    const remaining = deadline - now()
    assert(remaining > 0, 'SystemUI diagnostic recovery exceeded 15 seconds')
    return run(args, { timeout: remaining })
  }
  try {
    return await read(dump)
  } catch (error) {
    const failed = {
      code: error.code,
      signal: error.signal,
      killed: error.killed,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
    }
    await record({ stage: 'failed-read', ...failed })
    const systemPid =
      /^SERVICE com\.android\.systemui\/\.SystemUIService\s+\S+\s+pid=(\d+)\b/m.exec(
        failed.stdout,
      )?.[1]
    if (error.code !== 255 || error.killed || error.signal || !systemPid) throw error
    try {
      await read(['wait-for-device'])
      const verifyIdentity = async (phase) => {
        const recoveredBoot = (
          await read(['shell', 'cat', '/proc/sys/kernel/random/boot_id'])
        ).trim()
        assert.equal(recoveredBoot, bootId, 'Device rebooted during SystemUI diagnostic')
        const recoveredSystem = (
          await read(['shell', 'pidof', 'com.android.systemui'])
        ).trim()
        assert.equal(recoveredSystem, systemPid, 'SystemUI restarted during diagnostic')
        let recoveredApp
        if (appPid) {
          recoveredApp = (
            await read(['shell', 'pidof', 'org.nativescript.vuerouterns'])
          ).trim()
          assert.equal(
            recoveredApp,
            appPid,
            'Fixture restarted during SystemUI diagnostic',
          )
        }
        await record({
          stage: 'identity-confirmed',
          phase,
          bootId: recoveredBoot,
          systemPid: recoveredSystem,
          appPid: recoveredApp ?? null,
        })
      }
      await verifyIdentity('before-retry')
      const result = await read(dump)
      await verifyIdentity('after-retry')
      await record({ stage: 'read-recovered' })
      return result
    } catch (recoveryError) {
      await record({
        stage: 'recovery-failed',
        error: String(recoveryError),
        code: recoveryError.code,
        stdout: String(recoveryError.stdout ?? ''),
        stderr: String(recoveryError.stderr ?? ''),
      })
      throw recoveryError
    }
  }
}
