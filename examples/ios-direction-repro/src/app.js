import {
  Application,
  ActionBar,
  Button,
  File,
  Frame,
  GridLayout,
  Label,
  Page,
  StackLayout,
  TextField,
  TabView,
  TabViewItem,
  knownFolders,
} from '@nativescript/core'

// This application imports neither Vue nor vue-router-ns.
const args = NSProcessInfo.processInfo.arguments
const argument = (prefix) => {
  for (let i = 0; i < args.count; i++) {
    const value = String(args.objectAtIndex(i))
    if (value.startsWith(prefix)) return value.slice(prefix.length)
  }
}
const mode = argument('direction-mode=') ?? 'none'
const explicitBar = mode.startsWith('explicit-bar-')
const events = []
let startup
let root, frame
const earlyFrame = mode === 'prebuilt-frame-ltr' ? new Frame() : undefined
const earlyRoot = mode === 'prebuilt-root-ltr' ? new GridLayout() : undefined
function record(event) {
  const page = frame?.currentPage
  const controller = frame?.ios?.controller
  events.push({
    event,
    mode,
    startup,
    page: page?.actionBar?.title,
    history: frame?.backStack?.length,
    rootDirection: root?.style?.direction,
    frameDirection: frame?.style?.direction,
    pageDirection: page?.style?.direction,
    rootSemantic: root?.nativeViewProtected?.semanticContentAttribute,
    frameSemantic: frame?.nativeViewProtected?.semanticContentAttribute,
    pageSemantic: page?.nativeViewProtected?.semanticContentAttribute,
    swipeEnabled: controller?.interactivePopGestureRecognizer?.enabled,
  })
  File.fromPath(`${knownFolders.documents().path}/direction.json`).writeTextSync(
    JSON.stringify(events),
  )
  console.log(`DIRECTION ${JSON.stringify(events.at(-1))}`)
}
function button(text, tap) {
  const b = new Button()
  b.text = text
  b.on('tap', tap)
  return b
}
function detail() {
  const page = new Page()
  if (explicitBar) page.actionBar = new ActionBar()
  page.actionBar.title = 'Detail'
  const layout = new StackLayout()
  layout.padding = 24
  const title = new Label()
  title.text = `Mode: ${mode}`
  title.fontSize = 20
  layout.addChild(title)
  const draft = new TextField()
  draft.hint = 'Draft'
  draft.automationText = 'Draft'
  layout.addChild(draft)
  draft.on('focus', () => record('focus'))
  draft.on('textChange', () => record('text'))
  layout.addChild(button('Dismiss keyboard', () => draft.dismissSoftInput()))
  layout.addChild(button('Core back', () => frame.goBack()))
  if (mode === 'page-ltr') page.style.direction = 'ltr'
  page.content = layout
  page.on('navigatedTo', () => record('detail-ready'))
  return page
}
function home() {
  const page = new Page()
  if (explicitBar) page.actionBar = new ActionBar()
  page.actionBar.title = 'Direction control'
  const layout = new StackLayout()
  layout.padding = 24
  const title = new Label()
  title.text = `Core only: ${mode}`
  title.fontSize = 22
  layout.addChild(title)
  layout.addChild(button('Push detail', () => frame.navigate({ create: detail })))
  page.content = layout
  page.on('navigatedTo', () => record('home-ready'))
  return page
}
function createRoot() {
  root = earlyRoot ?? new GridLayout()
  frame = earlyFrame ?? new Frame()
  if (mode === 'early-frame-ltr') frame.navigate({ create: home, animated: false })
  if (
    mode === 'inherited-ltr' ||
    mode === 'tabs-ltr' ||
    mode === 'explicit-bar-ltr' ||
    mode === 'prebuilt-ltr' ||
    mode === 'early-frame-ltr' ||
    mode === 'prebuilt-frame-ltr' ||
    mode === 'prebuilt-root-ltr'
  )
    root.style.direction = 'ltr'
  if (mode === 'inherited-rtl') root.style.direction = 'rtl'
  if (mode === 'frame-ltr') frame.style.direction = 'ltr'
  if (mode.startsWith('tabs-')) {
    const tabs = new TabView()
    const first = new TabViewItem()
    first.title = 'Home'
    first.view = frame
    const second = new TabViewItem()
    second.title = 'Settings'
    const other = new Frame()
    other.navigate({
      create: () => {
        const p = new Page()
        p.actionBar.title = 'Settings'
        return p
      },
      animated: false,
    })
    second.view = other
    tabs.items = [first, second]
    root.addChild(tabs)
  } else root.addChild(frame)
  root.on('loaded', () => {
    if (mode === 'late-ltr' || mode === 'prebuilt-late-ltr') root.style.direction = 'ltr'
    if (mode === 'container-ltr') root.nativeViewProtected.semanticContentAttribute = 3
    record('loaded')
  })
  if (mode !== 'early-frame-ltr') frame.navigate({ create: home, animated: false })
  return root
}
// Match renderers that assemble their native tree before Application.run().
// Keep the failing startup order explicit; moving direction to loaded is only a control.
const prebuilt = [
  'prebuilt-none',
  'prebuilt-ltr',
  'prebuilt-late-ltr',
  'prebuilt-request-layout',
  'prebuilt-load-view',
].includes(mode)
  ? createRoot()
  : undefined
if (prebuilt) {
  const controller = frame.ios.controller
  const loadedBefore = Boolean(controller.viewIfLoaded)
  if (mode === 'prebuilt-request-layout') frame.requestLayout()
  if (mode === 'prebuilt-load-view') void controller.view
  startup = { loadedBefore, loadedAfter: Boolean(controller.viewIfLoaded) }
  console.log(`DIRECTION STARTUP ${JSON.stringify(startup)}`)
}
Application.run({ create: () => prebuilt ?? createRoot() })
