import { Application, Device, File, isIOS, knownFolders } from '@nativescript/core'
// Acceptance evidence only; read system preferences without changing them.
Application.on(Application.launchEvent, () =>
  setTimeout(() => {
    const environment = {
      package: 'vue-router-ns@0.1.0-rc.3',
      platform: Device.os,
      sdk: Device.sdkVersion,
      reduceMotion: isIOS ? UIAccessibilityIsReduceMotionEnabled() : null,
      contentSize: isIOS
        ? UIApplication.sharedApplication.preferredContentSizeCategory
        : null,
    }
    File.fromPath(
      `${knownFolders.documents().path}/consumer-environment.json`,
    ).writeTextSync(JSON.stringify(environment, null, 2))
  }, 300),
)
