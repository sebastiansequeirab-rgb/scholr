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
  const pendingWeight = Math.max(0, totalWeight - doneWeight)

  // Puntos acumulados (escala 0-20, ponderados al peso total)
  // Ej: examen 15/20 al 25% → contribuye 15 × 0.25 = 3.75 puntos
  const pointsEarned = done.reduce((s, g) => {
    const max = g.max || MAX_SCORE
    const normalized = clamp((g.score! / max) * MAX_SCORE, 0, MAX_SCORE)
    return s + normalized * (g.weight / 100)
  }, 0)

  // Promedio actual (de lo rendido) — qué nota promedio sacaste en lo que ya rendiste
  const currentAverage =
    doneWeight > 0
      ? clamp(pointsEarned / (doneWeight / 100), 0, MAX_SCORE)
      : null

  // Proyección final asumiendo que el resto pendiente sale igual al promedio actual
  // = puntos_acumulados + promedio_actual × peso_pendiente / 100
  const projectedFinal =
    currentAverage != null
      ? clamp(pointsEarned + currentAverage * (pendingWeight / 100), 0, MAX_SCORE)
      : null

  // Promedio mínimo necesario en lo pendiente para alcanzar PASS (9.5)
  let neededToPass: number | null = null
  if (pendingWeight > 0) {
    const rawNeed = ((PASS - pointsEarned) * 100) / pendingWeight
    neededToPass = rawNeed <= 0 ? 0 : (rawNeed > MAX_SCORE ? Infinity : rawNeed)
  } else if (currentAverage != null) {
    neededToPass = currentAverage >= PASS ? 0 : Infinity
  }

  // Status: usar proyección final como guía
  let status: GradeStatus
  if (currentAverage == null) {
    status = 'pending'
  } else if (neededToPass != null && !Number.isFinite(neededToPass)) {
    status = 'fail'
  } else if (projectedFinal != null && projectedFinal >= PASS + 1.5) {
    status = 'pass'
  } else if (projectedFinal != null && projectedFinal >= PASS) {
    status = 'pass'
  } else if (currentAverage >= PASS && pendingWeight === 0) {
    status = 'pass'
  } else if (projectedFinal != null && projectedFinal >= 8) {
    status = 'risk'
  } else {
    status = 'fail'
  }

  return {
    currentAverage,
    projectedFinal,
    neededToPass,
    doneWeight,
    pendingWeight,
    totalWeight,
    pointsEarned,
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
