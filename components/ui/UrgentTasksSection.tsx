'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isToday, isTomorrow, daysUntil } from '@/lib/utils'
import type { Task, Subject } from '@/types'

export function UrgentTasksSection({
  initialTasks,
  subjects,
}: {
  initialTasks: Task[]
  subjects: Subject[]
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  const toggle = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t))
    const supabase = createClient()
    await supabase.from('tasks').update({
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

  // Urgency score: today=0-2, tomorrow=10-12, future by days, no date=500+
  const urgencyScore = (task: Task): number => {
    const p = task.priority === 'high' ? 0 : task.priority === 'mid' ? 1 : 2
    if (!task.due_date) return 500 + p
    if (isToday(task.due_date))    return 0 + p
    if (isTomorrow(task.due_date)) return 10 + p
    const days = Math.max(0, daysUntil(task.due_date))
    return 20 + Math.min(days, 200) + p
  }

  const visible = tasks
    .filter(t => !t.is_done)
    .sort((a, b) => urgencyScore(a) - urgencyScore(b))
    .slice(0, 6)

  if (visible.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-outlined text-3xl mb-2 block"
          style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 1" }}>
          done_all
        </span>
        <p className="text-sm font-medium" style={{ color: 'var(--color-outline)' }}>
          Sin tareas pendientes ✓
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2.5">
      {visible.map(task => {
        const subject = subjects.find(s => s.id === task.subject_id)

        // Time label + colors based on urgency
        const isToday_    = task.due_date && isToday(task.due_date)
        const isTomorrow_ = task.due_date && isTomorrow(task.due_date)
        const days        = task.due_date ? daysUntil(task.due_date) : null

        const timeLabel = !task.due_date
          ? null
          : isToday_    ? 'Hoy'
          : isTomorrow_ ? 'Mañana'
          : `${days}d`

        // Urgency tier drives the accent color for the whole row
        const urgencyColor = !task.due_date
          ? 'var(--color-outline)'
          : isToday_         ? 'var(--danger)'
          : isTomorrow_      ? 'var(--warning)'
          : (days ?? 99) <= 7 ? 'var(--warning)'
          : 'var(--color-primary)'

        const urgencyBg = !task.due_date
          ? 'transparent'
          : isToday_         ? 'var(--priority-high-bg)'
          : isTomorrow_      ? 'var(--priority-mid-bg)'
          : (days ?? 99) <= 7 ? 'var(--priority-mid-bg)'
          : 'color-mix(in srgb, var(--color-primary) 10%, transparent)'

        const priorityColor = {
          high: 'var(--priority-high)',
          mid:  'var(--priority-mid)',
          low:  'var(--priority-low)',
        }[task.priority]

        return (
          <li
            key={task.id}
            className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: isToday_
                ? 'color-mix(in srgb, var(--danger) 5%, var(--s-base))'
                : 'var(--s-base)',
              border: isToday_
                ? '1px solid color-mix(in srgb, var(--danger) 18%, transparent)'
                : '1px solid var(--border-subtle)',
            }}
          >
            {/* Priority checkbox */}
            <button
              onClick={() => toggle(task)}
              className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                borderColor:     priorityColor,
                backgroundColor: task.is_done ? priorityColor : 'transparent',
              }}
              aria-label={task.is_done ? 'Marcar pendiente' : 'Marcar hecha'}
            >
              {task.is_done && (
                <span className="material-symbols-outlined text-[10px]"
                  style={{ color: 'var(--s-bg)', fontVariationSettings: "'wght' 700" }}>check</span>
              )}
            </button>

            {/* Time badge — left-aligned, always visible when date set */}
            {timeLabel ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isToday_ && (
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                      style={{ backgroundColor: urgencyColor }} />
                    <span className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: urgencyColor }} />
                  </span>
                )}
                <div
                  className="min-w-[44px] text-center px-2 py-1 rounded-lg"
                  style={{ backgroundColor: urgencyBg }}
                >
                  <span className="mono text-[10px] font-extrabold uppercase block leading-none"
                    style={{ color: urgencyColor }}>
                    {timeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 min-w-[44px]" />
            )}

            {/* Task text + subject */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${task.is_done ? 'line-through opacity-50' : ''}`}
                style={{ color: 'var(--on-surface)' }}>
                {task.text}
              </p>
              {subject && (
                <span className="text-[10px] font-medium mt-0.5 block" style={{ color: subject.color }}>
                  {subject.name}
                </span>
              )}
            </div>

            {/* Priority dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColor }}
              title={task.priority}
            />
          </li>
        )
      })}
    </ul>
  )
}
