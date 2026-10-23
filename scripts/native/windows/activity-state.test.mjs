import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activityStates } from './activity-state.mjs'

const pkg = 'org.nativescript.vuerouterns'
const dump = `ACTIVITY MANAGER ACTIVITIES (dumpsys activity activities)
  * Task{123 #14 type=standard}
    * Hist  #0: ActivityRecord{264164251 u0 ${pkg}/com.tns.NativeScriptActivity t14}
      mHaveState=true mIcicle=Bundle[mParcelledData.dataSize=7324]
      state=STOPPED delayedResume=false finishing=false
  * Task{456 #15 type=standard}
    * Hist  #0: ActivityRecord{184328860 u0 ${pkg}/com.tns.NativeScriptActivity t15}
      mHaveState=false mIcicle=null
      state=STOPPING delayedResume=false finishing=false
  * Task{789 #2 type=home}
      * Hist  #1: ActivityRecord{987 u0 com.example.launcher/.Home t2}
        mHaveState=true mIcicle=Bundle[mParcelledData.dataSize=7324]
        state=RESUMED delayedResume=false finishing=false
`

test('does not kill while B is stopping without a saved OS state', () => {
  assert.deepEqual(activityStates(dump, pkg, [14, 15]), [
    { task: 14, present: true, stopped: true, saved: true },
    { task: 15, present: true, stopped: false, saved: false },
  ])
})

test('requires both stopped and saved for each original task', () => {
  const stopped = dump.replace('state=STOPPING', 'state=STOPPED')
  assert.equal(activityStates(stopped, pkg, [15])[0].saved, false)
  const ready = stopped.replace('mHaveState=false', 'mHaveState=true')
  assert(
    activityStates(ready, pkg, [14, 15]).every((s) => s.present && s.stopped && s.saved),
  )
})

test('does not borrow state from another task or application', () => {
  assert.deepEqual(activityStates(dump, pkg, [2, 16]), [
    { task: 2, present: false, stopped: false, saved: false },
    { task: 16, present: false, stopped: false, saved: false },
  ])
})
