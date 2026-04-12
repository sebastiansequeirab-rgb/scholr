'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface TimeFormatContextValue {
  use12h: boolean
  setFormat: (fmt: '12h' | '24h') => void
}

const TimeFormatContext = createContext<TimeFormatContextValue>({
  use12h: false,
  setFormat: () => {},
})

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const [use12h, setUse12h] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('scholr_time_format')
    setUse12h(stored === '12h')
  }, [])

  const setFormat = (fmt: '12h' | '24h') => {
    const next = fmt === '12h'
    setUse12h(next)
    localStorage.setItem('scholr_time_format', fmt)
  }

  return (
    <TimeFormatContext.Provider value={{ use12h, setFormat }}>
      {children}
    </TimeFormatContext.Provider>
  )
}

export function useTimeFormatContext() {
  return useContext(TimeFormatContext)
}
