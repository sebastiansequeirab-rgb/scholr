import type { CourseAccent } from '@/types'

const VALID: CourseAccent[] = ['rose', 'blue', 'amber', 'green', 'violet', 'teal']

export function accentClass(accent: CourseAccent | string | null | undefined): string {
  const a = accent ?? 'blue'
  return (VALID as string[]).includes(a) ? `acc-${a}` : 'acc-blue'
}

export function isCourseAccent(value: unknown): value is CourseAccent {
  return typeof value === 'string' && (VALID as string[]).includes(value)
}

/** Tailwind-ish helpers that resolve to CSS variables. */
export const ACCENT_TOKENS = {
  color: 'var(--accent-color, var(--color-primary))',
  bg:    'var(--accent-bg, color-mix(in srgb, var(--color-primary) 12%, transparent))',
} as const

/** 0..20 → class name for color coding (matches globals.css thresholds). */
export function gradeClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'grade-pending'
  if (value >= 14) return 'grade-good'
  if (value >= 9.5) return 'grade-pass'
  if (value >= 8)   return 'grade-risk'
  return 'grade-fail'
}

/** Generate course access codes: SLUG3-AAAA-XXX (3 letters from name + year + 3 random). */
export function generateAccessCode(name: string, year: number = new Date().getFullYear()): string {
  const slug = (name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'CRS').padEnd(3, 'X')
  const alphabet = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'
  let rand = ''
  for (let i = 0; i < 3; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${slug}-${year}-${rand}`
}
