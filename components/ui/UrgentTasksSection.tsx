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

  // Sort all pending tasks by urgency: today > tomorrow > days remaining > priority
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
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-3xl mb-2 block" style={{ color: 'var(--color-outline)' }}>
          done_all
        </span>
        <p className="text-sm" style={{ color: 'var(--color-outline)' }}>Sin tareas pendientes ✓</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {visible.map(task => {
        const subject       = subjects.find(s => s.id === task.subject_id)
        const priorityColor = { high: 'var(--priority-high)', mid: 'var(--priority-mid)', low: 'var(--priority-low)' }[task.priority]
        const priorityBg    = { high: 'var(--priority-high-bg)', mid: 'var(--priority-mid-bg)', low: 'var(--priority-low-bg)' }[task.priority]

        const dueLabel = !task.due_date
          ? null
          : isToday(task.due_date) ? 'Hoy'
          : isTomorrow(task.due_date) ? 'Mañana'
          : `${daysUntil(task.due_date)}d`

        return (
          <li key={task.id} className={`flex items-start gap-3 transition-opacity duration-300 ${task.is_done ? 'opacity-40' : ''}`}>
            <button
              onClick={() => toggle(task)}
              className="mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{ borderColor: priorityColor, backgroundColor: task.is_done ? priorityColor : 'transparent' }}
              aria-label={task.is_done ? 'Marcar pendiente' : 'Marcar hecha'}
            >
              {task.is_done && (
                <span className="material-symbols-outlined text-[11px]"
                  style={{ color: 'var(--s-bg)', fontVariationSettings: "'wght' 700" }}>check</span>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${task.is_done ? 'line-through' : ''}`}
                style={{ color: task.is_done ? 'var(--color-outline)' : 'var(--on-surface)' }}>
                {task.text}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {dueLabel && (
                  <span className="mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                    style={{ backgroundColor: priorityBg, color: priorityColor }}>
                    {dueLabel}
                  </span>
                )}
                {subject && (
                  <span className="text-[10px] font-medium" style={{ color: subject.color }}>
                    {subject.name}
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
