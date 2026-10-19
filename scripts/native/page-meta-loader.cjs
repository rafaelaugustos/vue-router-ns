// Fixture-only adapter: #92 owns the public webpack setup/plugin.
module.exports = function (source) {
  const done = this.async()
  const filename = this.resourcePath
  import('../../dist/file-routing/generator.js').then(({ transformPageMeta }) => {
    try {
      const result = transformPageMeta(source, filename)
      done(null, result.code, result.map)
    } catch (error) {
      done(error)
    }
  }, done)
}
