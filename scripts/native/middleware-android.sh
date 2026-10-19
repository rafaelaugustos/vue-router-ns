#!/usr/bin/env bash
# Run the installed --env.middlewareTest fixture on a test device/emulator.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=${OUT:-scripts/native/out/middleware}
source scripts/native/ui.sh

$ADB wait-for-device
$ADB shell am force-stop "$PKG"
$ADB logcat -c
$ADB shell am start -W -n "$ACTIVITY" >/dev/null

found=0
for _ in {1..90}; do
  $ADB logcat -d -v brief -s JS AndroidRuntime > "$OUT/runtime.log"
  if grep -F 'MIDDLEWARE_RESULT ' "$OUT/runtime.log" >/dev/null; then
    found=1
    break
  fi
  sleep 1
done
[ "$found" = 1 ] || { echo "Timed out waiting for MIDDLEWARE_RESULT"; exit 1; }
node --input-type=module - "$OUT/runtime.log" "$OUT/results.json" <<'JS'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const log = fs.readFileSync(process.argv[2], 'utf8')
const line = log.split('\n').find(line => line.includes('MIDDLEWARE_RESULT '))
const result = JSON.parse(line.slice(line.indexOf('MIDDLEWARE_RESULT ') + 'MIDDLEWARE_RESULT '.length))
fs.writeFileSync(process.argv[3], JSON.stringify(result, null, 2) + '\n')
assert.equal(result.ok, true, result.error)
assert.equal(result.checks.length, 15, 'all native acceptance checks completed')
assert.equal(new Set(result.checks).size, 15, 'checks ran once')
console.log(`Passed ${result.checks.length} native middleware/helper checks`)
JS

wait_text 'route /guarded' 20
key_back
sleep 1
wait_text 'route /guarded' 10
screenshot guarded-system-back
tap_text 'Allow leaving'
key_back
wait_gone 'route /guarded' 20
wait_text 'route /login' 10
screenshot allowed-system-back
echo 'System Back refused while dirty and returned to login after allowing'
