'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'

export function LiveBadge() {
  const { t, language } = useTranslation()
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setTime(new Date())
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const date = time.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const clock = time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <>
      <span className="t-hero__live">
        <span className="t-hero__live__dot" aria-hidden="true" />
        <span>{t('teacher.common.live')} · {date}</span>
      </span>
      <span className="t-hero__clock" suppressHydrationWarning>{clock}</span>
    </>
  )
}
