/// <reference path="../node_modules/@nativescript/types/index.d.ts" />
declare const __FILE_ROUTING_TEST__: boolean
declare const __FILE_ROUTING_WATCH__: boolean
declare const __FILE_ROUTING_RUN__: string
declare module '*.css'
declare module '*.vue' {
  import type { DefineComponent } from 'nativescript-vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
