"""Opt-in single-Activity fixture settings; only ignored demo resources change."""
from pathlib import Path
import re
manifest = Path(__file__).resolve().parents[3] / 'demo/App_Resources/Android/src/main/AndroidManifest.xml'
xml = manifest.read_text()
xml = re.sub(r'android:label="[^"]*"', 'android:label="Intent Lab"', xml)
xml = re.sub(r'android:icon="[^"]*"', 'android:icon="@drawable/intent_lab"', xml)
xml = re.sub(r'android:launchMode="[^"]*"', 'android:launchMode="singleTask"', xml)
if 'android.permission.POST_NOTIFICATIONS' not in xml:
    xml = xml.replace('<application', '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n<application', 1)
if 'android:scheme="routerentries"' not in xml:
    xml = xml.replace('</activity>', '<intent-filter><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.DEFAULT" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="routerentries" /></intent-filter></activity>', 1)
manifest.write_text(xml)
icon = manifest.parent / 'res/drawable/intent_lab.xml'
icon.parent.mkdir(parents=True, exist_ok=True)
icon.write_text('''<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp" android:height="48dp" android:viewportWidth="48" android:viewportHeight="48">
    <path android:fillColor="#17656c" android:pathData="M0,0h48v48H0z" />
    <path android:fillColor="#ffffff" android:pathData="M10,10h16v8h8v-6l10,10 -10,10v-6H18V18H10z M10,30h8v8h-8z" />
</vector>''')
