'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isToday, isTomorrow, daysUntil } from '@/lib/utils'
import type { Task, Subject } from '@/types'
import { useTranslation } from '@/hooks/useTranslation'

export function UrgentTasksSection({
  initialTasks,
  subjects,
}: {
  initialTasks: Task[]
  subjects: Subject[]
}) {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const router = useRouter()

  const toggle = async (task: Task) => {
    const nextDone = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: nextDone } : t))
    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({
      is_done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null,
    }).eq('id', task.id)
    // Rollback on failure so the UI matches reality
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: task.is_done } : t))
    }
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
          {t('feeds.noTasksDone')}
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-1">
      {visible.map(task => {
        const subject = subjects.find(s => s.id === task.subject_id)

        const isToday_    = task.due_date && isToday(task.due_date)
        const isTomorrow_ = task.due_date && isTomorrow(task.due_date)
        const days        = task.due_date ? daysUntil(task.due_date) : null

        const timeLabel = !task.due_date
          ? null
          : isToday_    ? t('feeds.today')
          : isTomorrow_ ? t('feeds.tomorrow')
          : `${days}d`

        const urgencyColor = !task.due_date
          ? 'var(--color-outline)'
          : isToday_         ? 'var(--danger)'
          : isTomorrow_      ? 'var(--warning)'
          : (days ?? 99) <= 7 ? 'var(--warning)'
          : 'var(--color-primary)'

        const priorityColor = {
          high: 'var(--priority-high)',
          mid:  'var(--priority-mid)',
          low:  'var(--priority-low)',
        }[task.priority]

        const accent = subject?.color ?? urgencyColor

        return (
          <li
            key={task.id}
            onClick={() => router.push('/tasks')}
            className="row cursor-pointer active:scale-[0.99] transition-transform"
            style={{
              ['--accent-color' as string]: accent,
              background: isToday_
                ? 'color-mix(in srgb, var(--danger) 6%, transparent)'
                : undefined,
            }}
          >
            <div className="row__time flex items-center justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); toggle(task) }}
                className="rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 hover:scale-110"
                style={{
                  width: '18px',
                  height: '18px',
                  borderColor:     priorityColor,
                  backgroundColor: task.is_done ? priorityColor : 'transparent',
                }}
                aria-label={task.is_done ? t('feeds.markPending') : t('feeds.markDone')}
              >
                {task.is_done && (
                  <span className="material-symbols-outlined text-[10px]"
                    style={{ color: 'var(--s-bg)', fontVariationSettings: "'wght' 700" }}>check</span>
                )}
              </button>
            </div>

            <div className="row__main">
              <div className={`row__title truncate ${task.is_done ? 'line-through opacity-40' : ''}`}>
                {task.text}
              </div>
              <div className="row__meta">
                {subject && (
                  <span className="font-semibold" style={{ color: subject.color }}>
                    {subject.name}
                  </span>
                )}
                {task.status === 'in_progress' && (
                  <>
                    {subject && <span style={{ color: 'var(--color-outline)' }}>·</span>}
                    <span className="badge badge--ai" style={{ padding: '1px 6px' }}>
                      {t('feeds.inProgress')}
                    </span>
                  </>
                )}
              </div>
            </div>

            {timeLabel ? (
              <div className="row__right flex items-center gap-1.5">
                {isToday_ && <span className="live-dot" style={{ background: urgencyColor }} />}
                <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: urgencyColor }}>
                  {timeLabel}
                </span>
              </div>
            ) : (
              <div className="row__right" />
            )}
          </li>
        )
      })}
    </ul>
  )
}
