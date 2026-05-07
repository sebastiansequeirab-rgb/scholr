// Shared computations for the contextual top bar (DashMetaBar) and pages
// that need: ISO week of year, weighted average across subjects, and the
// "1 entrega cierra en HHh MMm" alert. Mirrors logic in app/(app)/dashboard/page.tsx.

import type { Exam, Subject, Task } from '@/types'

export function computeIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function computeWeightedAvg(subjects: Subject[], exams: Exam[]): number | null {
  let weightedSum = 0
  let creditsSum = 0
  for (const s of subjects) {
    const sExams = exams.filter(e => e.subject_id === s.id && e.percentage != null)
    let earned = 0
    let coverage = 0
    for (const e of sExams) {
      if (e.grade != null) {
        earned += (e.grade * (e.percentage ?? 0)) / 100
        coverage += e.percentage ?? 0
      }
    }
    if (coverage > 0) {
      const credits = s.credits || 1
      weightedSum += (earned / (coverage / 100)) * credits
      creditsSum += credits
    }
  }
  return creditsSum > 0 ? weightedSum / creditsSum : null
}

/**
 * Returns "1 entrega cierra en HHh MMm" if the soonest pending task or
 * upcoming exam is within the next 24 hours, otherwise null.
 */
export function computeAlertDueLabel(
  tasks: Task[],
  exams: Exam[],
  lang: 'es' | 'en',
): string | null {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  let soonestMs = Infinity

  for (const t of tasks) {
    if (t.is_done || !t.due_date) continue
    const ms = new Date(t.due_date + 'T23:59:00').getTime()
    const delta = ms - now
    if (delta > 0 && delta < dayMs && ms < soonestMs) soonestMs = ms
  }
  for (const e of exams) {
    const time = e.exam_time || '23:59'
    const ms = new Date(e.exam_date + 'T' + time).getTime()
    const delta = ms - now
    if (delta > 0 && delta < dayMs && ms < soonestMs) soonestMs = ms
  }

  if (soonestMs === Infinity) return null

  const diffMin = Math.max(0, Math.floor((soonestMs - now) / 60000))
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  const time = h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
  return lang === 'es' ? `1 entrega cierra en ${time}` : `1 item due in ${time}`
}

/**
 * Maps a subject's color hex + name to a 4-letter uppercase code and color.
 * Falls back to "—" + neutral grey for null/unknown subjects.
 */
export function subjectInfo(
  subjectId: string | null | undefined,
  subjects: Subject[],
): { code: string; color: string; name: string } {
  if (!subjectId) return { code: '—', color: '#6b7280', name: '' }
  const s = subjects.find(s => s.id === subjectId)
  if (!s) return { code: '—', color: '#6b7280', name: '' }
  const firstWord = s.name.split(/\s+/)[0] || s.name
  const code = firstWord.slice(0, 4).toUpperCase() || '—'
  return { code, color: s.color, name: s.name }
}
