// Give CI SDKs without the Pixel Fold profile the same foldable geometry.
// Run after AVD creation and before its first boot (emulator-runner's hook).
import { readFile, writeFile } from 'node:fs/promises'
const file = process.argv[2]
if (!file) throw new Error('Pass the generated AVD config.ini path')
const config = new Map(
  (await readFile(file, 'utf8'))
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)
const fold = {
  'hw.device.name': 'pixel_fold',
  'hw.device.manufacturer': 'Google',
  'hw.lcd.width': '2208',
  'hw.lcd.height': '1840',
  'hw.lcd.density': '420',
  'hw.initialOrientation': 'portrait',
  'hw.displayRegion.0.1.height': '2092',
  'hw.displayRegion.0.1.width': '1080',
  'hw.displayRegion.0.1.xOffset': '0',
  'hw.displayRegion.0.1.yOffset': '0',
  'hw.sensor.hinge': 'yes',
  'hw.sensor.hinge.areas': '1080-0-0-1840',
  'hw.sensor.hinge.count': '1',
  'hw.sensor.hinge.defaults': '180',
  'hw.sensor.hinge.fold_to_displayRegion.0.1_at_posture': '1',
  'hw.sensor.hinge.ranges': '0-180',
  'hw.sensor.hinge.resizable.config': '1',
  'hw.sensor.hinge.sub_type': '1',
  'hw.sensor.hinge.type': '1',
  'hw.sensor.hinge_angles_posture_definitions': '0-30, 30-150, 150-180',
  'hw.sensor.posture_list': '1, 2, 3',
}
for (const [key, value] of Object.entries(fold)) config.set(key, value)
await writeFile(
  file,
  [...config].map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
)
