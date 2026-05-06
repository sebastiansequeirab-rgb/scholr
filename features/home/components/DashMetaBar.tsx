'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Sub-header del dashboard con chips contextuales (reloj 24h + semana + promedio)
 * y alerta inline a la derecha (entrega cierra en HHh MMm).
 */
export function DashMetaBar({
  weekIndex,
  weekTotal,
  avg,
  alertDueLabel,
}: {
  weekIndex: number | null
  weekTotal: number | null
  avg: number | null
  alertDueLabel: string | null   // pre-formatted "1 entrega cierra en 4h 34m" or null
}) {
  const { language } = useTranslation()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000) // every 30s is enough for HH:MM
    return () => clearInterval(id)
  }, [])

  if (!now) {
    return <div className="dash-meta-bar" style={{ minHeight: 36 }} />
  }

  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const day = now.getDate()
  const dayName = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
  const month = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' }).replace('.', '')

  return (
    <div className="dash-meta-bar">
      <div className="dash-meta-bar__chips">
        <span className="dash-meta-chip">
          <span className="material-symbols-outlined">schedule</span>
          <strong>{hh}:{mm}</strong>
          <span>· {dayName} {day} {month}</span>
        </span>
        {weekIndex != null && weekTotal != null && (
          <span className="dash-meta-chip">
            <span className="material-symbols-outlined">calendar_view_week</span>
            <span>{language === 'es' ? 'Semana' : 'Week'}</span>
            <strong>{weekIndex} / {weekTotal}</strong>
          </span>
        )}
        {avg != null && (
          <span className="dash-meta-chip">
            <span className="material-symbols-outlined">leaderboard</span>
            <span>{language === 'es' ? 'Promedio' : 'Average'}</span>
            <strong>{avg.toFixed(1)} / 20</strong>
          </span>
        )}
      </div>
      {alertDueLabel && (
        <span className="dash-alert">
          <span className="material-symbols-outlined">flag</span>
          {alertDueLabel}
        </span>
      )}
    </div>
  )
}
