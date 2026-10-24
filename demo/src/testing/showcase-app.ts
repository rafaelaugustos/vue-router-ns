// Opt-in evidence only. Normal --env.showcase never writes or polls reports.
import { startShowcase } from '../showcase/bootstrap'
import { File, knownFolders } from '@nativescript/core'
import { router } from '../showcase/router'
import { drawer, notes } from '../showcase/state'
startShowcase()
const snapshots: unknown[] = []
let initialRoot: string | number | undefined
void router.isReady().then(() => {
  setInterval(() => {
    const snapshot = router.diagnostics!.snapshot()
    initialRoot ??= snapshot.stacks[0]?.logical[0]?.id
    snapshots.push({
      route: router.currentRoute.value.path,
      drawerOpen: drawer.value?.isOpen,
      snapshot,
    })
    if (snapshots.length > 240) snapshots.shift()
    File.fromPath(`${knownFolders.documents().path}/showcase.json`).writeTextSync(
      JSON.stringify({ initialRoot, snapshots, notes }),
    )
  }, 500)
})
