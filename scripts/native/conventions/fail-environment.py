#!/usr/bin/env python3
"""Test-only xcodebuild shim: fail the runner's version probe, forward real builds."""
import json, os, subprocess, sys
parent = subprocess.check_output(['/bin/ps', '-p', str(os.getppid()), '-o', 'command='], text=True).strip()
if sys.argv[1:] == ['-version'] and 'scripts/native/conventions' in parent:
    with open(os.environ['VITE183_ENV_TRACE'], 'a') as out:
        out.write(json.dumps({'command': 'xcodebuild', 'args': sys.argv[1:], 'parent': parent, 'injectedExitCode': 7}) + '\n')
    sys.stderr.write('Controlled environment probe failure; actual native build remains enabled\n')
    sys.exit(7)
os.execv('/usr/bin/xcodebuild', ['xcodebuild', *sys.argv[1:]])
