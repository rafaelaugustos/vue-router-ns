import { isVNode, type VNode } from 'nativescript-vue'
import { Page, ActionBar } from '@nativescript/core'
import type { Lazy, RawRouteComponent, RouteComponent, RouteLocation } from './types.js'

/** The selected layout is fixed for the lifetime of one native entry. */
export interface EntryLayout {
  readonly name: string
  readonly component: RouteComponent
}

export function createLayouts(
  definitions: Readonly<Record<string, RawRouteComponent>> = {},
  defaultLayout: string | false = false,
) {
  const registered = new Map(Object.entries(definitions))
  const loaded = new Map<string, RouteComponent>()
  for (const name of registered.keys()) {
    if (!name.trim()) throw new Error('A native layout needs a non-empty name')
  }
  if (defaultLayout !== false && !registered.has(defaultLayout))
    throw new Error(`Unknown default native layout "${defaultLayout}"`)

  function select(to: RouteLocation): string | undefined {
    const name = to.meta.layout === undefined ? defaultLayout : to.meta.layout
    if (name === false) return
    if (typeof name !== 'string' || !registered.has(name))
      throw new Error(`Unknown native layout "${String(name)}" for "${to.fullPath}"`)
    return name
  }

  async function load(name: string): Promise<EntryLayout> {
    let component = loaded.get(name)
    if (!component) {
      const raw = registered.get(name)!
      const result = isLoader(raw) ? await raw() : raw
      component =
        result && typeof result === 'object' && 'default' in result
          ? result.default
          : result
      if (
        !component ||
        (typeof component !== 'object' && typeof component !== 'function')
      )
        throw new Error(`Native layout "${name}" did not load a component`)
      loaded.set(name, component)
    }
    return { name, component }
  }

  return { select, load }
}

function isLoader(component: RawRouteComponent): component is Lazy<RouteComponent> {
  return (
    typeof component === 'function' &&
    !('__vccOpts' in component) &&
    !('props' in component) &&
    !('emits' in component) &&
    !('displayName' in component)
  )
}

/** Visit rendered components, including fragments, without executing any setup. */
export function walkLayoutTree(
  vnode: VNode,
  visit: (vnode: VNode, parent?: VNode) => void,
  parent?: VNode,
) {
  visit(vnode, parent)
  if (vnode.component) {
    walkLayoutTree(vnode.component.subTree, visit, parent)
    return
  }
  const nativeParent = typeof vnode.type === 'string' ? vnode : parent
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (isVNode(child)) walkLayoutTree(child, visit, nativeParent)
    }
  }
}

/** NativeScript-Vue diagnoses invalid native authoring; add layout-specific context. */
export function layoutIssues(root: VNode, content: RouteComponent): string[] {
  let pages = 0
  let bars = 0
  let destinations = 0
  let misplacedBar = false
  let contentOwnsPage = false
  let contentOwnsBar = false
  walkLayoutTree(root, (vnode, parent) => {
    if (vnode.type === content) {
      destinations++
      if (vnode.component)
        walkLayoutTree(vnode.component.subTree, (child) => {
          const native = nativeView(child)
          if (native instanceof Page) contentOwnsPage = true
          if (native instanceof ActionBar) contentOwnsBar = true
        })
    }
    const native = nativeView(vnode)
    if (native instanceof Page) pages++
    if (native instanceof ActionBar) {
      bars++
      if (!parent || !(nativeView(parent) instanceof Page)) misplacedBar = true
    }
  })
  let nativeRoot = root
  while (nativeRoot.component) nativeRoot = nativeRoot.component.subTree
  const issues: string[] = []
  if (!(nativeView(nativeRoot) instanceof Page))
    issues.push('the layout must render one native Page as its root')
  if (pages !== 1 || contentOwnsPage)
    issues.push('the layout owns Page; the destination must render content without Page')
  if (bars > 1 || misplacedBar || contentOwnsBar)
    issues.push('the layout owns ActionBar; use at most one, directly inside its Page')
  if (destinations !== 1)
    issues.push('the layout must render its default slot exactly once')
  return issues
}

function nativeView(vnode: VNode): unknown {
  return typeof vnode.type === 'string' ? vnode.el?.nativeView : undefined
}
