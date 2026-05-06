'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

/** Reloj 24h del Hero — "19:25:01" con segundero chico + fecha mono UPPERCASE debajo */
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  const { language } = useTranslation()

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) {
    return (
      <div className="dash-hero__clock" style={{ minHeight: 80 }}>
        <div className="dash-hero__clock-time" style={{ opacity: 0.4 }}>
          --:--
          <span className="dash-hero__clock-sec">:--</span>
        </div>
      </div>
    )
  }

  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const ss = now.getSeconds().toString().padStart(2, '0')

  // Format date as "JUEVES · 23 ABR · 2026"
  const dayName = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
  const day = now.getDate()
  const month = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' }).replace('.', '')
  const year = now.getFullYear()

  return (
    <div className="dash-hero__clock">
      <div className="dash-hero__clock-time">
        {hh}:{mm}
        <span className="dash-hero__clock-sec">:{ss}</span>
      </div>
      <div className="dash-hero__clock-date">
        {dayName} · {day} {month} · {year}
      </div>
    </div>
  )
}
