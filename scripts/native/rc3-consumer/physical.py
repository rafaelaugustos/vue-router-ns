#!/usr/bin/env python3
"""Run the installed consumer on an unlocked iPhone, restoring OS preferences.

Requires a signed, already built ConsumerChecks runner and Xcode's devicectl
appearance/capture commands. Raw device metadata and recordings stay in --out;
only physical-summary.json is intended for the repository's evidence report.
"""
import argparse
import json
from pathlib import Path
import signal
import subprocess

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--device', required=True)
p.add_argument('--project', required=True)
p.add_argument('--derived-data', required=True)
p.add_argument('--out', required=True)
p.add_argument('--record', action='store_true',
               help='Try devicectl recording (requires device screenrecording capability)')
args = p.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=False)
app = 'org.nativescript.routerrc3validation'
report = {'package': 'vue-router-ns@0.1.0-rc.3', 'runs': [], 'restored': False}


def command(argv, timeout=45):
    return subprocess.run(argv, check=True, text=True, capture_output=True,
                          timeout=timeout).stdout


def device(*parts):
    return ['xcrun', 'devicectl', 'device', *parts, '--device', args.device]


def appearance(name):
    path = out / f'{name}-appearance.json'
    command(device('info', 'appearance') + ['--json-output', str(path), '--quiet'])
    raw = json.loads(path.read_text())['result']
    return {'textSize': raw['textSize'],
            'largerAccessibilitySizesEnabled': raw['largerAccessibilitySizesEnabled'],
            'reduceMotion': raw['reduceMotion']['enabled']}


def test(name, method):
    command(device('process', 'launch') + [app, '--quiet'])
    recording = None
    with (out / f'{name}-capture.log').open('w') as capture_log:
        if args.record:
            recording = subprocess.Popen(device('capture', 'screen-record') + [
                '--destination', str(out / f'{name}.mp4'), '--duration', '150'],
                stdout=capture_log, stderr=subprocess.STDOUT)
        try:
            with (out / f'{name}-xctest.log').open('w') as log:
                run = subprocess.run([
                    'xcodebuild', 'test-without-building', '-project', args.project,
                    '-scheme', 'ConsumerChecks', '-destination', f'platform=iOS,id={args.device}',
                    '-derivedDataPath', args.derived_data,
                    f'-only-testing:ConsumerChecks/ConsumerUITests/{method}',
                    '-collect-test-diagnostics', 'never',
                    '-resultBundlePath', str(out / f'{name}.xcresult'),
                ], stdout=log, stderr=subprocess.STDOUT, timeout=180)
        finally:
            if recording and recording.poll() is None:
                recording.send_signal(signal.SIGINT)
                try:
                    recording.wait(timeout=30)
                except subprocess.TimeoutExpired:
                    recording.terminate()
                    recording.wait(timeout=10)
    summary = json.loads(command(['xcrun', 'xcresulttool', 'get', 'test-results',
                                  'summary', '--path', str(out / f'{name}.xcresult'), '--compact']))
    record = {key: summary[key] for key in ['result', 'passedTests', 'failedTests', 'skippedTests']}
    record.update(name=name, method=method)
    record['durationSeconds'] = round(summary['finishTime'] - summary['startTime'], 3)
    config = summary.get('devicesAndConfigurations', [{}])[0].get('device', {})
    record['device'] = {k: config.get(k) for k in ['modelName', 'osVersion', 'osBuildNumber', 'platform']}
    report['runs'].append(record)
    if run.returncode != 0 or summary['passedTests'] != 1 or summary['failedTests'] != 0:
        raise RuntimeError(f'{name}: expected exactly one passed native test; see {name}-xctest.log')
    environment = out / f'{name}-environment.json'
    command(device('copy', 'from') + ['--source', 'Documents/consumer-environment.json',
            '--domain-type', 'appDataContainer', '--domain-identifier', app,
            '--destination', str(environment), '--quiet'])
    record['environment'] = json.loads(environment.read_text())
    if args.record:
        video = out / f'{name}.mp4'
        record['videoCaptured'] = video.exists() and video.stat().st_size > 0
        if not record['videoCaptured']:
            print(f'{name}: video unavailable; inspect {name}-capture.log', flush=True)
    print(name + ': passed', flush=True)


def interrupted(_signum, _frame):
    raise InterruptedError('Interrupted; restoring modified appearance settings')


signal.signal(signal.SIGTERM, interrupted)
before = appearance('before')
report['before'] = before
changed = False
try:
    test('baseline', 'testFirstAppFlow')
    changed = True  # Also restore if devicectl applies only part of the request.
    command(device('settings', 'appearance') + [
        '--larger-accessibility-sizes', 'on',
        '--text-size', 'accessibility-extra-extra-extra-large',
        '--reduce-motion', 'on', '--quiet'])
    report['requestedPreferences'] = appearance('requested')
    test('preferences', 'testSystemPreferences')
    observed = report['runs'][-1]['environment']
    if observed['reduceMotion'] is not True or observed['contentSize'] != 'UICTContentSizeCategoryAccessibilityXXXL':
        raise RuntimeError('The app did not observe the requested system preferences')
except BaseException as error:
    report['error'] = str(error)
    raise
finally:
    try:
        if changed:
            text_size = before['textSize'].strip().lower().replace(' ', '-')
            command(device('settings', 'appearance') + [
                '--text-size', text_size,
                '--larger-accessibility-sizes', 'on' if before['largerAccessibilitySizesEnabled'] else 'off',
                '--reduce-motion', 'on' if before['reduceMotion'] else 'off', '--quiet'])
        report['after'] = appearance('after')
        report['restored'] = report['after'] == before
        if not report['restored']:
            raise RuntimeError('Appearance restoration did not match the original values')
    finally:
        (out / 'physical-summary.json').write_text(json.dumps(report, indent=2) + '\n')
    print('Original appearance settings restored', flush=True)
