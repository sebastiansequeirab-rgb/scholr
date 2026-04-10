'use client'

import { useState, useEffect } from 'react'

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!now) return null

  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const ss = now.getSeconds().toString().padStart(2, '0')
  const dateStr = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="relative p-5 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--s-low)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)',
        boxShadow: '0 0 40px color-mix(in srgb, var(--color-primary) 4%, transparent)',
      }}>
      {/* Glow decoration */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full blur-[40px] opacity-15 pointer-events-none"
        style={{ backgroundColor: 'var(--color-primary)' }} />

      {/* Time display */}
      <div className="relative flex items-baseline gap-0.5 mono font-black tracking-tight leading-none"
        style={{ color: 'var(--on-surface)' }}>
        <span className="text-4xl">{hh}</span>
        <span className="text-4xl animate-pulse-slow" style={{ color: 'var(--color-primary)' }}>:</span>
        <span className="text-4xl">{mm}</span>
        <span className="text-xl ml-1 opacity-40">:{ss}</span>
      </div>

      {/* Date */}
      <p className="relative mono text-[10px] uppercase tracking-[0.18em] mt-2 capitalize"
        style={{ color: 'var(--color-outline)' }}>
        {dateStr}
      </p>
    </div>
  )
}
