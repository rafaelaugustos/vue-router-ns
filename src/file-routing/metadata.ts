import {
  babelParse,
  extractIdentifiers,
  MagicString,
  parse,
  walkIdentifiers,
} from '@vue/compiler-sfc'
import type { PageMeta, PageMetaValue } from './index.js'

// Only the build entry imports this module. Never evaluate setup or imported code.
type Node = {
  type: string
  start?: number | null
  end?: number | null
  [key: string]: any
}
const sourceModule = 'vue-router-ns/file-routing'

export interface PageMetaTransform {
  metadata: PageMeta
  code: string
  map: {
    version: number
    sources: string[]
    sourcesContent: (string | null)[]
    names: string[]
    mappings: string
    file?: string
  }
}

export class FileRouteError extends Error {
  constructor(
    readonly file: string,
    message: string,
    readonly line = 1,
    readonly column = 1,
  ) {
    super(`${file}:${line}:${column}: ${message}`)
    this.name = 'FileRouteError'
  }
}

/** Extract literal metadata and erase its macro/import before the Vue compiler runs. */
export function transformPageMeta(
  source: string,
  filename: string,
  options: { autoImports?: boolean } = {},
): PageMetaTransform {
  const fail = (message: string, offset = 0): never => {
    const lines = source.slice(0, offset).split('\n')
    throw new FileRouteError(filename, message, lines.length, lines.at(-1)!.length + 1)
  }
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) {
    const error = errors[0]!
    fail(
      typeof error === 'string' ? error : error.message,
      typeof error === 'string' || !('loc' in error) ? 0 : error.loc?.start.offset,
    )
  }
  const output = new MagicString(source)
  let metadata: PageMeta = {}
  let found = false
  const scripts = [descriptor.script, descriptor.scriptSetup]
    .filter((block) => block != null)
    .map((block) => {
      if (block.src)
        fail(
          'External script src is unsupported for file-routed pages',
          block.loc.start.offset,
        )
      if (block.lang && !['js', 'ts', 'jsx', 'tsx'].includes(block.lang))
        fail(
          'File-routed scripts must use JavaScript or TypeScript',
          block.loc.start.offset,
        )
      const base = block.loc.start.offset
      let ast
      try {
        ast = babelParse(block.content, {
          sourceType: 'module',
          plugins: [
            ...(block.lang?.includes('ts') ? ['typescript' as const] : []),
            ...(block.lang?.includes('x') ? ['jsx' as const] : []),
          ],
        })
      } catch (error) {
        const e = error as { message: string; pos?: number }
        fail(e.message, base + (e.pos ?? 0))
      }
      return { block, ast: ast! }
    })
  // A normal script's module bindings are also visible to script setup.
  const bindings = new Set<string>()
  for (const { ast } of scripts) {
    for (const statement of ast!.program.body) {
      const node =
        statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
      if (!node) continue
      if (node.type === 'ImportDeclaration')
        node.specifiers.forEach((s) => bindings.add(s.local.name))
      else if (node.type === 'VariableDeclaration')
        node.declarations.forEach((d) =>
          extractIdentifiers(d.id).forEach((id) => bindings.add(id.name)),
        )
      else if (
        (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') &&
        node.id
      )
        bindings.add(node.id.name)
    }
  }
  for (const { block, ast } of scripts) {
    const base = block.loc.start.offset
    const aliases = new Set<string>()
    const ignored = new Set<Node>()
    const references = new Set<Node>()
    walkIdentifiers(ast.program, (node) => references.add(node))
    if (
      options.autoImports &&
      block === descriptor.scriptSetup &&
      !bindings.has('definePageMeta')
    ) {
      // Only an unbound, top-level macro call is implicit. Local declarations
      // and explicit imports retain their meaning and must not be erased.
      let implicit = false
      walkIdentifiers(ast!.program, (node, parent, parents) => {
        if (
          parents.length === 3 &&
          node.name === 'definePageMeta' &&
          parent?.type === 'CallExpression' &&
          parent.callee === node &&
          parents.at(-2)?.type === 'ExpressionStatement'
        )
          implicit = true
      })
      if (implicit) aliases.add('definePageMeta')
    }
    for (const statement of ast!.program.body) {
      if (
        statement.type !== 'ImportDeclaration' ||
        statement.source.value !== sourceModule
      )
        continue
      const macros = statement.specifiers.filter(
        (s) =>
          s.type === 'ImportSpecifier' &&
          (s.imported.type === 'Identifier' ? s.imported.name : s.imported.value) ===
            'definePageMeta' &&
          s.importKind !== 'type' &&
          statement.importKind !== 'type',
      )
      if (macros.length && block !== descriptor.scriptSetup)
        fail('Import definePageMeta inside <script setup>', base + statement.start!)
      for (const specifier of macros) {
        aliases.add(specifier.local.name)
        ignored.add(specifier)
      }
      if (!macros.length) continue
      const rest = statement.specifiers.filter((s) => !macros.includes(s))
      // The public subpath has named exports only. Preserve type and other imports.
      if (rest.some((s) => s.type !== 'ImportSpecifier'))
        fail('Use a named definePageMeta import', base + statement.start!)
      output.overwrite(
        base + statement.start!,
        base + statement.end!,
        rest.length
          ? `import { ${rest.map((s) => block.content.slice(s.start!, s.end!)).join(', ')} } from ${JSON.stringify(sourceModule)};`
          : '',
      )
    }
    for (const statement of ast!.program.body as Node[]) {
      const call =
        statement.type === 'ExpressionStatement'
          ? (statement.expression as Node)
          : undefined
      if (
        call?.type !== 'CallExpression' ||
        call.callee.type !== 'Identifier' ||
        !aliases.has(call.callee.name)
      )
        continue
      if (block !== descriptor.scriptSetup)
        fail(
          'definePageMeta must be a top-level call in <script setup>',
          base + call.start!,
        )
      if (found)
        fail('Only one definePageMeta call is allowed per page', base + call.start!)
      if (call.arguments.length !== 1)
        fail('definePageMeta expects one object literal', base + call.start!)
      const error = (message: string, node: Node): never =>
        fail(message, base + (node.start ?? 0))
      const value = literal(call.arguments[0], error)
      if (!value || Array.isArray(value) || typeof value !== 'object')
        error('definePageMeta expects an object literal', call)
      metadata = validateMeta(value as Record<string, PageMetaValue>, (message) =>
        error(message, call),
      )
      found = true
      ignored.add(call)
      output.remove(base + statement.start!, base + statement.end!)
    }
    const visit = (node: Node) => {
      if (ignored.has(node)) return
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'definePageMeta' &&
        references.has(node.callee) &&
        !aliases.has('definePageMeta') &&
        !bindings.has('definePageMeta')
      )
        fail(`Import definePageMeta from '${sourceModule}'`, base + node.start!)
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === sourceModule &&
        node.specifiers.some((s: Node) => s.type === 'ImportNamespaceSpecifier')
      )
        fail(
          'Use a named definePageMeta import; namespace imports are unsupported',
          base + node.start!,
        )
      for (const [key, child] of Object.entries(node)) {
        if (
          ['loc', 'comments', 'leadingComments', 'trailingComments', 'extra'].includes(
            key,
          )
        )
          continue
        if (Array.isArray(child))
          child.forEach((n) => {
            if (n?.type) visit(n)
          })
        else if (child && typeof child === 'object' && child.type) visit(child)
      }
    }
    visit(ast!.program)
    if (ast!.program.body.length)
      walkIdentifiers(ast!.program, (node, _parent, parents) => {
        if (aliases.has(node.name) && !parents.some((parent) => ignored.has(parent)))
          fail(
            'definePageMeta may only be called once as a top-level statement in <script setup>',
            base + node.start!,
          )
      })
  }
  return {
    metadata,
    code: output.toString(),
    map: JSON.parse(
      output
        .generateMap({ source: filename, includeContent: true, hires: true })
        .toString(),
    ),
  }
}

function literal(
  node: Node,
  fail: (message: string, node: Node) => never,
): PageMetaValue {
  if (
    [
      'TSAsExpression',
      'TSSatisfiesExpression',
      'TSTypeAssertion',
      'ParenthesizedExpression',
    ].includes(node.type)
  )
    return literal(node.expression, fail)
  if (node.type === 'StringLiteral' || node.type === 'BooleanLiteral') return node.value
  if (node.type === 'NumericLiteral' && Number.isFinite(node.value)) return node.value
  if (node.type === 'NullLiteral') return null
  if (
    node.type === 'UnaryExpression' &&
    ['-', '+'].includes(node.operator) &&
    node.argument.type === 'NumericLiteral'
  ) {
    const value = node.operator === '-' ? -node.argument.value : node.argument.value
    if (Number.isFinite(value)) return value
  }
  if (node.type === 'ArrayExpression')
    return node.elements.map((item: Node | null) =>
      item ? literal(item, fail) : fail('Sparse metadata arrays are unsupported', node),
    )
  if (node.type === 'ObjectExpression') {
    const result: Record<string, PageMetaValue> = Object.create(null)
    for (const property of node.properties as Node[]) {
      if (property.type !== 'ObjectProperty' || property.computed || property.shorthand)
        fail(
          'Metadata requires literal properties; spreads, methods and computed keys are unsupported',
          property,
        )
      const key =
        property.key.type === 'Identifier' ? property.key.name : property.key.value
      if (
        typeof key !== 'string' ||
        ['__proto__', 'constructor', 'prototype'].includes(key)
      )
        fail('Unsupported metadata property', property)
      if (Object.hasOwn(result, key))
        fail(`Duplicate metadata property "${key}"`, property)
      result[key] = literal(property.value, fail)
    }
    return result
  }
  return fail(
    'Metadata must contain literal data; imports, setup variables, calls and functions are unsupported. Register named middleware/layouts on the router.',
    node,
  )
}

function validateMeta(
  value: Record<string, PageMetaValue>,
  fail: (message: string) => never,
): PageMeta {
  for (const key of Object.keys(value))
    if (
      ![
        'name',
        'path',
        'layout',
        'middleware',
        'meta',
        'props',
        'modal',
        'transition',
      ].includes(key)
    )
      fail(`Unknown page metadata field "${key}"; put application metadata in meta`)
  for (const key of ['name', 'path'] as const)
    if (key in value && (typeof value[key] !== 'string' || !value[key]))
      fail(`${key} must be a nonempty string`)
  if (
    'layout' in value &&
    value.layout !== false &&
    (typeof value.layout !== 'string' || !value.layout)
  )
    fail('layout must be a name or false')
  if (
    'middleware' in value &&
    !(
      (typeof value.middleware === 'string' && value.middleware) ||
      (Array.isArray(value.middleware) &&
        value.middleware.every((v) => typeof v === 'string' && v))
    )
  )
    fail('middleware must be a name or an array of names')
  const object = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
  if ('meta' in value && !object(value.meta)) fail('meta must be an object')
  if ('props' in value && typeof value.props !== 'boolean' && !object(value.props))
    fail('props must be a boolean or object')
  if ('modal' in value && typeof value.modal !== 'boolean' && !object(value.modal))
    fail('modal must be a boolean or native options object')
  if (
    'transition' in value &&
    typeof value.transition !== 'string' &&
    !object(value.transition)
  )
    fail('transition must be a name or native options object')
  const meta = (value.meta ?? {}) as Record<string, PageMetaValue>
  if ('layout' in meta || 'middleware' in meta)
    fail(
      'Declare layout and middleware at the top level of definePageMeta, not inside meta',
    )
  return value as PageMeta
}
