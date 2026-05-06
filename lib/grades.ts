/**
 * Skolar — Sistema de calificación
 * Escala 0–20. Aprueba con ≥ 9.5.
 * Nota final = Σ (score / max) × 20 × (peso / 100), con Σ peso = 100.
 *
 * Portado 1:1 desde la canvas (re design/_src/skolar-2/project/components/grades.js).
 */

export const PASS = 9.5
export const MAX_SCORE = 20

export type GradeStatus = 'pass' | 'risk' | 'fail' | 'pending'
export type GradeClass = 'good' | 'pass' | 'risk' | 'fail' | 'pending'

export interface GradeItem {
  label: string
  weight: number          // 0..100
  score: number | null    // null = pendiente
  max?: number            // default 20
  status?: 'done' | 'upcoming'
  when?: string           // ISO date or label
}

export interface GradeSummary {
  currentAverage: number | null
  projectedFinal: number | null
  neededToPass:   number | null
  doneWeight:     number
  pendingWeight:  number
  totalWeight:    number
  pointsEarned:   number
  pointsPossibleRemaining: number
  pointsTotalScale: number
  status:         GradeStatus
  pass:           number
  countDone:      number
  countPending:   number
  countTotal:     number
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function classify(score: number | null | undefined): GradeClass {
  if (score == null) return 'pending'
  if (score >= 14)   return 'good'
  if (score >= PASS) return 'pass'
  if (score >= 8)    return 'risk'
  return 'fail'
}

export function gradeColor(cls: GradeClass): string {
  return ({
    good:    'var(--success)',
    pass:    'var(--color-primary)',
    risk:    'var(--warning)',
    fail:    'var(--danger)',
    pending: 'var(--color-outline)',
  } as const)[cls]
}

export function summarize(grades: GradeItem[]): GradeSummary {
  const done    = grades.filter(g => g.score != null)
  const pending = grades.filter(g => g.score == null)

  const totalWeight   = grades.reduce((s, g) => s + g.weight, 0)
  const doneWeight    = done.reduce((s, g) => s + g.weight, 0)
  const pendingWeight = totalWeight - doneWeight

  // Earned (already-rendered grades, scaled to 0..20)
  const earnedFromDone = done.reduce(
    (s, g) => s + (g.score! / (g.max || MAX_SCORE)) * MAX_SCORE * (g.weight / 100),
    0,
  )

  const currentAverage =
    doneWeight > 0
      ? clamp(earnedFromDone / (doneWeight / 100), 0, MAX_SCORE)
      : null

  // If pending grades match the current average, what's the projected final?
  const projectedFinal =
    currentAverage != null
      ? clamp(
          earnedFromDone + (currentAverage / MAX_SCORE) * MAX_SCORE * (pendingWeight / 100),
          0,
          MAX_SCORE,
        )
      : null

  // Average required on remaining weight to reach PASS
  let neededToPass: number | null = null
  if (pendingWeight > 0) {
    neededToPass = clamp(((PASS - earnedFromDone) * 100) / pendingWeight, 0, MAX_SCORE)
    // If the calc literally exceeds the scale, mark as Infinity (UI shows "imposible")
    const rawNeed = ((PASS - earnedFromDone) * 100) / pendingWeight
    if (rawNeed > MAX_SCORE) neededToPass = Infinity
  } else if (currentAverage != null) {
    neededToPass = currentAverage >= PASS ? 0 : Infinity
  }

  let status: GradeStatus
  if (currentAverage == null) status = 'pending'
  else if (neededToPass != null && neededToPass > MAX_SCORE) status = 'fail'
  else if (currentAverage >= PASS) status = 'pass'
  else if (neededToPass != null && neededToPass > 14) status = 'risk'
  else status = 'pass'

  return {
    currentAverage,
    projectedFinal,
    neededToPass,
    doneWeight,
    pendingWeight,
    totalWeight,
    pointsEarned: earnedFromDone,
    pointsPossibleRemaining: pendingWeight / 5, // 100% = 20pts → 5% = 1pt
    pointsTotalScale: MAX_SCORE,
    status,
    pass: PASS,
    countDone:    done.length,
    countPending: pending.length,
    countTotal:   grades.length,
  }
}

/** What if I average `futureAvg` (0..20) on the remaining weight? */
export function projectIfAvg(grades: GradeItem[], futureAvg: number): number | null {
  const s = summarize(grades)
  if (s.pendingWeight === 0) return s.currentAverage
  const projected = s.pointsEarned + (futureAvg / MAX_SCORE) * MAX_SCORE * (s.pendingWeight / 100)
  return clamp(projected, 0, MAX_SCORE)
}

export function statusLabel(status: GradeStatus, lang: 'es' | 'en' = 'es'): string {
  const map = {
    es: { pass: 'APROBANDO', risk: 'EN RIESGO', fail: 'DESAPROBANDO', pending: 'SIN NOTAS' },
    en: { pass: 'PASSING',   risk: 'AT RISK',   fail: 'FAILING',      pending: 'NO GRADES' },
  } as const
  return map[lang][status] || '—'
}

export function statusBg(status: GradeStatus): string {
  return ({
    pass:    'color-mix(in srgb, var(--success) 16%, transparent)',
    risk:    'color-mix(in srgb, var(--warning) 18%, transparent)',
    fail:    'color-mix(in srgb, var(--danger) 18%, transparent)',
    pending: 'var(--s-low)',
  } as const)[status]
}

export function statusFg(status: GradeStatus): string {
  return ({
    pass:    'var(--success)',
    risk:    'var(--warning)',
    fail:    'var(--danger)',
    pending: 'var(--color-outline)',
  } as const)[status]
}
