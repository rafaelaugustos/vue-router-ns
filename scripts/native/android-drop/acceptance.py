"""Native Android drag/drop, keyboard and TalkBack acceptance; see README.md."""
import json, os, socket, subprocess, time
from pathlib import Path

SERIAL = os.environ.get('ANDROID_SERIAL', 'emulator-5580')
assert SERIAL.startswith('emulator-'), 'Use a dedicated emulator'
ADB = ['adb', '-s', SERIAL]
PACKAGE = 'org.nativescript.vuerouterns'
SERVICE = 'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'
OUT = Path(os.environ.get('DROP_REPORT', '/tmp/router-android-drop'))
OUT.mkdir(parents=True, exist_ok=True)
REPORTS, TREES = [], []
sequence = 0

def run(*args):
    return subprocess.check_output(ADB + list(args), text=True, timeout=30, stderr=subprocess.DEVNULL)

def tree(label):
    output = run('shell', 'am', 'instrument', '-w', 'org.nativescript.dropinspector/.DropInspector')
    assert 'result=DROP_INSPECTOR_OK' in output, output
    nodes = json.loads(next(s.split('nodes=', 1)[1] for s in output.splitlines() if s.startswith('INSTRUMENTATION_RESULT: nodes=')))
    TREES.append({'stage': label, 'nodes': nodes})
    (OUT / 'trees.json').write_text(json.dumps(TREES, indent=2))
    return nodes

def node(nodes, label):
    matches = [n for n in nodes if n['visible'] and (n['text'] == label or n['description'].startswith(label))]
    assert len(matches) == 1, (label, matches)
    return matches[0]

def center(n):
    a,b,c,d = n['bounds']
    return str((a+c)//2), str((b+d)//2)

def tap(n): run('shell', 'input', 'tap', *center(n))

def hardware_touch(n, double=False):
    # A single console connection keeps double-tap timing independent of adb startup.
    # Device 0 uses pixels and enters the emulator's touchscreen/input-reader path.
    x,y = center(n)
    with socket.create_connection(('127.0.0.1', int(SERIAL.split('-')[1])), timeout=10) as console:
        def response():
            data = b''
            while not data.endswith(b'OK\r\n'):
                chunk = console.recv(4096)
                assert chunk and b'KO:' not in chunk, 'Emulator console rejected touch command'
                data += chunk
        response()
        token = (Path.home()/'.emulator_console_auth_token').read_text().strip()
        console.sendall(('auth '+token+'\n').encode())
        response()
        started = time.monotonic()
        for _ in range(2 if double else 1):
            console.sendall(f'event mouse {x} {y} 0 1\n'.encode()); response()
            time.sleep(.045 if double else .5)
            console.sendall(f'event mouse {x} {y} 0 0\n'.encode()); response()
            time.sleep(.045)
        if double:
            assert time.monotonic()-started < .28, 'Console double tap exceeded its timing budget'


def report(command, timeout=12):
    global sequence
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            value = json.loads(run('shell', 'run-as', PACKAGE, 'cat', 'files/android-drop.json'))
            if value['sequence'] > sequence:
                assert value['ok'], value
                assert value['command'] == command, value
                sequence = value['sequence']
                REPORTS.append(value)
                (OUT / 'android34.json').write_text(json.dumps(REPORTS, indent=2))
                print(command, value['drags'], value['drops'], flush=True)
                return value
        except (json.JSONDecodeError, subprocess.CalledProcessError): pass
        time.sleep(.15)
    raise AssertionError(('Report timed out', command))

def prepare(mode):
    tap(node(tree('prepare-'+mode), 'androiddrop:mode-'+mode+'.'))
    return report('prepare-'+mode)

def drag(mode):
    prepare(mode)
    nodes = tree('drag-'+mode)
    source = node(nodes, 'Document 7. Drag to Inbox')
    target = node(nodes, 'Cancel area' if mode == 'cancel' else 'Drop target:')
    run('shell', 'input', 'draganddrop', *center(source), *center(target), '1400')
    cancelled = mode in ['cancel','multiple','unsupported','disposed']
    return report(('cancel-' if cancelled else 'drop-')+mode)

original = {k:run('shell','settings','get','secure',k).strip() for k in ['enabled_accessibility_services','accessibility_enabled']}
recorder = None
try:
    assert original['enabled_accessibility_services'] in ['null',''], 'Start with accessibility services disabled on this dedicated emulator'
    run('shell','am','force-stop',PACKAGE)
    run('shell','run-as',PACKAGE,'rm','-f','files/android-drop.json')
    run('shell','am','start','-n',PACKAGE+'/com.tns.NativeScriptActivity')
    report('ready', 30)
    assert not subprocess.run(ADB+['shell','pidof','screenrecord'], capture_output=True, text=True).stdout.strip(), 'A screen recording is already running'
    recorder = subprocess.Popen(ADB+['shell','screenrecord','--size','540x1200','--bit-rate','2000000','--time-limit','180','/sdcard/android-drop.mp4'],stdout=(OUT/'record.log').open('w'),stderr=subprocess.STDOUT)
    time.sleep(.8)
    recorder_pid = run('shell','pidof','screenrecord').strip()
    assert recorder_pid.isdigit(), recorder_pid
    for mode in ['valid','repeat']:
        drag(mode)
    prepare('replay')
    for mode in ['cancel','multiple','unsupported','invalid','expired','removed','guard','disposed']:
        drag(mode)
    prepare('accessible')
    tap(node(tree('accessible-button'), 'Open document in Inbox'))
    report('command-accessible')
    prepare('keyboard')
    run('shell','input','keycombination','KEYCODE_CTRL_LEFT','KEYCODE_O')
    report('command-keyboard')
    prepare('talkback')
    run('shell','settings','put','secure','enabled_accessibility_services',SERVICE)
    run('shell','settings','put','secure','accessibility_enabled','1')
    time.sleep(3)
    before = tree('talkback-enabled')
    if any(n['package'] == 'com.google.android.permissioncontroller' for n in before):
        deny = node(before, 'Don’t allow')
        tap(deny)
        time.sleep(.5)
        current = tree('talkback-permission-focus')
        if any(n['package'] == 'com.google.android.permissioncontroller' for n in current):
            x,y = center(node(current, 'Don’t allow'))
            run('shell', f'input tap {x} {y}; input tap {x} {y}')
            time.sleep(.5)
        before = tree('talkback-permission-dismissed')
    button = node(before, 'Open document in Inbox')
    hardware_touch(button)
    time.sleep(.7)
    focused = node(tree('talkback-focus'), 'Open document in Inbox')
    assert focused['accessibilityFocused'], focused
    current = json.loads(run('shell','run-as',PACKAGE,'cat','files/android-drop.json'))
    assert current['sequence'] == sequence, 'Touch exploration activated the button prematurely'
    hardware_touch(focused, double=True)
    value = report('command-talkback')
    assert value['accessibility']['touchExploration'], value
    assert any(s in [SERVICE, 'com.google.android.marvin.talkback/.TalkBackService'] for s in value['accessibility']['services']), value
    tree('talkback-navigated')
    # Restore services before activating the final cleanup button normally.
    for k,v in original.items():
        run('shell','settings','delete' if v=='null' else 'put','secure',k,*([] if v=='null' else [v]))
    time.sleep(.7)
    prepare('clear')
    time.sleep(1)
    assert recorder.poll() is None, 'Recording ended before acceptance completed'
    assert len({v['process'] for v in REPORTS}) == 1, 'App process restarted'
    assert REPORTS[-1]['drags'] == 10 and REPORTS[-1]['drops'] == 6, REPORTS[-1]
    assert REPORTS[-1]['collections'] == 20, REPORTS[-1]
finally:
    for k,v in original.items():
        run('shell','settings','delete' if v=='null' else 'put','secure',k,*([] if v=='null' else [v]))
    restored = {k:run('shell','settings','get','secure',k).strip() for k in original}
    (OUT/'accessibility.json').write_text(json.dumps({'original':original,'restored':restored,'service':SERVICE,'inspection':'public UiAutomation FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES; read-only','activation':'emulator console touchscreen (device 0): touch exploration focus + double tap','speechAudioRecorded':False},indent=2))
    assert restored == original, (original,restored)
    if recorder:
        if recorder.poll() is None: run('shell','kill','-2',recorder_pid)
        recorder.wait(timeout=15)
        run('pull','/sdcard/android-drop.mp4',str(OUT/'raw.mp4'))
    (OUT/'logcat.log').write_text(run('logcat','-d','-t','2000'))
print('PASS Android drag/drop, keyboard and TalkBack', flush=True)
