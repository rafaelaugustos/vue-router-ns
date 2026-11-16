/** Extract fatal AndroidRuntime blocks from logcat -v brief, retaining PID ownership. */
export function androidCrash(runtime, packages) {
  const crashes = []
  const pending = new Map()
  for (const line of runtime.split('\n')) {
    const match = /^[EF]\/AndroidRuntime\(\s*(\d+)\):\s*(.*)$/.exec(line)
    if (!match) continue
    const [, pid, message] = match
    if (message.startsWith('FATAL EXCEPTION:')) {
      const crash = { pid: Number(pid), process: '', lines: [] }
      pending.set(pid, crash)
      crashes.push(crash)
    }
    const crash = pending.get(pid)
    if (!crash) continue
    crash.lines.push(message)
    const process = /^Process: ([^,]+), PID: (\d+)$/.exec(message)
    if (process && process[2] === pid) crash.process = process[1]
  }
  return crashes.find((crash) =>
    packages.some((pkg) => crash.process === pkg || crash.process.startsWith(`${pkg}:`)),
  )
}

export function assertAndroidHealthy(runtime, packages) {
  const crash = androidCrash(runtime, packages)
  if (crash) {
    const error = new Error(
      `Android process ${crash.process} (PID ${crash.pid}) crashed:\n${crash.lines.join('\n')}`,
    )
    error.crash = crash
    throw error
  }
}

export function hasPackage(xml, pkg) {
  return (xml.match(/<node\b[^>]*>/g) ?? []).some(
    (node) => /\bpackage="([^"]+)"/.exec(node)?.[1] === pkg,
  )
}

export function assertPickerVisible(xml, pkg) {
  if (!hasPackage(xml, pkg))
    throw new Error(`Refusing Back: ${pkg} no longer owns the active hierarchy`)
}
