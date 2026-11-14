"""Prepare only ignored demo resources for the declared system window-drag activity."""
from pathlib import Path
import plistlib, runpy
root = Path(__file__).resolve().parents[3]
runpy.run_path(str(root / 'scripts/native/drag-drop/prepare.py'))
p = root / 'demo/App_Resources/iOS/Info.plist'
info = plistlib.loads(p.read_bytes())
info['NSUserActivityTypes'] = list(dict.fromkeys(info.get('NSUserActivityTypes', []) + ['org.nativescript.vuerouterns.window-drag']))
p.write_bytes(plistlib.dumps(info, sort_keys=False))
