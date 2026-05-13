'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Saludo basado en hora local del navegador.
 * 05–11 → mañana · 12–19 → tarde · 20–04 → noche.
 */
export function GreetingTitle({ firstName }: { firstName: string }) {
  const { t } = useTranslation()
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  const greet = (() => {
    if (hour == null) return ''
    if (hour >= 5 && hour < 12) return t('dashboard.morningGreet')
    if (hour >= 12 && hour < 20) return t('dashboard.afternoonGreet')
    return t('dashboard.eveningGreet')
  })()

  return (
    <h1 className="dash-hero__title">
      {greet && <>{greet}, </>}
      <span className="serif">{firstName}</span>
    </h1>
  )
}
