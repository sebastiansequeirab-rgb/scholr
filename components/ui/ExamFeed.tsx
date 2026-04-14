'use client'
import { useState } from 'react'
import type { Exam, Subject } from '@/types'
import { ACTIVITY_TYPES } from '@/types'

type FilterMode = 'due' | 'subject' | 'recent'

const MODES: { key: FilterMode; label: string }[] = [
  { key: 'due',     label: 'Próximas'  },
  { key: 'subject', label: 'Materia'   },
  { key: 'recent',  label: 'Recientes' },
]

const todayStr = new Date().toISOString().split('T')[0]

function daysUntilDate(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000)
}

export function ExamFeed({ exams, subjects }: { exams: Exam[]; subjects: Subject[] }) {
  const [mode,        setMode]        = useState<FilterMode>('due')
  const [subjectChip, setSubjectChip] = useState<string>('')

  const upcoming = exams.filter(e => e.exam_date >= todayStr)

  // Subjects that have upcoming exams/assignments
  const activeSubjects = subjects.filter(s => upcoming.some(e => e.subject_id === s.id))

  let filtered = [...upcoming]
  if (mode === 'subject' && subjectChip) {
    filtered = filtered.filter(e => e.subject_id === subjectChip)
  }
  if (mode === 'due') {
    filtered.sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  } else if (mode === 'recent') {
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  const visible = filtered.slice(0, 3)
  const extra   = filtered.length - 3

  return (
    <div className="rounded-2xl p-4 flex flex-col"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2 text-sm" style={{ color: 'var(--on-surface)' }}>
          <span className="material-symbols-outlined text-[18px]"
            style={{ color: '#ef4444', fontVariationSettings: "'FILL' 1" }}>event_upcoming</span>
          Actividades
          {upcoming.length > 0 && (
            <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444' }}>
              {upcoming.length}
            </span>
          )}
        </h2>
        <a href="/planner"
          className="mono text-[10px] uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-primary)' }}>
          Ver todo
        </a>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-3">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setSubjectChip('') }}
            className="flex-1 py-1 rounded-full text-[10px] font-semibold border transition-all"
            style={{
              backgroundColor: mode === m.key ? 'color-mix(in srgb, #ef4444 12%, transparent)' : 'transparent',
              color:           mode === m.key ? '#ef4444' : 'var(--color-outline)',
              borderColor:     mode === m.key ? 'color-mix(in srgb, #ef4444 28%, transparent)' : 'var(--border-subtle)',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Subject chips — only when Materia mode active */}
      {mode === 'subject' && activeSubjects.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-3">
          <button
            onClick={() => setSubjectChip('')}
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap"
            style={{
              backgroundColor: !subjectChip ? 'color-mix(in srgb, #ef4444 12%, transparent)' : 'transparent',
              color:           !subjectChip ? '#ef4444' : 'var(--color-outline)',
              borderColor:     !subjectChip ? 'color-mix(in srgb, #ef4444 28%, transparent)' : 'var(--border-subtle)',
            }}>
            Todas
          </button>
          {activeSubjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSubjectChip(s.id === subjectChip ? '' : s.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all whitespace-nowrap"
              style={{
                backgroundColor: subjectChip === s.id ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'transparent',
                color:           subjectChip === s.id ? s.color : 'var(--color-outline)',
                borderColor:     subjectChip === s.id ? `color-mix(in srgb, ${s.color} 40%, transparent)` : 'var(--border-subtle)',
              }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: s.color, flexShrink: 0, display: 'inline-block' }} />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Exam list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5">
          <span className="material-symbols-outlined text-2xl mb-1"
            style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>event_available</span>
          <p className="text-xs" style={{ color: 'var(--color-outline)' }}>Sin actividades próximas</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map(exam => {
            const subject  = subjects.find(s => s.id === exam.subject_id)
            const actCfg   = ACTIVITY_TYPES[(exam.activity_type || 'exam') as keyof typeof ACTIVITY_TYPES]
            const days     = daysUntilDate(exam.exam_date)
            const urgency  = days < 3 ? 'var(--danger)' : days < 7 ? 'var(--warning)' : actCfg?.color || 'var(--color-primary)'
            return (
              <div key={exam.id}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                style={{
                  backgroundColor: days < 3 ? 'var(--priority-high-bg)' : 'var(--s-base)',
                  border: `1px solid color-mix(in srgb, ${urgency} 18%, var(--border-subtle))`,
                }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${urgency} 16%, transparent)` }}>
                  <span className="material-symbols-outlined text-[13px]"
                    style={{ color: urgency, fontVariationSettings: "'FILL' 1" }}>
                    {actCfg?.icon || 'event_upcoming'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>
                    {exam.title}
                  </p>
                  {subject && (
                    <span className="text-[10px] font-semibold" style={{ color: subject.color }}>
                      {subject.name}
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0 text-right mt-0.5">
                  <p className="mono text-[12px] font-black leading-none" style={{ color: urgency }}>
                    {days === 0 ? 'Hoy' : days === 1 ? 'Mañ' : `${days}d`}
                  </p>
                  <p className="mono text-[9px] mt-0.5" style={{ color: 'var(--color-outline)' }}>
                    {new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
          {extra > 0 && (
            <p className="text-center mono text-[10px] pt-0.5" style={{ color: 'var(--color-outline)' }}>
              +{extra} más
            </p>
          )}
        </div>
      )}
    </div>
  )
}
