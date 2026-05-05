'use client'
import { useState } from 'react'
import type { Task, Subject } from '@/types'
import { useTranslation } from '@/hooks/useTranslation'

type FilterMode = 'due' | 'subject' | 'recent'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--priority-high)',
  mid:  'var(--priority-mid)',
  low:  'var(--priority-low)',
}

function daysUntilDate(dateStr: string) {
  // Recompute today on each call so the component stays correct across midnight
  const todayStr = new Date().toISOString().split('T')[0]
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000)
}

export function TaskFeed({ tasks, subjects }: { tasks: Task[]; subjects: Subject[] }) {
  const { t } = useTranslation()
  const [mode,           setMode]           = useState<FilterMode>('due')
  const [subjectChip,    setSubjectChip]    = useState<string>('')

  const MODES: { key: FilterMode; label: string }[] = [
    { key: 'due',     label: t('feeds.filterDue')     },
    { key: 'subject', label: t('feeds.filterSubject') },
    { key: 'recent',  label: t('feeds.filterRecent')  },
  ]

  const pending = tasks.filter(t => !t.is_done)

  // Subjects that actually have pending tasks
  const activeSubjects = subjects.filter(s => pending.some(t => t.subject_id === s.id))

  let filtered = [...pending]
  if (mode === 'subject' && subjectChip) {
    filtered = filtered.filter(t => t.subject_id === subjectChip)
  }
  if (mode === 'due') {
    filtered.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
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
            style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          {t('feeds.tasks')}
          {pending.length > 0 && (
            <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
              {pending.length}
            </span>
          )}
        </h2>
        <a href="/planner"
          className="mono text-[10px] uppercase tracking-widest transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-primary)' }}>
          {t('dashboard.viewAll')}
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
              backgroundColor: mode === m.key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color:           mode === m.key ? 'var(--color-primary)' : 'var(--color-outline)',
              borderColor:     mode === m.key ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-subtle)',
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
              backgroundColor: !subjectChip ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color:           !subjectChip ? 'var(--color-primary)' : 'var(--color-outline)',
              borderColor:     !subjectChip ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-subtle)',
            }}>
            {t('feeds.allChip')}
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

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5">
          <span className="material-symbols-outlined text-2xl mb-1"
            style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-xs" style={{ color: 'var(--color-outline)' }}>{t('feeds.noTasks')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {visible.map(task => {
            const subject   = subjects.find(s => s.id === task.subject_id)
            const days      = task.due_date ? daysUntilDate(task.due_date) : null
            const dueColor  = days === null ? undefined : days <= 0 ? 'var(--danger)' : days === 1 ? 'var(--warning)' : 'var(--color-outline)'
            return (
              <div key={task.id}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_COLOR[task.priority || 'mid'] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>
                    {task.text}
                  </p>
                  {subject && (
                    <span className="text-[10px] font-semibold" style={{ color: subject.color }}>
                      {subject.name}
                    </span>
                  )}
                </div>
                {days !== null && (
                  <span className="mono text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ color: dueColor }}>
                    {days <= 0 ? t('feeds.today') : days === 1 ? t('feeds.tmrwShort') : `${days}d`}
                  </span>
                )}
              </div>
            )
          })}
          {extra > 0 && (
            <p className="text-center mono text-[10px] pt-0.5" style={{ color: 'var(--color-outline)' }}>
              {t('feeds.moreCount').replace('{n}', String(extra))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
