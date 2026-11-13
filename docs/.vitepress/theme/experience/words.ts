import { useDocsLocale } from '../locale'

export function useWords() {
  const { locale, link } = useDocsLocale()
  const word = (values: readonly [string, string, string, string]) =>
    values[
      ({ en: 0, 'pt-BR': 1, es: 2, 'zh-CN': 3 } as const)[
        locale.value as 'en' | 'pt-BR' | 'es' | 'zh-CN'
      ]
    ]
  return { word, link }
}
