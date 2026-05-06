'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Banner urgente con countdown vivo "HH:MM" hasta el deadline.
 * Si el deadline ya pasó, muestra "00:00".
 * Si está a más de 24h, cae a un formato "Xd HHh".
 */
export function UrgentCountdown({
  href,
  deadlineISO,
  title,
  meta,
}: {
  href: string
  deadlineISO: string  // full ISO datetime; for date-only use we caller pads to T23:59
  title: string
  meta?: string
}) {
  const { t } = useTranslation()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 60_000) // refresh every minute
    return () => clearInterval(id)
  }, [])

  const deadline = new Date(deadlineISO).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, deadline - now)
  const totalMin = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin % (24 * 60)) / 60)
  const mins = totalMin % 60

  const countdown = days > 0
    ? `${days}d ${hours.toString().padStart(2, '0')}h`
    : `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`

  // touch tick to keep React happy (linter)
  void tick

  return (
    <Link href={href} className="urgent-banner-2">
      <span className="urgent-banner-2__pill">
        <span className="material-symbols-outlined">flag</span>
        {t('dashboard.urgentLabel')}
      </span>
      <span className="urgent-banner-2__count">{countdown}</span>
      <div className="urgent-banner-2__text">
        <strong>{title}</strong>
        {meta && <span className="meta"> · {meta}</span>}
      </div>
      <span className="urgent-banner-2__btn">
        {t('dashboard.openLabel')}
        <span className="material-symbols-outlined">arrow_outward</span>
      </span>
    </Link>
  )
}
