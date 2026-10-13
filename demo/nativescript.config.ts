import type { NativeScriptConfig } from '@nativescript/core'

export default {
  id: 'org.nativescript.vuerouterns',
  appPath: 'src',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} satisfies NativeScriptConfig
