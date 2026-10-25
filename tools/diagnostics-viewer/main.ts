import './style.css'
import es from '../../docs/.vitepress/locales/es-ui'
import zh from '../../docs/.vitepress/locales/zh-CN-ui'
import {
  compareStack,
  filterTimeline,
  MAX_BYTES,
  MAX_REPORTS,
  outcomes,
  parseReport,
  phases,
  timeline,
  windowIds,
  type TimelineFilter,
  type TimelineRow,
} from './model.js'
import { examples } from './examples.js'
import type { DiagnosticsExport } from '../../src/diagnostics.js'

const baseCopy = {
  en: {
    previous: 'Previous',
    next: 'Next',
    language: 'Language',
    title: 'Navigation diagnostics',
    subtitle: 'Follow the request. Inspect the native stack.',
    local: 'Local files · read only',
    open: 'Open JSON reports',
    example: 'Explore example reports',
    reports: 'REPORTS',
    empty: 'Your next investigation starts here.',
    intro:
      'Open a diagnostics export to see how a request moved through guards, mounting and native navigation.',
    privacy:
      'Files stay in this browser tab. No uploads, storage or connection to your app.',
    format: 'Version 1 · up to 8 reports · 10 MiB each',
    clear: 'Clear reports',
    snapshot: 'Stack comparison',
    timeline: 'Timeline',
    sample: 'EXAMPLE DATA',
    imported: 'IMPORTED REPORT',
    exampleNote: 'Synthetic teaching data. These timings are not device benchmarks.',
    isolated:
      'Each file is an independent capture. Matching IDs across files are not merged.',
    issues: 'Snapshot issues',
    events: 'Retained events',
    guard: 'Longest retained guard',
    mount: 'Longest retained mount',
    ms: 'ms',
    unavailable: 'Not recorded',
    reported: 'reported',
    dropped: 'events dropped',
    incomplete: 'incomplete / ambiguous spans',
    limits:
      'Phase spans overlap. Do not sum them. Timings do not measure FPS, first pixels or native heap.',
    active: 'Active in stack',
    result: 'Awaiting result',
    idle: 'Settled',
    busy: 'Busy · comparison deferred',
    modal: 'Modal',
    focused:
      'Active means uncovered in this stack; it does not establish the focused tab or window.',
    logical: 'Logical history',
    native: 'Native hosts',
    host: 'Host',
    window: 'Window',
    unknown: 'Window not recorded',
    allWindows: 'All windows',
    phase: 'Phase',
    allPhases: 'All phases',
    outcome: 'Outcome',
    allOutcomes: 'All outcomes',
    request: 'Request',
    allRequests: 'All requests',
    position: 'Position in retained timeline',
    duration: 'Reported duration',
    status: 'Span state',
    complete: 'Complete',
    'missing-start': 'Start not retained',
    'missing-end': 'End not retained',
    ambiguous: 'Conflicting boundaries',
    event: 'Event',
    emptyFilter: 'No entries match these filters.',
    emptyEvents: 'No retained events in this capture.',
    noStack: 'No stacks in this snapshot.',
    noIssue: 'No issues reported in this snapshot.',
    noHost: 'No native hosts recorded',
    unmanaged: 'Unmanaged native page',
    absent: 'No entry',
    different: 'Different at this position',
    loaded: 'Loaded',
    unloaded: 'Unloaded',
    at: 'Snapshot at',
    origin: 'Wall-clock origin (approximate)',
    stopped: 'Collector stopped',
    captured: 'Collector active at capture',
    limitsSnapshot:
      'This is a point-in-time diagnostic view, not a restoration snapshot. IDs are local to a collector/process.',
    selected: 'Event details',
    choose: 'Select a timeline row to inspect its recorded identifiers.',
    close: 'Close details',
    fileError: 'Could not open report',
    importing: 'Reading reports…',
    limit: 'Clear reports before adding more. The limit is 8 captures.',
    download: 'Download offline viewer',
    help: 'Export with router.diagnostics.export()',
    matches: 'rows',
    partial:
      'Missing boundaries can result from buffer truncation or an unfinished request. End-only durations are reported values; their start positions are not reconstructed.',
    mountHint:
      'Mount includes synchronous Vue setup and native view creation; it does not isolate setup time.',
    eventIssue: 'Recorded issue events may differ from the later snapshot.',
  },
  'pt-BR': {
    previous: 'Anterior',
    next: 'Próxima',
    language: 'Idioma',
    title: 'Diagnósticos de navegação',
    subtitle: 'Acompanhe a requisição. Inspecione a pilha nativa.',
    local: 'Arquivos locais · somente leitura',
    open: 'Abrir relatórios JSON',
    example: 'Explorar relatórios de exemplo',
    reports: 'RELATÓRIOS',
    empty: 'Sua próxima investigação começa aqui.',
    intro:
      'Abra um diagnóstico exportado para ver o caminho da requisição pelos guards, montagem e navegação nativa.',
    privacy:
      'Os arquivos ficam nesta aba. Sem upload, armazenamento ou conexão com o app.',
    format: 'Versão 1 · até 8 relatórios · 10 MiB por arquivo',
    clear: 'Limpar relatórios',
    snapshot: 'Comparação de pilhas',
    timeline: 'Linha do tempo',
    sample: 'DADOS DE EXEMPLO',
    imported: 'RELATÓRIO IMPORTADO',
    exampleNote:
      'Dados didáticos sintéticos. Estes tempos não são benchmarks de dispositivos.',
    isolated:
      'Cada arquivo é uma captura independente. IDs iguais entre arquivos não são combinados.',
    issues: 'Issues no snapshot',
    events: 'Eventos retidos',
    guard: 'Maior guard retido',
    mount: 'Maior mount retido',
    ms: 'ms',
    unavailable: 'Não registrado',
    reported: 'reportado',
    dropped: 'eventos descartados',
    incomplete: 'spans incompletos / ambíguos',
    limits:
      'Os spans se sobrepõem: não some suas durações. Os tempos não medem FPS, primeiros pixels ou heap nativo.',
    active: 'Ativa na pilha',
    result: 'Aguardando resultado',
    idle: 'Estável',
    busy: 'Ocupada · comparação adiada',
    modal: 'Modal',
    focused:
      'Ativa significa descoberta nesta pilha; isso não comprova qual aba ou janela está com foco.',
    logical: 'Histórico lógico',
    native: 'Hosts nativos',
    host: 'Host',
    window: 'Janela',
    unknown: 'Janela não registrada',
    allWindows: 'Todas as janelas',
    phase: 'Fase',
    allPhases: 'Todas as fases',
    outcome: 'Resultado',
    allOutcomes: 'Todos os resultados',
    request: 'Requisição',
    allRequests: 'Todas as requisições',
    position: 'Posição na linha do tempo retida',
    duration: 'Duração reportada',
    status: 'Estado do span',
    complete: 'Completo',
    'missing-start': 'Início não retido',
    'missing-end': 'Fim não retido',
    ambiguous: 'Limites conflitantes',
    event: 'Evento',
    emptyFilter: 'Nenhum registro corresponde aos filtros.',
    emptyEvents: 'Nenhum evento retido nesta captura.',
    noStack: 'Nenhuma pilha neste snapshot.',
    noIssue: 'Nenhuma issue reportada neste snapshot.',
    noHost: 'Nenhum host nativo registrado',
    unmanaged: 'Página nativa sem dono',
    absent: 'Sem entrada',
    different: 'Diferença nesta posição',
    loaded: 'Carregado',
    unloaded: 'Descarregado',
    at: 'Snapshot em',
    origin: 'Origem de relógio civil (aproximada)',
    stopped: 'Collector parado',
    captured: 'Collector ativo na captura',
    limitsSnapshot:
      'Esta é uma visão diagnóstica pontual, não um snapshot de restauração. IDs são locais ao collector/processo.',
    selected: 'Detalhes do evento',
    choose: 'Selecione uma linha para inspecionar os identificadores registrados.',
    close: 'Fechar detalhes',
    fileError: 'Não foi possível abrir o relatório',
    importing: 'Lendo relatórios…',
    limit: 'Limpe os relatórios antes de adicionar mais. O limite é 8 capturas.',
    download: 'Baixar visualizador offline',
    help: 'Exporte com router.diagnostics.export()',
    matches: 'linhas',
    partial:
      'Limites ausentes podem resultar do buffer truncado ou de requisições não finalizadas. Durações sem início são valores reportados; sua posição inicial não é reconstruída.',
    mountHint:
      'Mount inclui setup síncrono do Vue e criação de views nativas; não isola o tempo de setup.',
    eventIssue: 'Eventos de issue registrados podem diferir do snapshot posterior.',
  },
}
const translate = (messages: Record<string, string>): typeof baseCopy.en =>
  Object.fromEntries(
    Object.entries(baseCopy.en).map(([key, value]) => [key, messages[value] ?? value]),
  ) as typeof baseCopy.en
const copy = { ...baseCopy, es: translate(es), 'zh-CN': translate(zh) }
type Locale = keyof typeof copy
const requestedLocale = new URLSearchParams(location.search).get('lang')
let locale: Locale =
  requestedLocale && Object.hasOwn(copy, requestedLocale)
    ? (requestedLocale as Locale)
    : 'en'
const t = (key: keyof typeof copy.en) => copy[locale][key]
const format = (value: number) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
const ms = (value: number | undefined) =>
  value === undefined ? '—' : `${format(value)} ms`
type Capture = {
  id: number
  name: string
  report: DiagnosticsExport
  sample: boolean
  rows: TimelineRow[]
}
let captures: Capture[] = [],
  selected = 0,
  sequence = 0,
  generation = 0,
  importing = false
let tab: 'snapshot' | 'timeline' = 'snapshot',
  filter: TimelineFilter = {},
  detail: number | undefined
let errors: string[] = []
let timelinePage = 0,
  stackPage = 0
const entryPages = new Map<string, number>()
const app = document.querySelector<HTMLDivElement>('#app')!

type Child = Node | string | undefined | false
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value)
  for (const child of children)
    if (child !== undefined && child !== false) element.append(child)
  return element
}
function button(label: string, action: () => void, attrs: Record<string, string> = {}) {
  const result = el('button', { type: 'button', ...attrs }, label)
  result.onclick = action
  return result
}
const badge = (text: string, kind = '') => el('span', { class: `badge ${kind}` }, text)
const note = (text: string, kind = '') => el('p', { class: `note ${kind}` }, text)
function selectControl(
  label: string,
  value: string,
  choices: [string, string][],
  update: (value: string) => void,
  id: string,
) {
  const select = el('select', { id })
  for (const [key, text] of choices) select.append(el('option', { value: key }, text))
  select.value = value
  select.onchange = () => {
    update(select.value)
    detail = undefined
    timelinePage = stackPage = 0
    render()
  }
  return el('label', { class: 'select-control' }, el('span', {}, label), select)
}
function addCapture(name: string, report: DiagnosticsExport, sample = false) {
  const capture = { id: ++sequence, name, report, sample, rows: timeline(report) }
  captures.push(capture)
  selected = capture.id
}
async function importFiles(files: File[]) {
  if (importing) return
  errors = []
  if (files.length + captures.length > MAX_REPORTS) {
    errors = [t('limit')]
    render()
    return
  }
  const request = ++generation
  importing = true
  render()
  for (const file of files) {
    try {
      if (file.size > MAX_BYTES) throw new Error('Report exceeds the 10 MiB limit')
      const text = await file.text()
      if (request !== generation) return
      addCapture(file.name, parseReport(text))
    } catch (error) {
      if (request !== generation) return
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : 'Invalid report'}`,
      )
    }
  }
  if (request !== generation) return
  importing = false
  filter = {}
  detail = undefined
  timelinePage = stackPage = 0
  entryPages.clear()
  render()
}
function loadExamples() {
  generation++
  importing = false
  errors = []
  captures = []
  for (const example of examples()) addCapture(example.name, example.report, true)
  selected = captures[0]!.id
  filter = {}
  detail = undefined
  timelinePage = stackPage = 0
  entryPages.clear()
  render()
}
function clear() {
  generation++
  importing = false
  captures = []
  selected = 0
  errors = []
  filter = {}
  detail = undefined
  timelinePage = stackPage = 0
  entryPages.clear()
  render()
}

function render() {
  const focus = document.activeElement?.id
  document.documentElement.lang = locale
  document.title = `${t('title')} · vue-router-ns`
  app.replaceChildren()
  const file = el('input', {
    type: 'file',
    accept: '.json,application/json',
    multiple: '',
    id: 'report-files',
    class: 'file-input',
    'aria-label': t('open'),
  })
  file.onchange = () => {
    void importFiles(Array.from(file.files ?? []))
  }
  file.disabled = importing
  const open = button(importing ? t('importing') : t('open'), () => file.click(), {
    class: 'primary',
    id: 'open-reports',
  })
  open.disabled = importing
  const header = el(
    'header',
    { class: 'topbar' },
    el(
      'a',
      { href: '#', class: 'brand', 'aria-label': 'vue-router-ns' },
      el('span', { class: 'brand-icon', 'aria-hidden': 'true' }, '↳'),
      el('span', {}, 'vue-router-ns', el('small', {}, 'DIAGNOSTICS')),
    ),
    el(
      'div',
      { class: 'header-actions' },
      badge(t('local'), 'local'),
      selectControl(
        t('language'),
        locale,
        [
          ['en', 'English'],
          ['pt-BR', 'Português'],
          ['es', 'Español'],
          ['zh-CN', '简体中文'],
        ],
        (value) => {
          locale = value as Locale
        },
        'language',
      ),
      open,
      file,
    ),
  )
  const sidebar = el(
    'aside',
    { class: 'sidebar', 'aria-label': t('reports') },
    el(
      'div',
      { class: 'sidebar-label' },
      t('reports'),
      el('span', {}, String(captures.length)),
    ),
  )
  for (const capture of captures) {
    const item = button(
      '',
      () => {
        selected = capture.id
        filter = {}
        detail = undefined
        timelinePage = stackPage = 0
        entryPages.clear()
        render()
      },
      {
        id: `capture-${capture.id}`,
        class: `capture ${capture.id === selected ? 'chosen' : ''}`,
        'aria-pressed': String(capture.id === selected),
      },
    )
    item.append(
      el('span', { class: 'capture-name' }, capture.name),
      el('small', {}, capture.report.routerId),
      el(
        'small',
        {},
        `${capture.report.events.length} ${t('events').toLowerCase()} · ${capture.report.snapshot.issues.length} issues`,
      ),
    )
    sidebar.append(item)
  }
  sidebar.append(button(t('example'), loadExamples, { class: 'example', id: 'examples' }))
  if (captures.length)
    sidebar.append(button(t('clear'), clear, { class: 'quiet', id: 'clear-reports' }))
  sidebar.append(
    el(
      'div',
      { class: 'sidebar-foot' },
      note(t('isolated')),
      note(t('privacy')),
      document.documentElement.dataset.standalone === 'true' &&
        location.protocol !== 'file:' &&
        el(
          'a',
          { href: location.pathname, download: 'navigation-diagnostics.html' },
          t('download'),
        ),
    ),
  )
  const main = el('main', { id: 'main-content' })
  if (errors.length)
    main.append(
      el(
        'section',
        { role: 'alert', class: 'error-box' },
        el('strong', {}, t('fileError')),
        ...errors.map((error) => el('p', {}, error)),
      ),
    )
  const capture = captures.find((capture) => capture.id === selected)
  if (!capture) {
    main.append(
      el(
        'section',
        { class: 'empty' },
        el('div', { class: 'eyebrow' }, 'VUE ROUTER NS / REPORT VIEWER'),
        el('h1', {}, t('empty')),
        el('p', { class: 'intro' }, t('intro')),
        el(
          'div',
          { class: 'empty-map', 'aria-hidden': 'true' },
          ...['request', 'guard', 'mount', 'native'].map((phase) =>
            el('span', {}, phase),
          ),
        ),
        button(t('open'), () => file.click(), { class: 'primary' }),
        button(t('example'), loadExamples, { class: 'secondary' }),
        note(t('format')),
        el('code', {}, 'router.diagnostics.export()'),
        note(t('privacy')),
      ),
    )
  } else renderCapture(main, capture)
  app.append(header, el('div', { class: 'workspace' }, sidebar, main))
  if (focus) document.getElementById(focus)?.focus({ preventScroll: true })
}

function renderCapture(main: HTMLElement, capture: Capture) {
  const { report, rows } = capture
  const incomplete = rows.filter(
    (row) => !['complete', 'event'].includes(row.completeness),
  ).length
  const longest = (phase: string) => {
    const values = rows
      .filter(
        (row) =>
          row.event.phase === phase &&
          row.completeness !== 'ambiguous' &&
          row.duration !== undefined,
      )
      .map((row) => row.duration!)
    return values.length ? Math.max(...values) : undefined
  }
  main.append(
    el(
      'section',
      { class: 'report-heading' },
      el(
        'div',
        { class: 'eyebrow' },
        t(capture.sample ? 'sample' : 'imported'),
        ' / VERSION 1',
      ),
      el('h1', {}, t('title')),
      el('p', { class: 'intro' }, t('subtitle')),
      el(
        'div',
        { class: 'capture-meta' },
        badge(report.routerId),
        badge(`${t('at')} ${ms(report.snapshot.time)}`),
        badge(t(report.snapshot.stopped ? 'stopped' : 'captured')),
      ),
      capture.sample && note(t('exampleNote'), 'sample-note'),
    ),
  )
  const metrics = el('section', { class: 'metrics', 'aria-label': t('reports') })
  for (const [label, value, kind] of [
    [t('events'), String(report.events.length), ''],
    [t('guard'), ms(longest('guard')), ''],
    [t('mount'), ms(longest('mount')), ''],
    [
      t('issues'),
      String(report.snapshot.issues.length),
      report.snapshot.issues.length ? 'danger' : '',
    ],
  ] as const)
    metrics.append(
      el(
        'div',
        { class: `metric ${kind}` },
        el('span', {}, label),
        el('strong', {}, value),
      ),
    )
  main.append(metrics)
  if (report.droppedEvents || incomplete)
    main.append(
      note(
        `${format(report.droppedEvents)} ${t('dropped')} · ${incomplete} ${t('incomplete')}. ${t('partial')}`,
        'warning',
      ),
    )
  const tabs = el(
    'div',
    { class: 'view-controls' },
    el(
      'div',
      { class: 'tabs', role: 'group', 'aria-label': t('title') },
      ...(['snapshot', 'timeline'] as const).map((value) =>
        button(
          t(value),
          () => {
            tab = value
            detail = undefined
            render()
          },
          {
            id: `tab-${value}`,
            class: tab === value ? 'active' : '',
            'aria-pressed': String(tab === value),
          },
        ),
      ),
    ),
    selectControl(
      t('window'),
      filter.window ?? '',
      [
        ['', t('allWindows')],
        ...windowIds(report).map((id): [string, string] => [
          id,
          id === '(unknown)' ? t('unknown') : id,
        ]),
      ],
      (value) => {
        filter.window = value
      },
      'window-filter',
    ),
  )
  main.append(tabs)
  if (tab === 'snapshot') renderSnapshot(main, report)
  else renderTimeline(main, capture)
  main.append(
    el(
      'footer',
      { class: 'report-footer' },
      `${t('origin')}: ${new Date(report.startedAt).toISOString()}`,
      note(t('limitsSnapshot')),
    ),
  )
}

function renderSnapshot(main: HTMLElement, report: DiagnosticsExport) {
  main.append(note(t('focused')))
  const issues = el(
    'section',
    {
      class: `issues ${report.snapshot.issues.length ? 'has-issues' : ''}`,
      'aria-label': t('issues'),
    },
    el('h2', {}, t('issues')),
  )
  if (!report.snapshot.issues.length) issues.append(note(t('noIssue')))
  for (const issue of report.snapshot.issues)
    issues.append(
      el(
        'div',
        { class: 'issue-row' },
        badge(issue.code, 'danger'),
        el('code', {}, issue.stackId ?? report.routerId),
        issue.hostId && el('code', {}, issue.hostId),
      ),
    )
  main.append(issues)
  const stacks = report.snapshot.stacks.filter(
    (stack) =>
      !filter.window ||
      stack.native.some((host) => (host.windowId ?? '(unknown)') === filter.window),
  )
  if (!stacks.length)
    main.append(note(report.snapshot.stacks.length ? t('emptyFilter') : t('noStack')))
  stackPage = Math.min(stackPage, Math.max(0, Math.ceil(stacks.length / 20) - 1))
  if (stacks.length > 20)
    main.append(
      pager(
        stackPage,
        stacks.length,
        20,
        (page) => {
          stackPage = page
          render()
        },
        'stacks',
      ),
    )
  for (const stack of stacks.slice(stackPage * 20, (stackPage + 1) * 20)) {
    const section = el(
      'section',
      { class: 'stack-card' },
      el(
        'header',
        {},
        el(
          'div',
          {},
          el('div', { class: 'eyebrow' }, stack.id),
          el('h2', {}, stack.name || stack.id),
        ),
        el(
          'div',
          { class: 'badges' },
          badge(t(stack.busy ? 'busy' : 'idle'), stack.busy ? 'warning' : 'good'),
          stack.modal && badge(t('modal')),
        ),
      ),
    )
    const hosts = el('div', { class: 'hosts' })
    for (const host of stack.native)
      hosts.append(
        el(
          'div',
          { class: 'host' },
          el('strong', {}, `${host.role} / ${host.id}`),
          el('span', {}, `${t('window')}: ${host.windowId ?? t('unknown')}`),
          badge(t(host.loaded ? 'loaded' : 'unloaded'), host.loaded ? '' : 'warning'),
        ),
      )
    if (!stack.native.length) hosts.append(note(t('noHost')))
    section.append(hosts)
    const body = el('tbody')
    const entries = compareStack(stack),
      page = entryPages.get(stack.id) ?? 0
    for (const row of entries.slice(page * 100, (page + 1) * 100)) {
      const logical = el(
        'td',
        {},
        row.logical
          ? el(
              'div',
              { class: 'entry' },
              el('strong', {}, row.logical.route),
              el('code', {}, row.logical.id),
              el(
                'div',
                { class: 'badges' },
                row.logical.active && badge(t('active'), 'good'),
                row.logical.awaitingResult && badge(t('result')),
              ),
            )
          : t('absent'),
      )
      const native = el(
        'td',
        {},
        row.native
          ? el(
              'div',
              { class: 'entry' },
              el(
                'strong',
                {},
                row.native.id === null
                  ? t('unmanaged')
                  : (stack.logical.find((entry) => entry.id === row.native!.id)?.route ??
                      row.native.id),
              ),
              el('code', {}, row.native.id ?? 'null'),
              el('small', {}, `${row.native.host.role} · ${row.native.host.id}`),
            )
          : t('absent'),
      )
      body.append(
        el(
          'tr',
          { class: row.differs ? 'differs' : '' },
          el(
            'td',
            { class: 'position-number' },
            String(row.index + 1),
            row.differs &&
              el('span', { title: t('different'), 'aria-label': t('different') }, ' ≠'),
          ),
          logical,
          native,
        ),
      )
    }
    section.append(
      el(
        'div',
        { class: 'table-scroll' },
        el(
          'table',
          { class: 'stack-table' },
          el(
            'caption',
            { class: 'sr-only' },
            `${stack.name}: ${t('logical')} / ${t('native')}`,
          ),
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              el('th', { scope: 'col' }, '#'),
              el('th', { scope: 'col' }, t('logical')),
              el('th', { scope: 'col' }, t('native')),
            ),
          ),
          body,
        ),
      ),
    )
    if (entries.length > 100)
      section.append(
        pager(
          page,
          entries.length,
          100,
          (page) => {
            entryPages.set(stack.id, page)
            render()
          },
          `entries-${stack.id}`,
        ),
      )
    main.append(section)
  }
}

function renderTimeline(main: HTMLElement, capture: Capture) {
  const { report, rows } = capture
  const ids = [
    ...new Set(
      report.events.flatMap((event) =>
        [event.navigationId, event.parentNavigationId].filter(
          (id): id is number => id !== undefined,
        ),
      ),
    ),
  ].sort((a, b) => a - b)
  main.append(
    el(
      'div',
      { class: 'filters' },
      selectControl(
        t('phase'),
        filter.phase ?? '',
        [
          ['', t('allPhases')],
          ...phases.map((phase): [string, string] => [phase, phase]),
        ],
        (value) => {
          filter.phase = value
        },
        'phase-filter',
      ),
      selectControl(
        t('outcome'),
        filter.outcome ?? '',
        [
          ['', t('allOutcomes')],
          ...outcomes.map((outcome): [string, string] => [outcome, outcome]),
        ],
        (value) => {
          filter.outcome = value
        },
        'outcome-filter',
      ),
      selectControl(
        t('request'),
        filter.navigation ?? '',
        [
          ['', t('allRequests')],
          ...ids.map((id): [string, string] => [String(id), `N${id}`]),
        ],
        (value) => {
          filter.navigation = value
        },
        'navigation-filter',
      ),
    ),
    note(t('limits')),
    note(t('mountHint')),
  )
  const shown = filterTimeline(rows, filter)
  const start = rows.length ? Math.min(...rows.map((row) => row.start)) : 0
  const end = rows.length ? Math.max(...rows.map((row) => row.end ?? row.start)) : 0
  const range = Math.max(end - start, 1)
  const tableBody = el('tbody')
  const bounds = el(
    'div',
    { class: 'timeline-bounds' },
    `${shown.length} ${t('matches')}`,
    el('span', {}, `${ms(start)} — ${ms(end)}`),
  )
  main.append(bounds)
  timelinePage = Math.min(timelinePage, Math.max(0, Math.ceil(shown.length / 100) - 1))
  for (const row of shown.slice(timelinePage * 100, (timelinePage + 1) * 100)) {
    const { event } = row
    const title = `${event.phase}${event.detail ? ` · ${event.detail}` : ''}`
    const bar = el('div', {
      class: `span-bar ${event.phase} ${row.completeness !== 'complete' ? 'point' : ''}`,
    })
    bar.style.left = `${Math.min(99, ((row.start - start) / range) * 100)}%`
    bar.style.width =
      row.end === undefined
        ? '7px'
        : `${Math.max(0.5, ((row.end - row.start) / range) * 100)}%`
    const track = el(
      'div',
      {
        class: 'track',
        role: 'img',
        'aria-label': `${t(row.completeness)}: ${ms(row.start)}${row.end === undefined ? '' : ` — ${ms(row.end)}`}`,
      },
      bar,
    )
    const request = el(
      'td',
      {},
      event.navigationId === undefined ? '—' : `N${event.navigationId}`,
    )
    if (event.parentNavigationId !== undefined)
      request.append(
        button(
          `← N${event.parentNavigationId}`,
          () => {
            filter.navigation = String(event.parentNavigationId)
            timelinePage = 0
            render()
          },
          { class: 'parent-link', title: 'parentNavigationId' },
        ),
      )
    tableBody.append(
      el(
        'tr',
        { class: detail === row.key ? 'selected-row' : '' },
        el(
          'td',
          {},
          button(
            title,
            () => {
              detail = row.key
              render()
            },
            {
              class: 'row-button',
              id: `event-${row.key}`,
              'aria-expanded': String(detail === row.key),
            },
          ),
          el('small', { class: 'route-pattern' }, event.route ?? event.code ?? ''),
        ),
        request,
        el('td', {}, track),
        el(
          'td',
          { class: 'duration-cell' },
          ms(row.duration),
          row.completeness === 'missing-start' && el('small', {}, t('reported')),
        ),
        el(
          'td',
          {},
          badge(
            t(row.completeness),
            ['missing-start', 'missing-end', 'ambiguous'].includes(row.completeness)
              ? 'warning'
              : '',
          ),
          event.outcome &&
            badge(
              event.outcome,
              ['error', 'aborted', 'cancelled'].includes(event.outcome)
                ? 'danger'
                : 'good',
            ),
        ),
      ),
    )
  }
  if (!shown.length) main.append(note(rows.length ? t('emptyFilter') : t('emptyEvents')))
  else
    main.append(
      el(
        'div',
        { class: 'table-scroll' },
        el(
          'table',
          { class: 'timeline-table' },
          el('caption', { class: 'sr-only' }, t('timeline')),
          el(
            'thead',
            {},
            el(
              'tr',
              {},
              ...[
                t('phase'),
                t('request'),
                t('position'),
                t('duration'),
                t('status'),
              ].map((label) => el('th', { scope: 'col' }, label)),
            ),
          ),
          tableBody,
        ),
      ),
    )
  if (shown.length > 100)
    main.append(
      pager(
        timelinePage,
        shown.length,
        100,
        (page) => {
          timelinePage = page
          detail = undefined
          render()
        },
        'timeline',
      ),
    )
  const row = rows.find((row) => row.key === detail)
  const panel = el(
    'section',
    { class: 'event-detail', 'aria-label': t('selected') },
    el('h2', {}, t('selected')),
  )
  if (row) {
    panel.append(
      button(
        t('close'),
        () => {
          detail = undefined
          render()
        },
        { class: 'quiet' },
      ),
    )
    const list = el('dl')
    for (const [key, value] of Object.entries(row.event))
      if (value !== undefined) list.append(el('dt', {}, key), el('dd', {}, String(value)))
    panel.append(list, note(t('eventIssue')))
  } else panel.append(note(t('choose')))
  main.append(panel)
}

function pager(
  page: number,
  total: number,
  size: number,
  change: (page: number) => void,
  id: string,
) {
  const previous = button(t('previous'), () => change(page - 1), { id: `${id}-previous` })
  const next = button(t('next'), () => change(page + 1), {
    id: `${id}-next`,
  })
  previous.disabled = page === 0
  next.disabled = (page + 1) * size >= total
  return el(
    'nav',
    { class: 'pager', 'aria-label': id },
    previous,
    el('span', {}, `${page * size + 1}–${Math.min((page + 1) * size, total)} / ${total}`),
    next,
  )
}

render()
