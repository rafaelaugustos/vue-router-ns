"""TalkBack speech acceptance on a prepared emulator (see consumer README).
Uses native accessibility activation and keyboard Tab traversal; does not claim TalkBack touch-gesture coverage.
No app instrumentation or replacement TTS engine. Restores service settings.
"""
import json, os, re, select, subprocess, time
from pathlib import Path

ADB = ['adb', '-s', os.environ.get('ANDROID_SERIAL', 'emulator-5560')]
PACKAGE = 'org.nativescript.routerrc3validation'
SERVICE = 'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'
OUT = Path(os.environ.get('CONSUMER_REPORT', '/tmp/router-consumer-talkback'))
OUT.mkdir(parents=True, exist_ok=True)

def run(*args):
    return subprocess.check_output(ADB + list(args), text=True, timeout=60)

def lines():
    return [s for s in run('logcat', '-d').splitlines()
            if 'SpeechControllerImpl: Speaking fragment text=' in s or 'FailoverTextToSpeech: Received utterance completed' in s]

seen = set(lines())
evidence = []
def collect(stage, forbidden=(), required=None):
    time.sleep(5)
    current = lines()
    fresh = [s for s in current if s not in seen]
    seen.update(current)
    spoken = [re.search(r'Speaking fragment text="(.*)", utteranceId=', s).group(1)
              for s in fresh if 'Speaking fragment text=' in s]
    evidence.append({'stage': stage, 'utterances': spoken, 'serviceLog': fresh})
    (OUT / 'speech.json').write_text(json.dumps(evidence, indent=2))
    print(stage, spoken, flush=True)
    for text in forbidden:
        assert all(text.lower() not in s.lower() for s in spoken), (stage, 'Covered content spoken', text)
    if required:
        assert any(required.lower() in s.lower() for s in spoken), (stage, 'Expected speech missing', required)
    return spoken

helper = None
def tree(label=''):
    helper.stdin.write(label+'\n'); helper.stdin.flush()
    assert select.select([helper.stdout], [], [], 30)[0], 'Tree helper timed out'
    response = json.loads(helper.stdout.readline())
    assert 'error' not in response, response
    return response['nodes']
def nodes(): return tree()
def tap(label): tree(label)

def key(code): run('shell', 'input', 'keyevent', str(code))
def scan(stage, forbidden):
    combined=[]
    for i in range(4):
        key(61)
        combined += collect(f'{stage}-tab-{i+1}', forbidden)
    focused = [n for n in nodes() if n['accessibilityFocused'] and n['visible']]
    assert focused, ('No visible accessibility focus', stage)
    for n in focused:
        assert not any(text.lower() in (n['text']+' '+n['description']).lower() for text in forbidden)
    evidence.append({'stage':stage+'-focus', 'visibleFocus':focused, 'utterances':[], 'serviceLog':[]})
    return combined

original = {k:run('shell','settings','get','secure',k).strip()
            for k in ['enabled_accessibility_services','accessibility_enabled']}
try:
    assert SERVICE in original['enabled_accessibility_services'], 'Enable TalkBack and verbose speech logging before this runner'
    run('shell','am','force-stop',PACKAGE)
    run('shell','am','start','-n',PACKAGE+'/com.tns.NativeScriptActivity')
    collect('home', required='Pocket notes')
    helper = subprocess.Popen(ADB+['shell','CLASSPATH=/data/local/tmp/consumer-tree.jar app_process / ConsumerTree'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=(OUT/'tree-stderr.log').open('w'), text=True)
    assert json.loads(helper.stdout.readline()) == {'ready':True}
    tap('Along the coast')
    collect('push', required='Along the coast')
    scan('detail', ['Into the forest', 'Find a note', 'Save note'])
    tap('Edit in a modal')
    collect('modal-open', required='Edit note')
    spoken = scan('modal', ['Along the coast', 'Edit in a modal', 'Into the forest'])
    assert any('save note' in s.lower() for s in spoken)
    key(4)
    collect('keyboard-dismiss')
    tap('Cancel')
    collect('modal-return', required='Edit in a modal')
    scan('returned-detail', ['Note draft', 'Save note', 'Into the forest'])
    tap('Edit in a modal')
    collect('guard-modal-open', required='Edit note')
    tap('Note draft')
    run('shell','input','text','a')
    collect('edit')
    key(4)
    collect('guard-keyboard-dismiss')
    tap('Cancel')
    collect('guard-open', required='Discard changes')
    spoken = scan('guard', ['Along the coast', 'Edit in a modal', 'Save note'])
    assert any('keep editing' in s.lower() for s in spoken)
    tap('Keep editing')
    collect('guard-refused')
    scan('retained-modal', ['Along the coast', 'Edit in a modal', 'Into the forest'])
    key(4)
    collect('retained-keyboard-dismiss')
    tap('Cancel')
    collect('discard-open', required='Discard changes')
    tap('Discard')
    collect('discard-return', required='Edit in a modal')
    scan('discarded-detail', ['Note draft', 'Save note', 'Keep editing'])
    assert any('returned true' in s for e in evidence for s in e['serviceLog']), 'No TTS completion evidence'
finally:
    try:
        if helper:
            helper.stdin.write('quit\n')
            helper.stdin.flush()
            helper.wait(timeout=15)
    finally:
        for k,v in original.items():
            run('shell','settings','delete' if v=='null' else 'put','secure',k,*([] if v=='null' else [v]))
        restored = {k:run('shell','settings','get','secure',k).strip() for k in original}
        assert restored == original, ('Service settings not restored', original, restored)

(OUT/'speech.json').write_text(json.dumps(evidence, indent=2))
(OUT/'result.json').write_text(json.dumps({
    'passed':True, 'hardware':'emulator only',
    'input':'native accessibility activation and keyboard Tab',
    'speech':'TalkBack SpeechControllerImpl + TTS completion callbacks',
    'touchGestureTraversal':False, 'originalServiceSettings':original,
    'restoredServiceSettings':restored,
},indent=2))
