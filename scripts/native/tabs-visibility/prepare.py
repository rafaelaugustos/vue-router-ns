# Add the fixture's URL scheme without replacing existing app resources.
from pathlib import Path
import plistlib

p = Path('demo/App_Resources/iOS/Info.plist')
with p.open('rb') as f:
    info = plistlib.load(f)
entries = info.setdefault('CFBundleURLTypes', [])
if not any('vuerouterns' in entry.get('CFBundleURLSchemes', []) for entry in entries):
    entries.append({'CFBundleTypeRole': 'Editor', 'CFBundleURLName': 'Router visibility', 'CFBundleURLSchemes': ['vuerouterns']})
with p.open('wb') as f:
    plistlib.dump(info, f)
