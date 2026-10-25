import { createApp, defineComponent, h, ref, ActionBar } from 'nativescript-vue'
import {
  createRouter,
  RouterView,
  RouterTabs,
  RouterTab,
  onBeforeRouteLeave,
} from 'vue-router-ns'
const args = NSProcessInfo.processInfo.arguments
let mode = 'none'
for (let i = 0; i < args.count; i++) {
  const arg = String(args.objectAtIndex(i))
  if (arg.startsWith('direction-mode=')) mode = arg.slice(15)
}
const Screen = defineComponent({
  setup() {
    const blocked = ref(false)
    onBeforeRouteLeave(() => false, { when: blocked })
    return () =>
      h('Page', { direction: mode === 'page-ltr' ? 'ltr' : undefined }, [
        h(ActionBar, {
          title: router.currentRoute.value.path === '/' ? 'Direction control' : 'Detail',
        }),
        h('StackLayout', { padding: 24 }, [
          h('Label', { text: `Router rc.3: ${mode}`, fontSize: 20 }),
          router.currentRoute.value.path === '/'
            ? h('Button', { text: 'Push detail', onTap: () => router.push('/detail') })
            : h('StackLayout', {}, [
                h('TextField', {
                  hint: 'Draft',
                  automationText: 'Draft',
                  ref: (node) => {
                    draft = node?.nativeView
                  },
                }),
                h('Button', {
                  text: 'Dismiss keyboard',
                  onTap: () => draft?.dismissSoftInput(),
                }),
                h('Button', { text: 'Core back', onTap: () => router.back() }),
              ]),
        ]),
      ])
  },
})
let draft
const router = createRouter({
  routes: [
    { path: '/', component: Screen },
    { path: '/detail', component: Screen },
  ],
})
createApp({
  render() {
    return h(
      'GridLayout',
      {
        direction: mode === 'inherited-ltr' || mode === 'tabs-ltr' ? 'ltr' : undefined,
        onLoaded: (e) => {
          if (mode === 'container-ltr')
            e.object.nativeViewProtected.semanticContentAttribute = 3
        },
      },
      [
        mode.startsWith('tabs-')
          ? h(RouterTabs, {}, () => [
              h(RouterTab, { name: 'home', title: 'Home' }, () =>
                h(RouterView, { name: 'home' }),
              ),
              h(RouterTab, { name: 'settings', title: 'Settings' }, () =>
                h(RouterView, { name: 'settings' }),
              ),
            ])
          : h(RouterView, { direction: mode === 'frame-ltr' ? 'ltr' : undefined }),
      ],
    )
  },
})
  .use(router)
  .start()
