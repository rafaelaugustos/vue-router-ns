#!/usr/bin/env bash
# Install the --env.stateTest APK first. Clears only the test application's data.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${ANDROID_SERIAL:?Set ANDROID_SERIAL to a test emulator or device}"
OUT=${OUT:-scripts/native/out/state}
source scripts/native/ui.sh

$ADB wait-for-device
$ADB shell am force-stop "$PKG"
$ADB shell pm clear "$PKG" >/dev/null
$ADB logcat -c
$ADB logcat -v brief -s JS AndroidRuntime > "$OUT/runtime.log" &
log_pid=$!
finish() {
  local result=$?
  if [ "$result" != 0 ]; then
    screenshot failure || true
    dump > "$OUT/failure.xml" || true
    tail -60 "$OUT/runtime.log"
  fi
  kill "$log_pid" 2>/dev/null || true
  wait "$log_pid" 2>/dev/null || true
}
trap finish EXIT
printf '[]\n' > "$OUT/processes.json"

capture() {
  screenshot "$1"
  dump > "$OUT/$1.xml"
}
restart_process() {
  local scenario=$1 before after remaining method=am-kill
  before=$(pid_of)
  [[ "$before" =~ ^[0-9]+$ ]] || { echo 'No single app process to kill'; exit 1; }
  key_home
  sleep 2
  $ADB shell am kill "$PKG"
  sleep 2
  remaining=$(pid_of || true)
  # Android may retain the last foreground app above am kill's cached threshold.
  # Kill only the same debuggable app PID, retaining its task and persisted state.
  if [ "$remaining" = "$before" ]; then
    method=run-as-kill
    $ADB shell run-as "$PKG" kill -9 "$before"
    sleep 1
    remaining=$(pid_of || true)
  fi
  [ -z "$remaining" ] || { echo "Process did not die: $remaining"; exit 1; }
  launch
  for _ in {1..30}; do
    after=$(pid_of || true)
    [ -n "$after" ] && break
    sleep 1
  done
  [[ "$after" =~ ^[0-9]+$ ]] && [ "$after" != "$before" ]
  node --input-type=module - "$OUT/processes.json" "$scenario" "$before" "$after" "$method" <<'JS'
import fs from 'node:fs'
const [file, scenario, before, after, method] = process.argv.slice(2)
const records = JSON.parse(fs.readFileSync(file, 'utf8'))
records.push({ scenario, before: Number(before), after: Number(after), method })
fs.writeFileSync(file, JSON.stringify(records, null, 2) + '\n')
JS
}

launch
wait_text 'PASS: prepared' 40
wait_text 'second draft'
capture 01-prepared
restart_process duplicates
wait_text 'PASS: duplicate top' 40
wait_text 'second draft'
capture 02-duplicate-top
tap_text 'Verify previous'
wait_text 'PASS: duplicate previous'
wait_text 'first draft'
capture 03-duplicate-previous

for scenario in migration expired missing signed-out legacy; do
  tap_text 'Next scenario'
  wait_text "READY: $scenario"
  restart_process "$scenario"
  wait_text "PASS: $scenario" 40
  if [ "$scenario" = migration ]; then wait_text 'migrated draft'; fi
  capture "$scenario"
done

node --input-type=module - "$OUT/runtime.log" "$OUT/results.json" "$OUT/processes.json" <<'JS'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const log = fs.readFileSync(process.argv[2], 'utf8')
const results = log.split('\n').filter(line => line.includes('STATE_RESULT ')).map(line =>
  JSON.parse(line.slice(line.indexOf('STATE_RESULT ') + 'STATE_RESULT '.length)),
)
assert.deepEqual(results.map(result => result.stage), [
  'prepared', 'duplicate top', 'duplicate previous', 'migration', 'expired', 'missing', 'signed-out', 'legacy',
])
assert.ok(results.every(result => result.ok === true))
assert.ok(!/FATAL EXCEPTION|STATE_RESULT .*"ok":false/.test(log))
const processes = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
assert.equal(processes.length, 6)
assert.ok(processes.every(process => process.before !== process.after))
fs.writeFileSync(process.argv[3], JSON.stringify({ ok: true, results, processes }, null, 2) + '\n')
console.log('Passed duplicate draft/scroll restoration and five compatibility scenarios across six process deaths')
JS
