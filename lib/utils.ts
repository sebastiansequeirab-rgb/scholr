export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date, locale: string = 'es'): string {
  return new Date(date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d) // midnight local — avoids UTC off-by-one in negative-offset timezones
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseLocalDate(dateStr)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function isToday(dateStr: string): boolean {
  const today = new Date()
  const d = parseLocalDate(dateStr)
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

export function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const d = parseLocalDate(dateStr)
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  )
}

export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/** Formats a "HH:mm" or "HH:mm:ss" time string as 24h or 12h AM/PM */
export function formatTime(timeStr: string, use12h: boolean): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  const hours   = parseInt(parts[0], 10)
  const minutes = parts[1] || '00'
  if (!use12h) return `${String(hours).padStart(2, '0')}:${minutes}`
  const period = hours >= 12 ? 'pm' : 'am'
  const h12    = hours % 12 || 12
  return `${h12}:${minutes} ${period}`
}

/** Deduplicate an array of objects by their `id` field */
export function uniqueById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Map<string, T>()
  for (const item of arr) seen.set(item.id, item)
  return Array.from(seen.values())
}

/** Deduplicate an array of objects by their `name` field (case-insensitive trim) */
export function uniqueByName<T extends { name: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return arr.filter(item => {
    const key = item.name.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Relative time formatter — "hace 8 días" / "8 days ago" — uses Intl.RelativeTimeFormat */
export function timeAgo(dateStr: string, lang: 'es' | 'en' = 'es'): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang === 'es' ? 'es' : 'en-US', { numeric: 'auto' })
  if (diff < 60)    return rtf.format(-diff, 'second')
  if (diff < 3600)  return rtf.format(-Math.floor(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour')
  return rtf.format(-Math.floor(diff / 86400), 'day')
}

/**
 * Map a subject's color hex to one of the canonical tag-* classes (purple/cyan/green/amber/rose/blue).
 * Used by the v2 design system so cards inherit --accent-color and --accent-bg from CSS instead of
 * relying on inline styles. Picks the closest tag by hue distance; falls back to tag-blue.
 */
export function subjectTag(color: string | null | undefined): 'tag-purple' | 'tag-cyan' | 'tag-green' | 'tag-amber' | 'tag-rose' | 'tag-blue' {
  if (!color) return 'tag-blue'
  const hex = color.replace('#', '').trim()
  if (hex.length !== 6) return 'tag-blue'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // Convert to HSL hue
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  if (max !== min) {
    const d = max - min
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h *= 60
  }
  // Anchor hues for each canonical tag (degrees)
  const anchors: { tag: 'tag-purple' | 'tag-cyan' | 'tag-green' | 'tag-amber' | 'tag-rose' | 'tag-blue'; hue: number }[] = [
    { tag: 'tag-rose',   hue:   0 },
    { tag: 'tag-amber',  hue:  40 },
    { tag: 'tag-green',  hue: 150 },
    { tag: 'tag-cyan',   hue: 185 },
    { tag: 'tag-blue',   hue: 215 },
    { tag: 'tag-purple', hue: 270 },
    { tag: 'tag-rose',   hue: 350 },
  ]
  let best = anchors[0]
  let bestDist = 360
  for (const a of anchors) {
    const d = Math.min(Math.abs(h - a.hue), 360 - Math.abs(h - a.hue))
    if (d < bestDist) { bestDist = d; best = a }
  }
  return best.tag
}
