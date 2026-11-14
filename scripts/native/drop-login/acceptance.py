"""Real Android drags into app-owned Login Pages; see README.md."""
import json, os, subprocess, time
from pathlib import Path

SERIAL=os.environ.get('ANDROID_SERIAL','emulator-5580')
assert SERIAL.startswith('emulator-'), 'Use a dedicated emulator'
ADB=['adb','-s',SERIAL]
PACKAGE='org.nativescript.vuerouterns'
OUT=Path(os.environ.get('DROP_LOGIN_REPORT','/tmp/router-drop-login'))
OUT.mkdir(parents=True,exist_ok=True)
reports=[]
sequence=0

def run(*args):
    return subprocess.check_output(ADB+list(args),text=True,timeout=30,stderr=subprocess.DEVNULL)

def tree():
    text=run('shell','am','instrument','-w','org.nativescript.dropinspector/.DropInspector')
    assert 'result=DROP_INSPECTOR_OK' in text,text
    return json.loads(next(s.split('nodes=',1)[1] for s in text.splitlines() if s.startswith('INSTRUMENTATION_RESULT: nodes=')))

def node(nodes,label):
    matches=[n for n in nodes if n['visible'] and n['description'].startswith(label)]
    assert len(matches)==1,(label,matches)
    return matches[0]

def center(n):
    a,b,c,d=n['bounds'];return str((a+c)//2),str((b+d)//2)

def report(command,timeout=15):
    global sequence
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        try:
            value=json.loads(run('shell','run-as',PACKAGE,'cat','files/drop-login.json'))
            if value['sequence']>sequence:
                assert value['ok'] and value['command']==command,value
                sequence=value['sequence'];reports.append(value)
                (OUT/'android34.json').write_text(json.dumps(reports,indent=2))
                print(command,value['drags'],value['drops'],flush=True)
                return value
        except (subprocess.CalledProcessError,json.JSONDecodeError):pass
        time.sleep(.15)
    raise AssertionError(('Timed out',command))

def tap(name):run('shell','input','tap',*center(node(tree(),'droplogin:'+name+'.')))
def press(name,expected=None):
    tap(name);return report(expected or name)
def prepare(mode):press('mode-'+mode,'prepare-'+mode)
def drag(mode):
    prepare(mode);nodes=tree()
    run('shell','input','draganddrop',*center(node(nodes,'Protected document 7.')),*center(node(nodes,'Drop protected document into Inbox')),'1200')
    value=report('drop-'+mode)
    assert value['result']['status']==('handled' if mode=='direct' else 'suspended'),value
    if mode!='direct':assert value['stacks']['target']['native']==['/inbox','/login'],value
    return value

recorder=None
try:
    assert run('shell','settings','get','secure','enabled_accessibility_services').strip() in ['null',''], 'Run with accessibility services disabled; TalkBack is covered separately'
    run('shell','am','force-stop',PACKAGE)
    run('shell','run-as',PACKAGE,'rm','-f','files/drop-login.json')
    run('shell','am','start','-n',PACKAGE+'/com.tns.NativeScriptActivity')
    report('ready',30)
    assert not subprocess.run(ADB+['shell','pidof','screenrecord'],capture_output=True,text=True).stdout.strip(), 'Another recording is running'
    recorder=subprocess.Popen(ADB+['shell','screenrecord','--size','540x1200','--bit-rate','2000000','--time-limit','180','/sdcard/drop-login.mp4'],stdout=(OUT/'record.log').open('w'),stderr=subprocess.STDOUT)
    time.sleep(.7);recorder_pid=run('shell','pidof','screenrecord').strip();assert recorder_pid.isdigit()
    drag('success');press('early');press('repeat','replay');press('sign-in','sign-in-success');press('repeat','again')
    drag('cancel');press('cancel-login')
    drag('back');run('shell','input','keyevent','KEYCODE_BACK');report('native-back')
    for mode in ['account','removed','expire','guard']:
        drag(mode);press('sign-in','sign-in-'+mode)
    drag('race');press('sign-in','guard-waiting');press('revoke','sign-in-race')
    drag('dispose');press('dispose-target')
    drag('supersede');press('newer');press('sign-in','sign-in-supersede')
    drag('direct')
    prepare('button');press('open','command-button');press('sign-in','sign-in-button')
    prepare('keyboard');run('shell','input','keycombination','KEYCODE_CTRL_LEFT','KEYCODE_O');report('command-keyboard');press('sign-in','sign-in-keyboard')
    press('clear');time.sleep(1)
    assert recorder.poll() is None,'Recording ended before acceptance'
    assert len(reports)==45, len(reports)
    assert len({r['process'] for r in reports})==1
    assert reports[-1]['drags']==11 and reports[-1]['drops']==11 and reports[-1]['collections']==22,reports[-1]
finally:
    if recorder:
        if recorder.poll() is None:run('shell','kill','-2',recorder_pid)
        recorder.wait(timeout=15);run('pull','/sdcard/drop-login.mp4',str(OUT/'raw.mp4'))
    (OUT/'logcat.log').write_text(run('logcat','-d','-t','2000'))
print('PASS drop login and explicit resumption',flush=True)
