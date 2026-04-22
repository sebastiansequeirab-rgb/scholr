'use client'

import { useLanguage } from '@/components/layout/LanguageContext'
import esTranslations from '@/i18n/es.json'
import enTranslations from '@/i18n/en.json'

type TranslationObject = Record<string, unknown>

function getNestedValue(obj: TranslationObject, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as TranslationObject)[key]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

export function useTranslation() {
  const { language, changeLanguage } = useLanguage()
  const translations = language === 'es' ? esTranslations : enTranslations

  const t = (key: string): string => {
    return getNestedValue(translations as TranslationObject, key)
  }

  return { t, language, changeLanguage }
}
