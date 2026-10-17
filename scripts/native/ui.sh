#!/usr/bin/env bash
# adb helpers for the Android smoke suite: everything reads the live view hierarchy.
ADB=${ADB:-adb}
PKG=${PKG:-org.nativescript.vuerouterns}
ACTIVITY=${ACTIVITY:-$PKG/com.tns.NativeScriptActivity}
OUT=${OUT:-scripts/native/out}
mkdir -p "$OUT"

dump() {
  $ADB shell rm -f /sdcard/ui.xml
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  $ADB shell cat /sdcard/ui.xml 2>/dev/null
}
nodes() { dump | grep -o '<node[^>]*>'; }
has_text() { nodes | grep -c "text=\"$1\"" ; }
has() { nodes | grep -q "$1"; }
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
# Polls until a text shows up, or the timeout (seconds) passes. Returns 1 on timeout.
wait_text() {
  local text=$1 timeout=${2:-30} waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if [ "$(has_text "$text")" != "0" ]; then return 0; fi
    sleep 2; waited=$((waited + 2))
  done
  return 1
}
# Polls until the hierarchy matches a pattern.
wait_has() {
  local pattern=$1 timeout=${2:-20} waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if has "$pattern"; then return 0; fi
    sleep 2; waited=$((waited + 2))
  done
  return 1
}
wait_gone() {
  local text=$1 timeout=${2:-20} waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if [ "$(has_text "$text")" = "0" ]; then return 0; fi
    sleep 2; waited=$((waited + 2))
  done
  return 1
}
