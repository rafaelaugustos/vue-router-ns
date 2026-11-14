"""Only the opt-in demo's ignored iOS resources are changed."""
from pathlib import Path
import plistlib

path = Path(__file__).resolve().parents[3] / 'demo/App_Resources/iOS/Info.plist'
if not path.exists():
    raise SystemExit('Generate demo/App_Resources first; see demo/README.md.')
info = plistlib.loads(path.read_bytes())
info['CFBundleDisplayName'] = 'Router Drop'
info['UIApplicationSceneManifest'] = {
    'UIApplicationPreferredDefaultSceneSessionRole': 'UIWindowSceneSessionRoleApplication',
    'UIApplicationSupportsMultipleScenes': True,
}
info['UIRequiresFullScreen'] = False
info['UTExportedTypeDeclarations'] = [{
    'UTTypeIdentifier': 'org.nativescript.vue-router-ns.destination',
    'UTTypeConformsTo': ['public.data'],
    'UTTypeDescription': 'Router destination',
}]
path.write_bytes(plistlib.dumps(info, sort_keys=False))
