#!/usr/bin/env bash
# Run the installed --env.filesTest fixture on a test emulator/device.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=${OUT:-scripts/native/out/files}
source scripts/native/ui.sh

$ADB wait-for-device
$ADB shell am force-stop "$PKG"
$ADB logcat -c
$ADB shell am start -W -n "$ACTIVITY" >/dev/null
found=0
for _ in {1..90}; do
  $ADB logcat -d -v brief -s JS AndroidRuntime > "$OUT/runtime.log"
  if grep -F 'FILES_RESULT ' "$OUT/runtime.log" >/dev/null; then
    found=1
    break
  fi
  sleep 1
done
[ "$found" = 1 ] || { echo "Timed out waiting for FILES_RESULT"; exit 1; }
node --input-type=module - "$OUT/runtime.log" "$OUT/results.json" <<'JS'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const log = fs.readFileSync(process.argv[2], 'utf8')
const line = log.split('\n').find(line => line.includes('FILES_RESULT '))
const result = JSON.parse(line.slice(line.indexOf('FILES_RESULT ') + 'FILES_RESULT '.length))
fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n')
assert.equal(result.ok, true, result.error)
assert.equal(result.checks.length, 18, 'all native file-route checks completed')
assert.equal(new Set(result.checks).size, 18, 'checks ran once')
console.log(`Passed ${result.checks.length} native file-route checks`)
JS
wait_text '18 generated file-route checks passed' 20
screenshot generated-file-routes
