'use client'

import { useState, useEffect } from 'react'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { useTranslation } from '@/hooks/useTranslation'

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)
  const { use12h } = useTimeFormat()
  const { language } = useTranslation()

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) {
    return (
      <div className="flex flex-col items-end justify-center" style={{ minHeight: 56 }}>
        <div className="font-mono text-[44px] leading-[0.95] font-light tabular" style={{ color: 'var(--on-surface)', opacity: 0.4 }}>
          --:--
        </div>
      </div>
    )
  }

  const rawHours = now.getHours()
  const mm = now.getMinutes().toString().padStart(2, '0')
  const ss = now.getSeconds().toString().padStart(2, '0')

  let hh: string
  let period: string | null = null
  if (use12h) {
    const h12 = rawHours % 12 || 12
    hh = h12.toString()
    period = rawHours >= 12 ? 'pm' : 'am'
  } else {
    hh = rawHours.toString().padStart(2, '0')
  }

  const dateStr = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col items-end justify-center text-right">
      {/* Time display */}
      <div
        className="font-mono leading-[0.95] font-light tabular"
        style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}
      >
        <span className="text-[44px]">{hh}</span>
        <span className="text-[44px]" style={{ color: 'var(--color-primary)' }}>:</span>
        <span className="text-[44px]">{mm}</span>
        <span className="text-[18px] ml-1" style={{ color: 'var(--color-outline)' }}>
          :{ss}
        </span>
        {period && (
          <span className="text-[15px] ml-1 font-medium" style={{ color: 'var(--color-outline)' }}>
            {period}
          </span>
        )}
      </div>

      {/* Date */}
      <p
        className="font-mono text-[10px] mt-2 capitalize"
        style={{
          color: 'var(--color-outline)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}
      >
        {dateStr}
      </p>
    </div>
  )
}
