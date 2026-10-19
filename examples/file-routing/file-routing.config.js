module.exports = (platform) => ({
  rootDir: __dirname,
  platform,
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: true,
})
