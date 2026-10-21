module.exports = (platform) => ({
  rootDir: __dirname,
  platform,
  bundler: process.env.ROUTER_BUNDLER === 'vite' ? 'vite' : 'webpack',
  pagesDir: 'src/pages',
  outDir: 'src/generated/router',
  layoutsDir: 'src/layouts',
  middlewareDir: 'src/middleware',
  autoImports: false,
  metadataFiles: true,
})
