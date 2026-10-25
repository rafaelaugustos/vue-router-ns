import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import es from '../locales/es-ui'
import zh from '../locales/zh-CN-ui'

const dictionaries: Record<string, Record<string, string>> = { es, 'zh-CN': zh }

export function useDocsLocale() {
  const { lang } = useData()
  const locale = computed(() =>
    ['pt-BR', 'es', 'zh-CN'].includes(lang.value) ? lang.value : 'en',
  )
  const t = (english: string, portuguese = english): string =>
    locale.value === 'pt-BR'
      ? portuguese
      : (dictionaries[locale.value]?.[english] ?? english)
  const link = (path: string) =>
    withBase(`${locale.value === 'en' ? '' : `/${locale.value}`}/guide/${path}`)
  function localize<T>(english: T, portuguese: T): T {
    if (locale.value === 'pt-BR') return portuguese
    const visit = (value: unknown): unknown => {
      if (typeof value === 'string') return t(value)
      if (Array.isArray(value)) return value.map(visit)
      if (value && typeof value === 'object')
        return Object.fromEntries(
          Object.entries(value).map(([key, v]) => [key, visit(v)]),
        )
      return value
    }
    return visit(english) as T
  }
  return { locale, t, link, localize }
}
