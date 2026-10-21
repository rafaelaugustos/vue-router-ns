// Observation only, for --env.startupTrace builds. Keep the original disposal
// callback intact and buffer stacks until startup has settled.
module.exports = function (source) {
  const hook = 'const page = args.object;'
  if (!source.includes(hook))
    throw new Error('NativeScript-Vue disposal trace hook moved')
  return source.replace(
    hook,
    `${hook}
    const trace = globalThis.__routerNativeDisposals ??= [];
    if (trace.length < 30) trace.push({
      at: performance.now(),
      page: String(page),
      frame: String(page.frame),
      loaded: page.isLoaded,
      frameLoaded: page.frame?.isLoaded,
      current: page.frame?.currentPage === page,
      stack: new Error('Native Page disposal').stack,
    });
  `,
  )
}
