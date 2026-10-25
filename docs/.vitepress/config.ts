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
        page('firstApp', 'first-app'),
        page('examples', 'examples'),
        page('recipes', 'recipes'),
        page('playground', 'playground'),
      ],
    },
    {
      text: t.concepts,
      items: [
        page('mentalModel', 'mental-model'),
        page('navigating', 'navigating'),
        page('routes', 'pages'),
        page('guards', 'guards'),
        page('typed', 'typed-routes'),
      ],
    },
    {
      text: t.containers,
      collapsed: true,
      items: [
        page('capabilities', 'capabilities'),
        page('tabs', 'tabs'),
        page('drawer', 'drawer'),
        page('split', 'split-view'),
        page('modals', 'modals'),
      ],
    },
    {
      text: t.native,
      collapsed: true,
      items: [
        page('nativeBars', 'native-bars'),
        page('pageActions', 'page-actions'),
        page('contextMenus', 'context-menus'),
        page('transitions', 'transitions'),
        page('keyboard', 'keyboard'),
        page('accessibility', 'accessibility'),
      ],
    },
    {
      text: t.application,
      collapsed: true,
      items: [
        page('deepLinks', 'deep-links'),
        page('flows', 'native-flows'),
        page('restore', 'restore'),
        page('stack', 'stack'),
        page('splash', 'splash'),
        page('diagnostics', 'diagnostics'),
        page('diagnosticsViewer', 'diagnostics-viewer'),
      ],
    },
    {
      text: t.advanced,
      collapsed: true,
      items: [
        page('fileRouting', 'file-routing'),
        page('layouts', 'layouts'),
        page('middleware', 'middleware'),
        page('dataLoading', 'data-loading'),
        page('suspense', 'suspense'),
        page('windows', 'windows'),
        page('androidBack', 'android-back'),
        page('interactiveTransitions', 'interactive-transitions'),
        page('hosts', 'native-hosts'),
        page('destinations', 'native-destinations'),
      ],
    },
    {
      text: t.reference,
      collapsed: true,
      items: [
        page('api', 'api'),
        page('vueRouter', 'vue-router'),
        page('compatibility', 'compatibility'),
        page('stableReadiness', 'stable-readiness'),
        page('internals', 'how-it-works'),
        page('demo', 'demo'),
        page('nativeShowcase', 'native-showcase'),
      ],
    },
  ]
}

const en = {
  start: 'Start',
  concepts: 'Core concepts',
  containers: 'Navigation containers',
  native: 'Native experience',
  application: 'Application flows',
  advanced: 'Advanced and experimental',
  firstApp: 'Build your first app',
  mentalModel: 'Pages, stacks and state',
  examples: 'Example gallery',
  recipes: 'Common tasks',
  reference: 'Reference',
  introduction: 'Learning path',
  install: 'Install',
  compatibility: 'RC scope and compatibility',
  stableReadiness: 'Stable and 1.0 readiness',
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
  concepts: 'Conceitos fundamentais',
  containers: 'Containers de navegação',
  native: 'Experiência nativa',
  application: 'Fluxos do aplicativo',
  advanced: 'Avançado e experimental',
  firstApp: 'Crie seu primeiro app',
  mentalModel: 'Páginas, pilhas e estado',
  examples: 'Galeria de exemplos',
  recipes: 'Tarefas comuns',
  reference: 'Referência',
  introduction: 'Trilha de aprendizado',
  install: 'Instalação',
  compatibility: 'Escopo da RC e compatibilidade',
  stableReadiness: 'Prontidão para a estável e 1.0',
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

const es: typeof en = {
  start: 'Inicio',
  concepts: 'Conceptos fundamentales',
  containers: 'Contenedores de navegación',
  native: 'Experiencia nativa',
  application: 'Flujos de la aplicación',
  advanced: 'Avanzado y experimental',
  firstApp: 'Crea tu primera app',
  mentalModel: 'Páginas, pilas y estado',
  examples: 'Galería de ejemplos',
  recipes: 'Tareas habituales',
  reference: 'Referencia',
  introduction: 'Ruta de aprendizaje',
  install: 'Instalación',
  compatibility: 'Alcance de la RC y compatibilidad',
  stableReadiness: 'Preparación para la versión estable y 1.0',
  splash: 'Pantalla de inicio',
  demo: 'Ejemplos y vídeos',
  playground: 'Prueba con StackBlitz',
  navigating: 'Navegación',
  routes: 'Cada página conserva su ruta',
  fileRouting: 'Rutas opcionales desde archivos',
  layouts: 'Layouts nativos opcionales',
  guards: 'Guards de navegación',
  middleware: 'Middleware y helpers opcionales',
  dataLoading: 'Datos de ruta (experimental)',
  suspense: 'Suspense nativo (experimental)',
  modals: 'Modales y resultados',
  capabilities: 'Capacidades y opciones nativas',
  nativeShowcase: 'Ejemplo nativo integrado',
  transitions: 'Zoom y elementos compartidos',
  interactiveTransitions: 'Límites de las transiciones interactivas',
  tabs: 'Pestañas',
  split: 'Lista y detalle',
  drawer: 'Drawer nativo',
  contextMenus: 'Vistas previas en menús contextuales',
  typed: 'Rutas tipadas',
  deepLinks: 'Enlaces profundos',
  stack: 'Definir toda la pila',
  restore: 'Restaurar tras finalizar el proceso',
  windows: 'Ventanas nativas',
  androidBack: 'Retroceso predictivo en Android',
  nativeBars: 'Barras y búsqueda nativas',
  pageActions: 'Acciones de página',
  keyboard: 'Comandos de teclado',
  accessibility: 'Accesibilidad y movimiento',
  flows: 'Selectores del sistema y flujos nativos',
  vueRouter: 'Diferencias con Vue Router',
  api: 'API',
  internals: 'Cómo funciona',
  diagnostics: 'Diagnósticos de navegación',
  diagnosticsViewer: 'Visualizador de informes',
  hosts: 'Hosts nativos (experimental)',
  destinations: 'Destinos nativos (experimental)',
}

const zh: typeof en = {
  start: '入门',
  concepts: '核心概念',
  containers: '导航容器',
  native: '原生体验',
  application: '应用流程',
  advanced: '高级与实验性功能',
  firstApp: '构建第一个应用',
  mentalModel: '页面、导航栈与状态',
  examples: '示例库',
  recipes: '常见任务',
  reference: '参考',
  introduction: '学习路线',
  install: '安装',
  compatibility: '候选版本范围与兼容性',
  stableReadiness: '稳定版与 1.0 就绪评估',
  splash: '启动画面',
  demo: '示例与视频',
  playground: '在 StackBlitz 中体验',
  navigating: '导航',
  routes: '每个页面保留自己的路由',
  fileRouting: '可选的文件路由',
  layouts: '可选的原生布局',
  guards: '导航守卫',
  middleware: '可选的中间件与辅助函数',
  dataLoading: '路由数据（实验性）',
  suspense: '原生 Suspense（实验性）',
  modals: '模态页面与返回结果',
  capabilities: '原生能力与方案选择',
  nativeShowcase: '原生集成示例',
  transitions: '缩放与共享元素',
  interactiveTransitions: '交互式转场的限制',
  tabs: '标签页',
  split: '列表与详情',
  drawer: '原生抽屉导航',
  contextMenus: '上下文菜单预览',
  typed: '类型安全路由',
  deepLinks: '深度链接',
  stack: '设置整个导航栈',
  restore: '进程终止后的状态恢复',
  windows: '原生窗口',
  androidBack: 'Android 预测性返回',
  nativeBars: '原生导航栏与搜索',
  pageActions: '页面操作',
  keyboard: '键盘命令',
  accessibility: '无障碍与动态效果',
  flows: '系统选择器与原生流程',
  vueRouter: '与 Vue Router 的区别',
  api: 'API',
  internals: '工作原理',
  diagnostics: '导航诊断',
  diagnosticsViewer: '诊断报告查看器',
  hosts: '原生宿主（实验性）',
  destinations: '原生目标页面（实验性）',
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
        miniSearch: {
          options: {
            // Use the same segmentation while indexing and querying. Without
            // it, a Chinese paragraph can become one unsearchable long token.
            tokenize: (text: string) =>
              Array.from(
                new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text),
              )
                .filter((part) => part.isWordLike)
                .map((part) => part.segment),
          },
        },
        locales: {
          es: {
            translations: {
              button: {
                buttonText: 'Buscar',
                buttonAriaLabel: 'Buscar en la documentación',
              },
              modal: {
                noResultsText: 'No hay resultados para',
                resetButtonTitle: 'Borrar búsqueda',
                footer: {
                  selectText: 'abrir',
                  navigateText: 'navegar',
                  closeText: 'cerrar',
                },
              },
            },
          },
          'zh-CN': {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '没有找到相关结果',
                resetButtonTitle: '清空搜索',
                footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
              },
            },
          },
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
    es: {
      label: 'Español',
      lang: 'es',
      link: '/es/',
      description:
        'La API de Vue Router para NativeScript-Vue 3 sobre la pila de navegación nativa.',
      themeConfig: {
        nav: [
          { text: 'Guía', link: '/es/guide/' },
          { text: 'Ejemplos', link: '/es/guide/examples' },
          { text: 'API', link: '/es/guide/api' },
          { text: 'Versiones', link: repo + '/releases' },
        ],
        sidebar: { '/es/guide/': sidebar('/es', es) },
        outline: { level: [2, 3], label: 'En esta página' },
        editLink: {
          pattern: repo + '/edit/main/docs/:path',
          text: 'Editar esta página en GitHub',
        },
        docFooter: { prev: 'Anterior', next: 'Siguiente' },
        lastUpdated: { text: 'Actualizado el' },
        darkModeSwitchLabel: 'Apariencia',
        lightModeSwitchTitle: 'Cambiar al tema claro',
        darkModeSwitchTitle: 'Cambiar al tema oscuro',
        sidebarMenuLabel: 'Menú',
        returnToTopLabel: 'Volver arriba',
        langMenuLabel: 'Cambiar idioma',
        notFound: {
          title: 'Página no encontrada',
          quote: 'Esta página no está disponible.',
          linkText: 'Volver al inicio',
        },
        footer: {
          message: 'Publicado bajo la licencia MIT.',
          copyright: 'Mantenido por' + ' Rafael Augusto ' + 'y' + ' ' + cortex,
        },
      },
    },

    'zh-CN': {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh-CN/',
      description: '基于原生导航栈，为 NativeScript-Vue 3 提供 Vue Router 风格的 API。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh-CN/guide/' },
          { text: '示例', link: '/zh-CN/guide/examples' },
          { text: 'API', link: '/zh-CN/guide/api' },
          { text: '版本', link: repo + '/releases' },
        ],
        sidebar: { '/zh-CN/guide/': sidebar('/zh-CN', zh) },
        outline: { level: [2, 3], label: '本页目录' },
        editLink: {
          pattern: repo + '/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页',
        },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '更新于' },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换为浅色主题',
        darkModeSwitchTitle: '切换为深色主题',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        notFound: { title: '页面未找到', quote: '此页面不存在。', linkText: '返回首页' },
        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: '维护者：' + ' Rafael Augusto ' + '与' + ' ' + cortex,
        },
      },
    },

    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/' },
          { text: 'Examples', link: '/guide/examples' },
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
          { text: 'Exemplos', link: '/pt-BR/guide/examples' },
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
