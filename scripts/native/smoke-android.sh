#!/usr/bin/env bash
# Native smoke suite for the demo on an Android emulator or device.
#
#   npm run build && (cd demo && ns build android) && npm run test:native:android
#
# Drives the installed demo through adb and checks what the automated shim
# cannot: real links, the Material sheet, shortcuts, process death, the drawer
# and the router's own timings against scripts/native/baselines.json.
set -uo pipefail
cd "$(dirname "$0")/../.."
source scripts/native/ui.sh
APK=${APK:-demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk}
BASELINES=${BASELINES:-scripts/native/baselines.json}
failures=0
results=()
check() {
  local name=$1 ok=$2 detail=${3:-}
  if [ "$ok" = "0" ]; then results+=("ok    $name  $detail"); else results+=("FAIL  $name  $detail"); failures=$((failures + 1)); fi
}
step() { echo; echo "== $*"; }

step "device"
$ADB wait-for-device || exit 2
$ADB shell getprop ro.build.version.sdk | tr -d '\r' | sed 's/^/API /'
[ -f "$APK" ] || { echo "no APK at $APK"; exit 2; }
$ADB install -r "$APK" | tail -1 || exit 2
$ADB shell pm clear "$PKG" >/dev/null || exit 2
$ADB logcat -c || exit 2
# Stream from launch: a slow/failing startup can overflow logcat's ring buffer.
$ADB logcat -v threadtime > "$OUT/logcat.txt" 2>&1 &
logcat_pid=$!
trap 'kill "$logcat_pid" 2>/dev/null || true; wait "$logcat_pid" 2>/dev/null || true' EXIT

step "cold starts"
for attempt in 1 2 3; do
  if [ "$attempt" != "1" ]; then $ADB shell pm clear "$PKG" >/dev/null || exit 2; fi
  launch
  wait_text "Inbox (2)" 60
  status=$?
  check "cold start $attempt shows the inbox" "$status" "$(top_activity)"
  screenshot "01-inbox-$attempt"
  dump > "$OUT/01-startup-$attempt.xml"
  $ADB shell dumpsys activity activities > "$OUT/01-startup-$attempt-activities.txt" 2>&1
  # Preserve the first failed process instead of restarting into a working one.
  if [ "$status" != "0" ]; then printf '%s\n' "${results[@]}"; exit 1; fi
done

step "native tab selection"
tap_text Settings && wait_text Guest 15; check "settings tab selects its stack" $?
tap_text Inbox && wait_text "Inbox (2)" 15; check "inbox tab keeps its root" $?

step "cold link into a message"
$ADB shell am force-stop "$PKG"; sleep 1
link "vuerouterns://messages/2"
wait_text "Release 2.4.0 is out" 60; check "cold link opens the message" $? "$(trails)"
has "/messages/2"; check "cold link keeps the inbox below" $?
screenshot 02-cold-link
tap_text Inbox && wait_has 'text="/"' 15; check "reselect returns the inbox to its root" $?
link "vuerouterns://messages/2"
wait_has '/messages/2' 15; check "message link opens after reselect" $?

step "warm link into a guarded route"
link "vuerouterns://settings/account"
wait_text "Sign in" 20; check "guarded link lands on the login" $?
screenshot 03-guarded-link
tap_text Inbox && wait_has '/messages/2' 15; check "switching tabs preserves the message stack" $?
tap_text Settings && wait_text "Sign in" 15; check "switching back preserves the login stack" $?

step "page state survives process death"
$ADB shell input tap $(center "Your name") 2>/dev/null || $ADB shell input tap 540 1200
sleep 1.5
$ADB shell input text "Rafa"; sleep 0.5; key_back; sleep 1
has 'text="Rafa"'; check "name typed" $?
before=$(pid_of)
key_home; sleep 3
$ADB shell am kill "$PKG"; sleep 2
[ -z "$(pid_of)" ]; check "process killed (was $before)" $?
launch
wait_text "Sign in" 60; check "login page restored" $?
has 'text="Rafa"'; check "typed name restored (pid $(pid_of))" $?
screenshot 04-restored
# sign in with the restored name: the login page's own leave guard would otherwise ask on the way out
$ADB shell input tap $(center Rafa) 2>/dev/null; sleep 1
$ADB shell input keyevent 66; sleep 3
wait_text "Account" 15; check "signing in replaces the login" $?

step "modal link and Material bottom sheet"
link "vuerouterns://compose"
wait_text "New message" 20; check "modal route presented from a link" $?
key_back; sleep 2
wait_gone "New message" 10; check "modal closed by back" $?
tap_text Inbox; sleep 2
wait_has 'text="Inbox (' 10
tap_text COMPOSE
wait_has "design_bottom_sheet" 15; check "compose opens a Material bottom sheet" $?
screenshot 05-sheet
key_back; sleep 2
wait_gone "New message" 10; check "sheet closed by back" $?

step "home-screen shortcuts"
ids=$($ADB shell dumpsys shortcut 2>/dev/null | sed -n "/Package: $PKG/,/Package: /p" | grep -o 'ShortcutInfo {id=[a-z_]*' | sed 's/ShortcutInfo {id=//' | tr '\n' ' ')
echo "$ids" | grep -q compose && echo "$ids" | grep -q settings; check "dynamic shortcuts published" $? "$ids"
link "vue-router-ns://shortcut/compose?to=%2Fcompose&v=1"
wait_text "New message" 20; check "shortcut payload opens compose" $?
key_back; sleep 2

step "drawer"
wait_has 'text="Inbox (' 10
tap_text MENU
wait_text "vue-router-ns" 10; check "menu action opens the drawer" $?
screenshot 06-drawer
key_back; sleep 2
wait_gone "vue-router-ns" 10 && has 'text="Inbox ('; check "back closes the drawer, not the page" $?

step "timings against baselines"
link "vuerouterns://diagnostics/export"; sleep 3
summary=$($ADB logcat -d 2>/dev/null | grep -o '\[vue-router-ns:baseline\] .*' | tail -1 | sed 's/\[vue-router-ns:baseline\] //')
if [ -n "$summary" ]; then
  echo "$summary" > "$OUT/baseline-measured.json"
  verdict=$(node -e '
    const measured = JSON.parse(process.argv[1]); const limits = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
    const lines = []; let bad = 0;
    const ms = (value) => Math.round(value);
    for (const [phase, limit] of Object.entries(limits.phases)) {
      const got = measured.phases[phase];
      if (!got) { lines.push(`${phase}: no spans`); continue; }
      const over = got.p50 > limit.p50Max || got.max > limit.max;
      if (over) bad++;
      lines.push(`${phase}: p50 ${ms(got.p50)}ms (limit ${limit.p50Max}) max ${ms(got.max)}ms (limit ${limit.max}) over ${got.count} spans${over ? " OVER" : ""}`);
    }
    if (measured.issues.length) { bad++; lines.push(`issues: ${JSON.stringify(measured.issues)}`); }
    console.log(lines.join("\n")); process.exit(bad ? 1 : 0);
  ' "$summary" "$BASELINES")
  status=$?
  echo "$verdict"
  check "router timings within baselines" $status
else
  check "router timings within baselines" 1 "no summary in logcat"
fi
$ADB logcat -d 2>/dev/null | grep -E "JS.*(ERROR|Error:)|System.err.*vue-router|TNS.Native.*(Error:|Exception:)|AndroidRuntime.*FATAL EXCEPTION" | tail -5 > "$OUT/errors.log"
[ ! -s "$OUT/errors.log" ]; check "no JavaScript errors logged" $?

echo
echo "== results"
printf '%s\n' "${results[@]}"
echo "screenshots and logs in $OUT"
[ "$failures" = "0" ]
