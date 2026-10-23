#!/usr/bin/env bash
# adb helpers for the Android smoke suite: everything reads the live view hierarchy.
ADB=${ADB:-adb}
PKG=${PKG:-org.nativescript.vuerouterns}
ACTIVITY=${ACTIVITY:-$PKG/com.tns.NativeScriptActivity}
OUT=${OUT:-scripts/native/out}
mkdir -p "$OUT"

dump() {
  $ADB shell rm -f /sdcard/ui.xml
  # Accessibility inspection can stall when the app is unresponsive. Keep the
  # failing process available for screenshots/logs instead of exhausting CI.
  node scripts/native/command-timeout.mjs 15000 $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  $ADB shell cat /sdcard/ui.xml 2>/dev/null
}
nodes() { dump | grep -o '<node[^>]*>'; }
has_text() { nodes | grep -c "text=\"$1\"" ; }
# Read the whole hierarchy: grep -q exits at the first match, which can give
# the producer SIGPIPE and turn a successful match into failure under pipefail.
has() { nodes | grep "$1" >/dev/null; }
# Center of the last node whose text matches, "x y".
center() {
  nodes | grep -i "text=\"$1\"" | tail -1 | grep -o 'bounds="[^"]*"' \
    | sed 's/\]\[/,/; s/[^0-9,]//g' | awk -F, '{printf "%d %d", ($1+$3)/2, ($2+$4)/2}'
}
tap_text() {
  local at; at=$(center "$1")
  [ -n "$at" ] || return 1
  $ADB shell input tap $at
}
trails() { nodes | grep -o 'text="/[^"]*"' | tr '\n' ' '; }
top_activity() { $ADB shell dumpsys activity activities | grep -m1 'topResumedActivity' | grep -o 'u0 [^ ]*' | cut -c4-; }
pid_of() { $ADB shell pidof "$PKG" | tr -d '\r'; }
screenshot() { $ADB exec-out screencap -p > "$OUT/$1.png" 2>/dev/null; }
link() { $ADB shell "am start -n $ACTIVITY -a android.intent.action.VIEW -d '$1'" >/dev/null 2>&1; }
launch() { $ADB shell am start -n "$ACTIVITY" >/dev/null 2>&1; }
key_back() { $ADB shell input keyevent 4; }
key_home() { $ADB shell input keyevent 3; }
# Finish first-boot launcher/package setup before measuring a cold app launch.
# This never starts/restarts the app under test. Preserve any failed startup.
prepare_home() {
  local launcher xml focused stable=0 recovered=0 deadline=$((SECONDS + 120))
  launcher=$($ADB shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r' | tail -1 | cut -d/ -f1)
  [ -n "$launcher" ] || return 1
  key_home
  while [ "$SECONDS" -lt "$deadline" ]; do
    xml=$(dump) || { stable=0; continue; }
    if [[ "$xml" == *"Pixel Launcher isn't responding"* ]]; then
      if [ "$recovered" = "0" ]; then
        printf '%s\n' "$xml" > "$OUT/launcher-preflight-anr.xml"
        screenshot launcher-preflight-anr
        # The system dialog can disappear between the two hierarchy reads.
        # Only count an actual dismissal; then wait for the launcher to settle
        # within the existing deadline, including its dialog's exit animation.
        if tap_text "Close app"; then
          recovered=1
          key_home
        fi
      fi
      stable=0
      continue
    fi
    focused=$($ADB shell dumpsys window | grep 'mCurrentFocus=')
    if [[ "$focused" == *"$launcher/"* && "$xml" == *"package=\"$launcher\""* ]]; then
      stable=$((stable + 1))
      if [ "$stable" -ge 2 ]; then
        printf '%s\n' "$xml" > "$OUT/launcher-ready.xml"
        return 0
      fi
    else
      stable=0
    fi
  done
  return 1
}
# Polls until a text shows up, or the timeout (seconds) passes. Returns 1 on timeout.
wait_text() {
  local text=$1 timeout=${2:-30} deadline
  deadline=$((SECONDS + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if has "text=\"$text\""; then return 0; fi
    sleep 2
  done
  return 1
}
# Polls until the hierarchy matches a pattern.
wait_has() {
  local pattern=$1 timeout=${2:-20} deadline
  deadline=$((SECONDS + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if has "$pattern"; then return 0; fi
    sleep 2
  done
  return 1
}
wait_gone() {
  local text=$1 timeout=${2:-20} deadline
  deadline=$((SECONDS + timeout))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if [ "$(has_text "$text")" = "0" ]; then return 0; fi
    sleep 2
  done
  return 1
}
