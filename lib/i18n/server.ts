import { cookies } from 'next/headers'
import esTranslations from '@/i18n/es.json'
import enTranslations from '@/i18n/en.json'

type Lang = 'es' | 'en'
type Dict = Record<string, unknown>

function lookup(dict: Dict, path: string): string {
  let cur: unknown = dict
  for (const key of path.split('.')) {
    if (cur && typeof cur === 'object' && key in cur) cur = (cur as Dict)[key]
    else return path
  }
  return typeof cur === 'string' ? cur : path
}

/** Read locale from the cookie LanguageProvider writes. Defaults to 'es'. */
export function getLocale(): Lang {
  const cookie = cookies().get('skolar_lang')?.value
  return cookie === 'en' ? 'en' : 'es'
}

/** Server-side translator. Uses the same key paths as the client `useTranslation` hook. */
export function getTranslator(locale?: Lang) {
  const lang = locale ?? getLocale()
  const dict = (lang === 'es' ? esTranslations : enTranslations) as Dict
  return {
    lang,
    t: (key: string) => lookup(dict, key),
    /** Locale string for `Date.toLocaleDateString` etc. */
    bcp47: lang === 'es' ? 'es-ES' : 'en-US',
  }
}
