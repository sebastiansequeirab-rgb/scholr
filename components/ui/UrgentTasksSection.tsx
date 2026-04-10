'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isToday, isTomorrow } from '@/lib/utils'
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
    // Optimistic update
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, is_done: !t.is_done } : t)
    )
    const supabase = createClient()
    await supabase.from('tasks').update({
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

  const visible = tasks.filter(
    t => t.due_date && (isToday(t.due_date) || isTomorrow(t.due_date))
  )

  if (visible.length === 0) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-3xl mb-2 block" style={{ color: 'var(--color-outline)' }}>
          done_all
        </span>
        <p className="text-sm" style={{ color: 'var(--color-outline)' }}>Sin tareas urgentes ✓</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {visible.map(task => {
        const subject       = subjects.find(s => s.id === task.subject_id)
        const priorityColor = { high: 'var(--priority-high)', mid: 'var(--priority-mid)', low: 'var(--priority-low)' }[task.priority]
        const due           = isToday(task.due_date!) ? 'Hoy' : 'Mañana'

        return (
          <li key={task.id} className={`flex items-start gap-4 transition-opacity duration-300 ${task.is_done ? 'opacity-40' : ''}`}>
            {/* Checkbox */}
            <button
              onClick={() => toggle(task)}
              className="mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                borderColor:     priorityColor,
                backgroundColor: task.is_done ? priorityColor : 'transparent',
              }}
              aria-label={task.is_done ? 'Marcar pendiente' : 'Marcar hecha'}
            >
              {task.is_done && (
                <span className="material-symbols-outlined text-[11px]"
                  style={{ color: 'var(--s-bg)', fontVariationSettings: "'wght' 700" }}>
                  check
                </span>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${task.is_done ? 'line-through' : ''}`}
                style={{ color: task.is_done ? 'var(--color-outline)' : 'var(--on-surface)' }}>
                {task.text}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                  style={{
                    backgroundColor: task.priority === 'high' ? 'var(--priority-high-bg)' : task.priority === 'mid' ? 'var(--priority-mid-bg)' : 'var(--priority-low-bg)',
                    color: task.priority === 'high' ? 'var(--priority-high)' : task.priority === 'mid' ? 'var(--priority-mid)' : 'var(--priority-low)',
                  }}>
                  {due}
                </span>
                {subject && (
                  <span className="text-[11px] font-medium" style={{ color: subject.color }}>
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
