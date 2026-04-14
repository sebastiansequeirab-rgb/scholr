'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Exam, Subject } from '@/types'
import { ACTIVITY_TYPES } from '@/types'

type FilterMode = 'due' | 'subject' | 'recent'

const MODES: { key: FilterMode; label: string }[] = [
  { key: 'due',     label: 'Próximas'  },
  { key: 'subject', label: 'Materia'   },
  { key: 'recent',  label: 'Recientes' },
]

function sortExams(exams: Exam[], mode: FilterMode, todayStr: string): Exam[] {
  const upcoming = exams.filter(e => e.exam_date >= todayStr)
  if (mode === 'recent') return [...upcoming].sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (mode === 'subject') return [...upcoming].sort((a, b) => (a.subject_id || '').localeCompare(b.subject_id || ''))
  return [...upcoming].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
}

export function ExamFeed({ exams, subjects }: { exams: Exam[]; subjects: Subject[] }) {
  const [mode,    setMode]    = useState<FilterMode>('due')
  const [index,   setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]
  const filtered = sortExams(exams, mode, todayStr)

  const advance = useCallback(() => {
    if (filtered.length <= 1) return
    setVisible(false)
    setTimeout(() => {
      setIndex(i => (i + 1) % filtered.length)
      setVisible(true)
    }, 260)
  }, [filtered.length])

  useEffect(() => { setIndex(0); setVisible(true) }, [mode])

  useEffect(() => {
    if (filtered.length <= 1) return
    const id = setInterval(advance, 4000)
    return () => clearInterval(id)
  }, [advance, filtered.length])

  const exam    = filtered[index]
  const subject = exam ? subjects.find(s => s.id === exam.subject_id) : null
  const actCfg  = exam ? ACTIVITY_TYPES[(exam.activity_type || 'exam') as keyof typeof ACTIVITY_TYPES] : null

  const daysUntil = exam
    ? Math.round((new Date(exam.exam_date).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null

  const urgencyColor = daysUntil === null ? 'var(--color-primary)'
    : daysUntil < 3 ? 'var(--danger)'
    : daysUntil < 7 ? 'var(--warning)'
    : actCfg?.color || 'var(--color-primary)'

  return (
    <div className="rounded-2xl p-4 flex flex-col"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)', minHeight: '200px' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2 text-sm" style={{ color: 'var(--on-surface)' }}>
          <span className="material-symbols-outlined text-[18px]"
            style={{ color: '#ef4444', fontVariationSettings: "'FILL' 1" }}>event_upcoming</span>
          Actividades
          {filtered.length > 0 && (
            <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444' }}>
              {filtered.length}
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
            onClick={() => setMode(m.key)}
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

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <span className="material-symbols-outlined text-2xl mb-1"
            style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>event_available</span>
          <p className="text-xs" style={{ color: 'var(--color-outline)' }}>Sin actividades próximas</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Animated card */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{
              backgroundColor: daysUntil !== null && daysUntil < 3 ? 'var(--priority-high-bg)' : 'var(--s-base)',
              border: `1px solid color-mix(in srgb, ${urgencyColor} 20%, var(--border-subtle))`,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(5px)',
              transition: 'opacity 0.26s ease, transform 0.26s ease',
            }}>
            {exam && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${urgencyColor} 16%, transparent)` }}>
                    <span className="material-symbols-outlined text-[15px]"
                      style={{ color: urgencyColor, fontVariationSettings: "'FILL' 1" }}>
                      {actCfg?.icon || 'event_upcoming'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>
                      {exam.title}
                    </p>
                    {subject && (
                      <span className="text-[10px] font-semibold mt-0.5 inline-block" style={{ color: subject.color }}>
                        {subject.name}
                      </span>
                    )}
                  </div>
                  {daysUntil !== null && (
                    <div className="flex-shrink-0 text-right">
                      <p className="mono text-[13px] font-black leading-none" style={{ color: urgencyColor }}>
                        {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañ' : `${daysUntil}d`}
                      </p>
                      <p className="mono text-[9px] mt-0.5" style={{ color: 'var(--color-outline)' }}>
                        {new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  )}
                </div>
                {exam.location && (
                  <div className="mt-1.5 flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-[11px]">location_on</span>
                    <span className="text-[10px]">{exam.location}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Progress dots */}
          {filtered.length > 1 && (
            <div className="flex items-center justify-center gap-1 mt-2.5">
              {filtered.slice(0, Math.min(filtered.length, 7)).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setVisible(false); setTimeout(() => { setIndex(i); setVisible(true) }, 260) }}
                  className="rounded-full transition-all"
                  style={{
                    width:           i === index ? '14px' : '5px',
                    height:          '5px',
                    backgroundColor: i === index ? '#ef4444' : 'var(--border-strong)',
                  }}
                />
              ))}
              {filtered.length > 7 && (
                <span className="mono text-[9px]" style={{ color: 'var(--color-outline)' }}>+{filtered.length - 7}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
