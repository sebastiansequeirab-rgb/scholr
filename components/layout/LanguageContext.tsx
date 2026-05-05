'use client'

import { createContext, useContext, useState, useEffect } from 'react'

type Language = 'es' | 'en'

interface LanguageContextValue {
  language: Language
  changeLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'es',
  changeLanguage: () => {},
})

const COOKIE_NAME = 'skolar_lang'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365  // 1 year — server components read this

function writeCookie(lang: Language) {
  document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

function readCookie(): Language | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(es|en)`))
  return (m?.[1] as Language) ?? null
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es')

  useEffect(() => {
    const fromCookie = readCookie()
    const saved = localStorage.getItem('scholr_language') as Language | null
    const initial: Language = fromCookie ?? saved ?? (navigator.language.startsWith('es') ? 'es' : 'en')
    setLanguage(initial)
    // Backfill cookie if it's missing — server components need it
    if (!fromCookie) writeCookie(initial)
  }, [])

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('scholr_language', lang)
    writeCookie(lang)
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
