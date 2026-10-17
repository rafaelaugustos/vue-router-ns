/**
 * Enough of nativescript-vue to run the router: a renderer whose elements
 * carry fake native views, and $navigateTo / $showModal mounting every page
 * and modal as a separate app sharing the root app's context, like the real one.
 */
import {
  createRenderer,
  type App,
  type Component,
  type ComponentPublicInstance,
} from '@vue/runtime-core'
import { Frame, Page, TabView, TabViewItem, View, type NavigationEntry } from './core.js'

export * from '@vue/runtime-core'
export function registerElement(_name: string, _resolver: () => unknown) {}

export class TestNode {
  parentNode: TestNode | null = null
  children: TestNode[] = []
  text = ''
  handlers: Record<string, (...args: unknown[]) => void> = {}

  constructor(
    public tag: string,
    public nativeView: any,
  ) {}
}

/** Every view created, by tag, so tests can reach into a rendered page. */
export const views = new Map<string, View[]>()

function viewFor(tag: string) {
  const view =
    tag === 'Frame'
      ? new Frame()
      : tag === 'Page'
        ? new Page()
        : tag === 'TabView'
          ? new TabView()
          : tag === 'TabViewItem'
            ? new TabViewItem()
            : new View()
  views.set(tag, [...(views.get(tag) ?? []), view])
  return view
}

const renderer = createRenderer<TestNode, TestNode>({
  createElement: (tag) => new TestNode(tag, viewFor(tag)),
  createText: (text) => Object.assign(new TestNode('#text', null), { text }),
  createComment: (text) => Object.assign(new TestNode('#comment', null), { text }),
  setText: (node, text) => void (node.text = text),
  setElementText: (node, text) => void (node.text = text),
  parentNode: (node) => node.parentNode,
  nextSibling: (node) => {
    const siblings = node.parentNode?.children ?? []
    return siblings[siblings.indexOf(node) + 1] ?? null
  },
  insert(child, parent, anchor) {
    if (child.parentNode) remove(child)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(child)
    else parent.children.splice(index, 0, child)
    child.parentNode = parent
    // the native tree too, for what walks `view.parent`
    if (child.nativeView && parent.nativeView) {
      child.nativeView.parent = parent.nativeView
      parent.nativeView.children.push(child.nativeView)
    }
  },
  remove,
  patchProp(node, key, _previous, next) {
    if (/^on[A-Z]/.test(key)) {
      const event = key[2]!.toLowerCase() + key.slice(3)
      if (node.handlers[key]) node.nativeView.off(event, node.handlers[key])
      if (!next) return
      const handlers = Array.isArray(next) ? next : [next]
      node.handlers[key] = (...args) => handlers.forEach((handler) => handler(...args))
      node.nativeView.on(event, node.handlers[key])
    } else if (node.nativeView) {
      node.nativeView[key] = next
    }
  },
})

function remove(node: TestNode) {
  const siblings = node.parentNode?.children
  if (siblings) siblings.splice(siblings.indexOf(node), 1)
  const parentView = node.nativeView?.parent
  if (parentView) {
    parentView.children = parentView.children.filter(
      (view: View) => view !== node.nativeView,
    )
    node.nativeView.parent = null
  }
  node.parentNode = null
}

let rootApp: App | undefined

export function createApp(component: Component, props?: Record<string, unknown>) {
  const app = renderer.createApp(component, props) as App & {
    start(): ComponentPublicInstance
  }
  rootApp = app
  app.start = () => app.mount(new TestNode('root', new View()))
  return app
}

function mountNativeView(component: Component, props?: Record<string, unknown>) {
  const app = renderer.createApp(component, props)
  const { app: _, ...context } = rootApp!._context
  Object.assign(app._context, context)
  const vm = app.mount(new TestNode('root', new View()))
  return { app, view: (vm.$el as TestNode).nativeView }
}

/** Mounts a component to a native view without a frame, like the real one. */
export function createNativeView(component: Component, props?: Record<string, unknown>) {
  let mounted: ReturnType<typeof mountNativeView> | undefined
  return {
    mount() {
      mounted ??= mountNativeView(component, props)
      return mounted.view as View
    },
    unmount() {
      mounted?.app.unmount()
      mounted = undefined
    },
  }
}

export function $navigateTo(
  component: Component,
  options: NavigationEntry & { frame: Frame; props?: Record<string, unknown> },
) {
  const { app, view } = mountNativeView(component, options.props)
  view.on('disposeNativeView', () => app.unmount())
  options.frame.navigate({ ...options, create: () => view })
  return view as Page
}

export function $showModal(component: Component, options: Record<string, any> = {}) {
  return new Promise((resolve) => {
    const { app, view } = mountNativeView(component, options.props)
    new View().showModal(view, {
      ...options,
      closeCallback(data: unknown) {
        app.unmount()
        resolve(data)
      },
    })
  })
}

export const render = renderer.render
