import { defineConfig, type DefaultTheme } from 'vitepress'

const site = 'https://vue-router-ns.rafaelaugusto.dev'
const repo = 'https://github.com/rafaelaugustos/vue-router-ns'
const cortex = '<a href="https://getcortexlabs.com/">Cortex Labs</a>'

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
        page('playground', 'playground'),
        page('navigating', 'navigating'),
      ],
    },
    {
      text: t.pages,
      items: [
        page('routes', 'pages'),
        page('guards', 'guards'),
        page('modals', 'modals'),
        page('transitions', 'transitions'),
        page('tabs', 'tabs'),
        page('split', 'split-view'),
        page('typed', 'typed-routes'),
      ],
    },
    {
      text: t.platform,
      items: [
        page('deepLinks', 'deep-links'),
        page('stack', 'stack'),
        page('restore', 'restore'),
        page('androidBack', 'android-back'),
        page('nativeBars', 'native-bars'),
        page('keyboard', 'keyboard'),
        page('accessibility', 'accessibility'),
      ],
    },
    {
      text: t.reference,
      items: [
        page('vueRouter', 'vue-router'),
        page('api', 'api'),
        page('internals', 'how-it-works'),
        page('diagnostics', 'diagnostics'),
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
  playground: 'Try with StackBlitz',
  navigating: 'Navigating',
  routes: 'Every page keeps its route',
  guards: 'Guards',
  modals: 'Modals and results',
  transitions: 'Zoom and shared elements',
  tabs: 'Tabs',
  split: 'List and detail',
  typed: 'Typed routes',
  deepLinks: 'Deep links',
  stack: 'Setting the whole stack',
  restore: 'Restoring after the app is killed',
  androidBack: 'Android predictive back',
  nativeBars: 'Native bars and search',
  keyboard: 'Keyboard commands',
  accessibility: 'Accessibility and motion',
  vueRouter: 'Differences from Vue Router',
  api: 'API',
  internals: 'How it works',
  diagnostics: 'Navigation diagnostics',
}

const pt = {
  start: 'Começo',
  pages: 'Páginas',
  platform: 'No aparelho',
  reference: 'Referência',
  introduction: 'O que é o vue-router-ns',
  install: 'Instalação',
  playground: 'Experimente com StackBlitz',
  navigating: 'Navegando',
  routes: 'Cada página guarda sua rota',
  guards: 'Guards',
  modals: 'Modais e resultados',
  transitions: 'Zoom e elementos compartilhados',
  tabs: 'Abas',
  split: 'Lista e detalhe',
  typed: 'Rotas tipadas',
  deepLinks: 'Deep links',
  stack: 'Definindo a pilha inteira',
  restore: 'Restaurando depois que o app é morto',
  androidBack: 'Predictive back no Android',
  nativeBars: 'Barras e busca nativas',
  keyboard: 'Comandos de teclado',
  accessibility: 'Acessibilidade e movimento',
  vueRouter: 'Diferenças do Vue Router',
  api: 'API',
  internals: 'Como funciona',
  diagnostics: 'Diagnóstico de navegação',
}

export default defineConfig({
  title: 'vue-router-ns',
  description:
    "Vue Router's API for NativeScript-Vue 3, on top of the native navigation stack.",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: site },
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
          { text: 'API', link: '/guide/api' },
          { text: 'Releases', link: `${repo}/releases` },
        ],
        sidebar: { '/guide/': sidebar('', en) },
        outline: { level: [2, 3], label: 'On this page' },
        editLink: {
          pattern: `${repo}/edit/master/docs/:path`,
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
          { text: 'API', link: '/pt-BR/guide/api' },
          { text: 'Versões', link: `${repo}/releases` },
        ],
        sidebar: { '/pt-BR/guide/': sidebar('/pt-BR', pt) },
        outline: { level: [2, 3], label: 'Nesta página' },
        editLink: {
          pattern: `${repo}/edit/master/docs/:path`,
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
