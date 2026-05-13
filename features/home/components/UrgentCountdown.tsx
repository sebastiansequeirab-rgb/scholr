'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'

/**
 * Banner urgente con countdown vivo "HH:MM" hasta el deadline.
 * - Si quedan minutos: countdown vivo.
 * - Si ya venció pero hace <24h: estado "Vencida" (sin countdown).
 * - Si pasó más de 24h: no renderiza.
 */
export function UrgentCountdown({
  href,
  deadlineISO,
  title,
  meta,
}: {
  href: string
  deadlineISO: string
  title: string
  meta?: string
}) {
  const { t } = useTranslation()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const deadline = new Date(deadlineISO).getTime()
  const now = Date.now()
  const diffMs = deadline - now
  void tick

  // Pasó hace más de 24h → ocultar
  if (diffMs < -24 * 60 * 60 * 1000) return null

  const expired = diffMs <= 0

  const totalMin = Math.floor(Math.max(0, diffMs) / 60000)
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin % (24 * 60)) / 60)
  const mins = totalMin % 60

  const countdown = days > 0
    ? `${days}d ${hours.toString().padStart(2, '0')}h`
    : `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`

  return (
    <Link href={href} className={`urgent-banner-2${expired ? ' urgent-banner-2--expired' : ''}`}>
      <span className={`urgent-banner-2__pill${expired ? ' urgent-banner-2__pill--expired' : ''}`}>
        <span className="material-symbols-outlined">{expired ? 'block' : 'flag'}</span>
        {expired ? t('dashboard.expiredLabel') : t('dashboard.urgentLabel')}
      </span>
      {expired ? (
        <span className="urgent-banner-2__count urgent-banner-2__count--expired">
          {t('dashboard.expiredCopy')}
        </span>
      ) : (
        <span className="urgent-banner-2__count">{countdown}</span>
      )}
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
