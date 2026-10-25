import { createApp, defineComponent, h, ActionBar, $navigateTo } from 'nativescript-vue'
const args = NSProcessInfo.processInfo.arguments
let mode = 'none',
  frame,
  draft
for (let i = 0; i < args.count; i++) {
  const arg = String(args.objectAtIndex(i))
  if (arg.startsWith('direction-mode=')) mode = arg.slice(15)
}
const Detail = defineComponent({
  render() {
    return h('Page', {}, [
      h(ActionBar, { title: 'Detail' }),
      h('StackLayout', { padding: 24 }, [
        h('Label', { text: `Vue only: ${mode}`, fontSize: 20 }),
        h('TextField', {
          hint: 'Draft',
          automationText: 'Draft',
          ref: (n) => (draft = n?.nativeView),
        }),
        h('Button', { text: 'Dismiss keyboard', onTap: () => draft?.dismissSoftInput() }),
        h('Button', { text: 'Core back', onTap: () => frame.goBack() }),
      ]),
    ])
  },
})
const Home = defineComponent({
  render() {
    return h('Page', {}, [
      h(ActionBar, { title: 'Direction control' }),
      h('StackLayout', { padding: 24 }, [
        h('Label', { text: `Vue only: ${mode}`, fontSize: 20 }),
        h('Button', { text: 'Push detail', onTap: () => $navigateTo(Detail, { frame }) }),
      ]),
    ])
  },
})
createApp({
  render() {
    return h('GridLayout', { direction: mode === 'inherited-ltr' ? 'ltr' : undefined }, [
      h('Frame', { ref: (n) => (frame = n?.nativeView) }, [h(Home)]),
    ])
  },
}).start()
