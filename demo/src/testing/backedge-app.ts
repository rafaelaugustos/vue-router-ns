// Published Core control for #168: no Vue, router, custom transition or delegate.
import {
  Application,
  Button,
  Frame,
  GridLayout,
  ItemSpec,
  Label,
  Page,
  StackLayout,
  TextField,
} from '@nativescript/core'

const frame = new Frame()
function screen(title: string): Page {
  const page = new Page()
  page.actionBar.title = title
  page.backgroundColor = '#ffffff'
  const body = new StackLayout()
  body.padding = 16
  const label = new Label()
  label.text = title
  label.automationText = 'route'
  body.addChild(label)
  const field = new TextField()
  field.hint = 'Retained draft'
  body.addChild(field)
  const push = new Button()
  push.text = 'Push detail'
  push.on('tap', () => frame.navigate(() => screen('Detail')))
  body.addChild(push)
  page.content = body
  return page
}

let initialized = false
frame.on('loaded', () => {
  // Application's root/window is assigned after the initial loaded event.
  setTimeout(() => {
    if (initialized) return
    const controller = frame.ios.controller
    const parent =
      Application.getRootView().nativeViewProtected.window?.rootViewController
    if (!parent) throw new Error('Core Back control needs an attached root controller')
    initialized = true
    if (!controller.parentViewController) {
      parent.addChildViewController(controller)
      controller.didMoveToParentViewController(parent)
    }
    frame.navigate({ create: () => screen('Root'), animated: false })
  }, 0)
})

Application.run({
  create: () => {
    const inset = NSProcessInfo.processInfo.arguments.containsObject('full-width')
      ? 0
      : 280
    const grid = new GridLayout()
    grid.addRow(new ItemSpec(100, 'pixel'))
    grid.addRow(new ItemSpec(1, 'star'))
    grid.addColumn(new ItemSpec(inset, 'pixel'))
    grid.addColumn(new ItemSpec(1, 'star'))
    grid.backgroundColor = '#dbeafe'
    const title = new Label()
    title.text = 'Published NativeScript Frame control'
    GridLayout.setColumnSpan(title, 2)
    grid.addChild(title)
    GridLayout.setRow(frame, 1)
    GridLayout.setColumn(frame, 1)
    grid.addChild(frame)
    return grid
  },
})
