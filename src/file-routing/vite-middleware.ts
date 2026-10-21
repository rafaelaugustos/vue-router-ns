import { babelParse, MagicString, rewriteDefaultAST } from '@vue/compiler-sfc'

/** Keep registered guards current even on native hosts without dependency callbacks. */
export function transformMiddleware(source: string, filename: string) {
  const ast = babelParse(source, { sourceType: 'module', plugins: ['typescript'] })
  // Avoid collisions with user bindings, including re-export helper names.
  let binding = '__nativeFileMiddleware'
  while (source.includes(binding)) binding += '_'
  const output = new MagicString(source)
  rewriteDefaultAST(ast.program.body, output, binding)
  output.append(`
const ${binding}State = import.meta.hot
  ? (import.meta.hot.data.nativeFileMiddleware ??= { current: ${binding} })
  : { current: ${binding} }
${binding}State.current = ${binding}
export default ((...args: Parameters<typeof ${binding}>) => ${binding}State.current(...args)) as typeof ${binding}
if (import.meta.hot) import.meta.hot.accept()
`)
  return {
    code: output.toString(),
    map: output.generateMap({ source: filename, includeContent: true, hires: true }),
  }
}
