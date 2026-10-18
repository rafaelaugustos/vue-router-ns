#!/usr/bin/env bash
# Exercise hierarchy matching without adb, including output larger than a pipe buffer.
set -uo pipefail
cd "$(dirname "$0")/../.."
source scripts/native/ui.sh

nodes() {
  printf '<node text="needle" />\n'
  printf '%1000000s\n' ''
}

if ! has 'text="needle"'; then
  echo 'FAIL: matching an early node must consume the complete hierarchy under pipefail'
  exit 1
fi
if has 'text="missing"'; then
  echo 'FAIL: an absent node must not match'
  exit 1
fi

# A partially read hierarchy must still report the producer's failure.
nodes() {
  printf '<node text="needle" />\n'
  return 17
}
status=0
has 'text="needle"' || status=$?
if [ "$status" -ne 17 ]; then
  echo "FAIL: hierarchy read failure was lost (status $status)"
  exit 1
fi
echo 'Hierarchy matching passed: early match, absent node and producer failure.'
