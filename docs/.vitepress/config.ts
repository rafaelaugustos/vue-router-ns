import { existsSync } from 'node:fs'
import { defineConfig, type DefaultTheme } from 'vitepress'

const site = 'https://vue-router-ns.rafaelaugusto.dev'
const repo = 'https://github.com/rafaelaugustos/vue-router-ns'
const cortex = '<a href="https://getcortexlabs.com/">Cortex Labs</a>'

const trackingHead = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TWQ2MWQG');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-NXBR732XZY"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-NXBR732XZY');
</script>`

const trackingBody = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TWQ2MWQG"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`

function sidebar(prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] {
  const page = (key: string, path: string) => ({
    text: t[key],
    link: `${prefix}/guide/${path}`,
  })
  return [
    {
      text: t.start,
      items: [
        page('introduction', ''),
        page('install', 'install'),
        page('compatibility', 'compatibility'),
        page('splash', 'splash'),
        page('demo', 'demo'),
        page('playground', 'playground'),
        page('navigating', 'navigating'),
      ],
    },
    {
      text: t.pages,
      items: [
        page('routes', 'pages'),
        page('fileRouting', 'file-routing'),
        page('layouts', 'layouts'),
        page('guards', 'guards'),
        page('middleware', 'middleware'),
        page('dataLoading', 'data-loading'),
        page('suspense', 'suspense'),
        page('modals', 'modals'),
        page('capabilities', 'capabilities'),
        page('nativeShowcase', 'native-showcase'),
        page('transitions', 'transitions'),
        page('interactiveTransitions', 'interactive-transitions'),
        page('tabs', 'tabs'),
        page('split', 'split-view'),
        page('drawer', 'drawer'),
        page('contextMenus', 'context-menus'),
        page('typed', 'typed-routes'),
      ],
    },
    {
      text: t.platform,
      items: [
        page('deepLinks', 'deep-links'),
        page('stack', 'stack'),
        page('restore', 'restore'),
        page('windows', 'windows'),
        page('androidBack', 'android-back'),
        page('nativeBars', 'native-bars'),
        page('pageActions', 'page-actions'),
        page('keyboard', 'keyboard'),
        page('accessibility', 'accessibility'),
        page('flows', 'native-flows'),
        page('destinations', 'native-destinations'),
      ],
    },
    {
      text: t.reference,
      items: [
        page('vueRouter', 'vue-router'),
        page('api', 'api'),
        page('internals', 'how-it-works'),
        page('diagnostics', 'diagnostics'),
        page('diagnosticsViewer', 'diagnostics-viewer'),
        page('hosts', 'native-hosts'),
      ],
    },
  ]
}

const en = {
  start: 'Start',
  pages: 'Pages',
  platform: 'On the device',
  reference: 'Reference',
  introduction: 'What vue-router-ns is',
  install: 'Install',
  compatibility: 'RC scope and compatibility',
  splash: 'Startup splash',
  demo: 'Examples and videos',
  playground: 'Try with StackBlitz',
  navigating: 'Navigating',
  routes: 'Every page keeps its route',
  fileRouting: 'Optional routes from files',
  layouts: 'Optional native layouts',
  guards: 'Guards',
  middleware: 'Optional middleware and helpers',
  dataLoading: 'Route data (experimental)',
  suspense: 'Native Suspense (experimental)',
  modals: 'Modals and results',
  capabilities: 'Native capabilities and choices',
  nativeShowcase: 'Integrated native example',
  transitions: 'Zoom and shared elements',
  interactiveTransitions: 'Interactive transition limits',
  tabs: 'Tabs',
  split: 'List and detail',
  drawer: 'Native drawer',
  contextMenus: 'Context menu previews',
  typed: 'Typed routes',
  deepLinks: 'Deep links',
  stack: 'Setting the whole stack',
  restore: 'Restoring after the app is killed',
  windows: 'Native windows',
  androidBack: 'Android predictive back',
  nativeBars: 'Native bars and search',
  pageActions: 'Page actions',
  keyboard: 'Keyboard commands',
  accessibility: 'Accessibility and motion',
  flows: 'System pickers and native flows',
  vueRouter: 'Differences from Vue Router',
  api: 'API',
  internals: 'How it works',
  diagnostics: 'Navigation diagnostics',
  diagnosticsViewer: 'Visual report viewer',
  hosts: 'Native hosts (experimental)',
  destinations: 'Native destinations (experimental)',
}

const pt = {
  start: 'Começo',
  pages: 'Páginas',
  platform: 'No aparelho',
  reference: 'Referência',
  introduction: 'O que é o vue-router-ns',
  install: 'Instalação',
  compatibility: 'Escopo da RC e compatibilidade',
  splash: 'Splash de abertura',
  demo: 'Exemplos e vídeos',
  playground: 'Experimente com StackBlitz',
  navigating: 'Navegando',
  routes: 'Cada página guarda sua rota',
  fileRouting: 'Rotas por arquivos opcionais',
  layouts: 'Layouts nativos opcionais',
  guards: 'Guards',
  middleware: 'Middleware e helpers opcionais',
  dataLoading: 'Dados da rota (experimental)',
  suspense: 'Suspense nativo (experimental)',
  modals: 'Modais e resultados',
  capabilities: 'Capacidades e escolhas nativas',
  nativeShowcase: 'Exemplo nativo integrado',
  transitions: 'Zoom e elementos compartilhados',
  interactiveTransitions: 'Limites das transições interativas',
  tabs: 'Abas',
  split: 'Lista e detalhe',
  drawer: 'Drawer nativo',
  contextMenus: 'Prévia por menu de contexto',
  typed: 'Rotas tipadas',
  deepLinks: 'Deep links',
  stack: 'Definindo a pilha inteira',
  restore: 'Restaurando depois que o app é morto',
  windows: 'Janelas nativas',
  androidBack: 'Predictive back no Android',
  nativeBars: 'Barras e busca nativas',
  pageActions: 'Ações da página',
  keyboard: 'Comandos de teclado',
  accessibility: 'Acessibilidade e movimento',
  flows: 'Pickers do sistema e fluxos nativos',
  vueRouter: 'Diferenças do Vue Router',
  api: 'API',
  internals: 'Como funciona',
  diagnostics: 'Diagnóstico de navegação',
  diagnosticsViewer: 'Visualizador de relatórios',
  hosts: 'Hosts nativos (experimental)',
  destinations: 'Destinos nativos (experimental)',
}

export default defineConfig({
  title: 'vue-router-ns',
  description:
    "Vue Router's API for NativeScript-Vue 3, on top of the native navigation stack.",
  cleanUrls: true,
  lastUpdated: existsSync('.git'),
  sitemap: { hostname: site },
  transformHtml: (html) =>
    html
      .replace('<head>', `<head>\n${trackingHead}`)
      .replace('<body>', `<body>\n${trackingBody}`),
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#29bd79' }],
    ['meta', { property: 'og:image', content: `${site}/logo.png` }],
  ],
  themeConfig: {
    logo: { light: '/icon.png', dark: '/icon.png' },
    search: {
      provider: 'local',
      options: {
        locales: {
          'pt-BR': {
            translations: {
              button: { buttonText: 'Buscar', buttonAriaLabel: 'Buscar' },
              modal: {
                noResultsText: 'Nada encontrado para',
                resetButtonTitle: 'Limpar a busca',
                footer: {
                  selectText: 'abrir',
                  navigateText: 'navegar',
                  closeText: 'fechar',
                },
              },
            },
          },
        },
      },
    },
    socialLinks: [
      { icon: 'github', link: repo },
      { icon: 'npm', link: 'https://www.npmjs.com/package/vue-router-ns' },
    ],
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/' },
          { text: 'Examples', link: '/guide/demo' },
          { text: 'API', link: '/guide/api' },
          { text: 'Releases', link: `${repo}/releases` },
        ],
        sidebar: { '/guide/': sidebar('', en) },
        outline: { level: [2, 3], label: 'On this page' },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: `Maintained by Rafael Augusto and ${cortex}`,
        },
      },
    },
    'pt-BR': {
      label: 'Português',
      lang: 'pt-BR',
      link: '/pt-BR/',
      description:
        'A API do Vue Router para NativeScript-Vue 3, em cima da pilha de navegação nativa.',
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt-BR/guide/' },
          { text: 'Exemplos', link: '/pt-BR/guide/demo' },
          { text: 'API', link: '/pt-BR/guide/api' },
          { text: 'Versões', link: `${repo}/releases` },
        ],
        sidebar: { '/pt-BR/guide/': sidebar('/pt-BR', pt) },
        outline: { level: [2, 3], label: 'Nesta página' },
        editLink: {
          pattern: `${repo}/edit/main/docs/:path`,
          text: 'Editar esta página no GitHub',
        },
        docFooter: { prev: 'Anterior', next: 'Próxima' },
        lastUpdated: { text: 'Atualizado em' },
        darkModeSwitchLabel: 'Aparência',
        lightModeSwitchTitle: 'Mudar para o tema claro',
        darkModeSwitchTitle: 'Mudar para o tema escuro',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Voltar ao topo',
        langMenuLabel: 'Mudar o idioma',
        notFound: {
          title: 'Página não encontrada',
          quote: 'Esta página não está aqui.',
          linkText: 'Voltar ao início',
        },
        footer: {
          message: 'Publicado sob a licença MIT.',
          copyright: `Mantido por Rafael Augusto e ${cortex}`,
        },
      },
    },
  },
})
