'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Task, Subject } from '@/types'

type FilterMode = 'due' | 'subject' | 'recent'

const MODES: { key: FilterMode; label: string }[] = [
  { key: 'due',     label: 'Próximas'  },
  { key: 'subject', label: 'Materia'   },
  { key: 'recent',  label: 'Recientes' },
]

function sortTasks(tasks: Task[], mode: FilterMode): Task[] {
  const pending = tasks.filter(t => !t.is_done)
  if (mode === 'recent') return [...pending].sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (mode === 'subject') return [...pending].sort((a, b) => (a.subject_id || '').localeCompare(b.subject_id || ''))
  return [...pending].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date.localeCompare(b.due_date)
  })
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--priority-high)',
  mid:  'var(--priority-mid)',
  low:  'var(--priority-low)',
}

export function TaskFeed({ tasks, subjects }: { tasks: Task[]; subjects: Subject[] }) {
  const [mode,    setMode]    = useState<FilterMode>('due')
  const [index,   setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  const filtered = sortTasks(tasks, mode)

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
    const id = setInterval(advance, 3600)
    return () => clearInterval(id)
  }, [advance, filtered.length])

  const task    = filtered[index]
  const subject = task ? subjects.find(s => s.id === task.subject_id) : null

  const todayStr = new Date().toISOString().split('T')[0]
  const daysUntilDue = task?.due_date
    ? Math.round((new Date(task.due_date).getTime() - new Date(todayStr).getTime()) / 86400000)
    : null

  return (
    <div className="rounded-2xl p-4 flex flex-col"
      style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)', minHeight: '200px' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold flex items-center gap-2 text-sm" style={{ color: 'var(--on-surface)' }}>
          <span className="material-symbols-outlined text-[18px]"
            style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>task_alt</span>
          Tareas
          {filtered.length > 0 && (
            <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}>
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
              backgroundColor: mode === m.key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color:           mode === m.key ? 'var(--color-primary)' : 'var(--color-outline)',
              borderColor:     mode === m.key ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-subtle)',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <span className="material-symbols-outlined text-2xl mb-1"
            style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <p className="text-xs" style={{ color: 'var(--color-outline)' }}>Sin tareas pendientes</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Animated card */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{
              backgroundColor: 'var(--s-base)',
              border: '1px solid var(--border-subtle)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(5px)',
              transition: 'opacity 0.26s ease, transform 0.26s ease',
            }}>
            {task && (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_COLOR[task.priority || 'mid'] }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>
                      {task.text}
                    </p>
                    {subject && (
                      <span className="text-[10px] font-semibold mt-0.5 inline-block" style={{ color: subject.color }}>
                        {subject.name}
                      </span>
                    )}
                  </div>
                </div>
                {daysUntilDue !== null && (
                  <div className="mt-2 flex items-center gap-1"
                    style={{ color: daysUntilDue === 0 ? 'var(--danger)' : daysUntilDue === 1 ? 'var(--warning)' : 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                    <span className="mono text-[10px] font-bold">
                      {daysUntilDue === 0 ? 'Hoy' : daysUntilDue === 1 ? 'Mañana' : `En ${daysUntilDue}d`}
                    </span>
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
                    backgroundColor: i === index ? 'var(--color-primary)' : 'var(--border-strong)',
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
