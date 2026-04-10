'use client'

import { useState, useEffect } from 'react'

export function useTimeFormat() {
  const [use12h, setUse12h] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('scholr_time_format')
    setUse12h(stored === '12h')
  }, [])

  const setFormat = (format: '12h' | '24h') => {
    const next = format === '12h'
    setUse12h(next)
    localStorage.setItem('scholr_time_format', format)
  }

  return { use12h, setFormat }
}
