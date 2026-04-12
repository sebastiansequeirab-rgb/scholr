'use client'

import { useTimeFormat } from '@/hooks/useTimeFormat'

/** Renders a HH:MM time string with the user's preferred format (24h or 12h AM/PM) */
export function ClientTime({ time24 }: { time24: string }) {
  const { use12h } = useTimeFormat()
  const parts = time24.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ?? '00'
  if (!use12h) return <>{time24}</>
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return <>{h12}:{m} {ampm}</>
}

/** Formats a HH:MM string to display string given format preference — for use in non-JSX contexts */
export function formatTimeDisplay(time24: string, use12h: boolean): string {
  const parts = time24.split(':')
  const h = parseInt(parts[0], 10)
  const m = parts[1] ?? '00'
  if (!use12h) return time24
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${ampm}`
}
