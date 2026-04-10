'use client'

import { useEffect, useState } from 'react'
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
  const [language, setLanguage] = useState<'es' | 'en'>('es')

  useEffect(() => {
    const saved = localStorage.getItem('scholr_language') as 'es' | 'en' | null
    if (saved) {
      setLanguage(saved)
    } else {
      const browserLang = navigator.language.startsWith('es') ? 'es' : 'en'
      setLanguage(browserLang)
    }
  }, [])

  const translations = language === 'es' ? esTranslations : enTranslations

  const t = (key: string): string => {
    return getNestedValue(translations as TranslationObject, key)
  }

  const changeLanguage = (lang: 'es' | 'en') => {
    setLanguage(lang)
    localStorage.setItem('scholr_language', lang)
  }

  return { t, language, changeLanguage }
}
