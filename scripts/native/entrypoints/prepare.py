"""Opt-in fixture resources, applied only to the demo's ignored App_Resources."""
from pathlib import Path
import plistlib
import re
import shutil
root = Path(__file__).resolve().parents[3] / 'demo' / 'App_Resources'
manifest = root / 'Android/src/main/AndroidManifest.xml'
xml = manifest.read_text()
xml = re.sub(r'android:launchMode="[^"]*"', 'android:launchMode="standard"', xml)
if 'router_entrypoints' not in xml:
    xml = xml.replace('</activity>', '''<meta-data android:name="android.app.shortcuts" android:resource="@xml/router_entrypoints" />
<intent-filter><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.DEFAULT" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="routerentries" /></intent-filter>
</activity>''', 1)
if 'org.nativescript.router.ShortcutEntryActivity' not in xml:
    xml = xml.replace('</application>', '<activity android:name="org.nativescript.router.ShortcutEntryActivity" android:exported="true" android:taskAffinity="" android:excludeFromRecents="true" android:theme="@android:style/Theme.NoDisplay" /></application>')
manifest.write_text(xml)
example = Path(__file__).resolve().parents[3] / 'examples/shortcuts/Android/src/main/java'
shutil.copytree(example, root / 'Android/src/main/java', dirs_exist_ok=True)
resources = root / 'Android/src/main/res'
(resources / 'xml').mkdir(exist_ok=True, parents=True)
(resources / 'values').mkdir(exist_ok=True, parents=True)
(resources / 'values/router_entrypoints.xml').write_text('''<resources><string name="entry_static">Static account</string></resources>''')
(resources / 'xml/router_entrypoints.xml').write_text('''<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
<shortcut android:shortcutId="static-account" android:enabled="true" android:shortcutShortLabel="@string/entry_static" android:icon="@mipmap/ic_launcher">
<intent android:action="android.intent.action.VIEW" android:targetPackage="org.nativescript.vuerouterns" android:targetClass="org.nativescript.router.ShortcutEntryActivity" android:data="vue-router-ns://shortcut/static-account?to=%7B%22name%22%3A%22account%22%7D&amp;v=2" />
</shortcut></shortcuts>''')
plist = root / 'iOS/Info.plist'
with plist.open('rb') as source:
    info = plistlib.load(source)
info['CFBundleDisplayName'] = 'Router Entries'
info['UIRequiresFullScreen'] = False
info.setdefault('UIApplicationSceneManifest', {})['UIApplicationSupportsMultipleScenes'] = True
info.setdefault('CFBundleURLTypes', []).append({'CFBundleTypeRole': 'Editor', 'CFBundleURLSchemes': ['routerentries']}) if not any('routerentries' in t.get('CFBundleURLSchemes', []) for t in info.get('CFBundleURLTypes', [])) else None
for item in info.get('CFBundleURLTypes', []):
    item.setdefault('CFBundleTypeRole', 'Editor')
with plist.open('wb') as target:
    plistlib.dump(info, target, sort_keys=False)
