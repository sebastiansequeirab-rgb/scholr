'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const toggle = async (task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t))
    const supabase = createClient()
    await supabase.from('tasks').update({
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

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
      <div className="text-center py-7">
        <span className="material-symbols-outlined text-2xl mb-2 block"
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
    <ul className="space-y-2">
      {visible.map(task => {
        const subject = subjects.find(s => s.id === task.subject_id)

        const isToday_    = task.due_date && isToday(task.due_date)
        const isTomorrow_ = task.due_date && isTomorrow(task.due_date)
        const days        = task.due_date ? daysUntil(task.due_date) : null

        const timeLabel = !task.due_date
          ? null
          : isToday_    ? 'Hoy'
          : isTomorrow_ ? 'Mañana'
          : `${days}d`

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
            onClick={() => router.push('/tasks')}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
            style={{
              backgroundColor: isToday_
                ? 'color-mix(in srgb, var(--danger) 5%, var(--s-base))'
                : 'var(--s-base)',
              border: isToday_
                ? '1px solid color-mix(in srgb, var(--danger) 16%, transparent)'
                : '1px solid var(--border-subtle)',
            }}
          >
            {/* Priority checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(task) }}
              className="w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                width: '18px',
                height: '18px',
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

            {/* Subject color bar */}
            {subject && (
              <div className="w-0.5 h-6 rounded-full flex-shrink-0"
                style={{ backgroundColor: subject.color }} />
            )}

            {/* Task text + subject + status */}
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold truncate leading-tight ${task.is_done ? 'line-through opacity-40' : ''}`}
                style={{ color: 'var(--on-surface)' }}>
                {task.text}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {subject && (
                  <span className="text-[10px] font-medium" style={{ color: subject.color }}>
                    {subject.name}
                  </span>
                )}
                {task.status === 'in_progress' && (
                  <span className="mono text-[9px] px-1 py-0.5 rounded-full leading-none"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 12%, transparent)',
                      color: 'var(--color-tertiary)',
                    }}>
                    En progreso
                  </span>
                )}
              </div>
            </div>

            {/* Time badge */}
            {timeLabel ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                {isToday_ && (
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                      style={{ backgroundColor: urgencyColor }} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ backgroundColor: urgencyColor }} />
                  </span>
                )}
                <div className="min-w-[36px] text-center px-1.5 py-0.5 rounded-lg"
                  style={{ backgroundColor: urgencyBg }}>
                  <span className="mono text-[9px] font-extrabold uppercase block leading-none"
                    style={{ color: urgencyColor }}>
                    {timeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 w-9" />
            )}
          </li>
        )
      })}
    </ul>
  )
}
