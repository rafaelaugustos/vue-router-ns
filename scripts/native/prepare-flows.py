"""Expose only the fixture's seeded document to the iOS Files picker."""
import pathlib
import plistlib

path = pathlib.Path(__file__).resolve().parents[2] / 'demo/App_Resources/iOS/Info.plist'
with path.open('rb') as source:
    config = plistlib.load(source)
config['UIFileSharingEnabled'] = True
config['LSSupportsOpeningDocumentsInPlace'] = True
with path.open('wb') as target:
    plistlib.dump(config, target, sort_keys=False)
