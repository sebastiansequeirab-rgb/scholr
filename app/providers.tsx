'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'

interface ProvidersProps {
  children: React.ReactNode
  theme?: string
  colorMode?: string
}

function ThemeApplier({ theme }: { theme?: string }) {
  useEffect(() => {
    const t = theme || localStorage.getItem('scholr_theme') || 'indigo'
    localStorage.setItem('scholr_theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }, [theme])
  return null
}

export function Providers({ children, theme, colorMode }: ProvidersProps) {
  // next-themes automatically persists to localStorage under key 'theme'
  // and reads it back on mount — we just need to not block it with a hardcoded class
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={colorMode || 'dark'}
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeApplier theme={theme} />
      {children}
    </ThemeProvider>
  )
}
