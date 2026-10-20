import pathlib
import plistlib
import sys

root = pathlib.Path.home() / 'Library/Developer/CoreSimulator/Devices' / sys.argv[1] / 'data/Containers/Shared/AppGroup'
for folder in root.iterdir():
    metadata = folder / '.com.apple.mobile_container_manager.metadata.plist'
    if not metadata.exists():
        continue
    with metadata.open('rb') as source:
        identifier = plistlib.load(source).get('MCMMetadataIdentifier')
    if identifier == 'group.com.apple.FileProvider.LocalStorage':
        document = folder / 'File Provider Storage/router-flow-external.txt'
        document.parent.mkdir(exist_ok=True)
        document.write_text('External flow acceptance document')
        print(document)
        break
else:
    raise RuntimeError('Simulator local Files storage is not initialized')
