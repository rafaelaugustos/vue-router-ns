// Negative control only: restore Vue's child-only reload path from before #4.
module.exports = function (source) {
  const hook = 'child.ceReload = reloadPage'
  if (!source.includes(hook)) throw new Error('Covered HMR regression hook changed')
  return source.replace(hook, 'child.ceReload = undefined')
}
