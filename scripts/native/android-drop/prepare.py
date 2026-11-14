"""Opt-in fixture label/launch mode; shared drag bridge needs no manifest permissions."""
from pathlib import Path
import re

path = Path(__file__).resolve().parents[3] / 'demo/App_Resources/Android/src/main/AndroidManifest.xml'
if not path.exists():
    raise SystemExit('Generate demo/App_Resources first; see demo/README.md.')
xml = path.read_text()
xml = re.sub(r'android:label="[^"]*"', 'android:label="Router Drop"', xml)
xml = re.sub(r'android:launchMode="[^"]*"', 'android:launchMode="singleTask"', xml)
path.write_text(xml)
