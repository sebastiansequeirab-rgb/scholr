'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { createClient } from '@/lib/supabase/client'
import { SideDrawer } from '@/components/ui/SideDrawer'
import type { Subject, Task } from '@/types'

function priorityLabel(prio: 'high' | 'mid' | 'low', language: 'es' | 'en'): string {
  if (prio === 'high') return language === 'es' ? 'ALTA' : 'HIGH'
  if (prio === 'mid') return language === 'es' ? 'MEDIA' : 'MED'
  return language === 'es' ? 'BAJA' : 'LOW'
}

export function TasksList({
  tasks,
  subjects,
  todayStr,
}: {
  tasks: Task[]
  subjects: Subject[]
  todayStr: string
}) {
  const { t, language } = useTranslation()
  const lang = language === 'es' ? 'es' : 'en'
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = useMemo(() => tasks.find(tk => tk.id === openId) ?? null, [openId, tasks])
  const activeSubject = active ? subjects.find(s => s.id === active.subject_id) ?? null : null

  const toggleDone = (task: Task) => {
    const isDone = !task.is_done
    const patch = {
      is_done: isDone,
      status: isDone ? 'done' : 'not_started',
      done_at: isDone ? new Date().toISOString() : null,
    }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('tasks').update(patch).eq('id', task.id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(isDone ? (lang === 'es' ? 'Tarea completada' : 'Task done') : (lang === 'es' ? 'Tarea reabierta' : 'Task reopened'))
      setOpenId(null)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex flex-col">
        {tasks.map(task => {
          const sub = subjects.find(s => s.id === task.subject_id)
          const accent = sub?.color || 'var(--color-primary)'
          const subjCode = sub ? sub.name.slice(0, 4).toUpperCase() : '—'
          const due = task.due_date ? new Date(task.due_date) : null
          const days = due
            ? Math.round((due.getTime() - new Date(todayStr).getTime()) / 86400000)
            : null
          const dueLabel =
            days == null
              ? ''
              : days === 0
                ? lang === 'es' ? 'Hoy' : 'Today'
                : days === 1
                  ? lang === 'es' ? 'Mañana' : 'Tmrw'
                  : days < 0
                    ? lang === 'es' ? `Hace ${Math.abs(days)}d` : `${Math.abs(days)}d ago`
                    : `${days}d`
          const dueTime = due
            ? `${due.getHours().toString().padStart(2, '0')}:${due.getMinutes().toString().padStart(2, '0')}`
            : ''
          const prio = task.priority || 'low'

          return (
            <button
              type="button"
              key={task.id}
              className="task-row"
              style={{
                ['--accent-color' as never]: accent,
                ['--accent-bg-strong' as never]: `color-mix(in srgb, ${accent} 22%, transparent)`,
              }}
              onClick={() => setOpenId(task.id)}
              aria-label={task.text}
            >
              <div className="task-row__bar" />
              <div className="task-row__body">
                <div className="task-row__head">
                  {sub && <span className="task-row__chip">{subjCode}</span>}
                  <span className="task-row__title truncate">{task.text}</span>
                </div>
                {(dueLabel || dueTime) && (
                  <span className="task-row__when">
                    <span className="material-symbols-outlined">schedule</span>
                    {dueLabel}
                    {dueLabel && dueTime ? ` · ${dueTime}` : dueTime}
                  </span>
                )}
              </div>
              <span className={`task-row__prio task-row__prio--${prio}`}>
                {priorityLabel(prio, lang)}
              </span>
            </button>
          )
        })}
      </div>

      <SideDrawer
        open={active !== null}
        onClose={() => setOpenId(null)}
        kicker={activeSubject ? activeSubject.name.slice(0, 6).toUpperCase() : t('homeDrawer.taskKicker')}
        title={active?.text ?? ''}
      >
        {active && (() => {
          const due = active.due_date ? new Date(active.due_date) : null
          const dueFull = due
            ? due.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: due.getHours() || due.getMinutes() ? '2-digit' : undefined,
                minute: due.getHours() || due.getMinutes() ? '2-digit' : undefined,
              })
            : '—'
          const prio = active.priority || 'low'

          return (
            <>
              <div className="home-drawer__meta">
                <dt>{t('homeDrawer.priority')}</dt>
                <dd>
                  <span className={`home-drawer__badge home-drawer__badge--${prio === 'high' ? 'urgent' : 'normal'}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>flag</span>
                    {priorityLabel(prio, lang)}
                  </span>
                </dd>
                <dt>{t('homeDrawer.due')}</dt>
                <dd>{dueFull}</dd>
                {activeSubject && (
                  <>
                    <dt>{language === 'es' ? 'Materia' : 'Subject'}</dt>
                    <dd>{activeSubject.name}</dd>
                  </>
                )}
                <dt>{t('homeDrawer.status')}</dt>
                <dd>
                  <span className={`home-drawer__badge home-drawer__badge--${active.is_done ? 'done' : 'normal'}`}>
                    {active.is_done ? t('homeDrawer.completed') : t('homeDrawer.upcoming')}
                  </span>
                </dd>
              </div>

              {active.notes && (
                <div className="home-drawer__body-text">
                  <p>{active.notes}</p>
                </div>
              )}

              <div className="home-drawer__actions">
                <button
                  type="button"
                  className="home-drawer__btn home-drawer__btn--primary"
                  onClick={() => toggleDone(active)}
                  disabled={pending}
                >
                  <span className="material-symbols-outlined">
                    {active.is_done ? 'undo' : 'check'}
                  </span>
                  {active.is_done ? t('homeDrawer.reopen') : t('homeDrawer.markDone')}
                </button>
                <Link href="/tareas" className="home-drawer__btn">
                  <span className="material-symbols-outlined">arrow_outward</span>
                  {t('homeDrawer.viewInTasks')}
                </Link>
              </div>
            </>
          )
        })()}
      </SideDrawer>
    </>
  )
}
