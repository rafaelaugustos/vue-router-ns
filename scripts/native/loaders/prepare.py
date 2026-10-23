# Only the opt-in local HTTP fixture needs cleartext transport.
from pathlib import Path
import plistlib
p = Path('demo/App_Resources/iOS/Info.plist')
with p.open('rb') as f:
    info = plistlib.load(f)
info.setdefault('NSAppTransportSecurity', {})['NSAllowsLocalNetworking'] = True
with p.open('wb') as f:
    plistlib.dump(info, f)
p = Path('demo/App_Resources/Android/src/main/AndroidManifest.xml')
s = p.read_text()
if 'android:usesCleartextTraffic=' not in s:
    s = s.replace('<application', '<application android:usesCleartextTraffic="true"', 1)
else:
    s = s.replace('android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="true"')
p.write_text(s)
