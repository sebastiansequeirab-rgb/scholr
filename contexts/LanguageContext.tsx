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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es')

  useEffect(() => {
    const saved = localStorage.getItem('scholr_language') as Language | null
    if (saved === 'es' || saved === 'en') {
      setLanguage(saved)
    } else {
      const browserLang = navigator.language.startsWith('es') ? 'es' : 'en'
      setLanguage(browserLang)
    }
  }, [])

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('scholr_language', lang)
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
