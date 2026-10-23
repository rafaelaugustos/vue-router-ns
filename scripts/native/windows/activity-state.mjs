/** Read the OS checkpoint, not an app-side save callback that may still be in flight. */
export function activityStates(dump, pkg, tasks) {
  const records = dump.split(/(?=^[ \t]*\* Hist\s+#\d+:)/m)
  return tasks.map((task) => {
    const record = records.find((block) => {
      const header = block.trimStart().split('\n')[0]
      return header.includes(` ${pkg}/`) && new RegExp(`\\bt${task}\\}`).test(header)
    })
    return {
      task,
      present: !!record,
      stopped: /\bstate=STOPPED\b/.test(record ?? ''),
      saved: /\bmHaveState=true\b/.test(record ?? ''),
    }
  })
}
