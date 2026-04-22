import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { daysUntil } from '@/lib/utils'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { LiveClock } from '@/features/dashboard/components/LiveClock'
import { ClientTime } from '@/features/dashboard/components/ClientTime'
import { TaskFeed } from '@/features/dashboard/components/TaskFeed'
import { ExamFeed } from '@/features/dashboard/components/ExamFeed'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: tasks },
    { data: exams },
    { data: subjects },
    { data: schedules },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at'),
    supabase.from('exams').select('*').eq('user_id', user.id).order('exam_date'),
    supabase.from('subjects').select('*').eq('user_id', user.id),
    supabase.from('schedules').select('*').eq('user_id', user.id),
  ])

  const allTasks     = (tasks     || []) as Task[]
  const allExams     = (exams     || []) as Exam[]
  const allSubjects  = (subjects  || []) as Subject[]
  const allSchedules = (schedules || []) as Schedule[]

  const todayStr      = new Date().toISOString().split('T')[0]
  const upcomingExams = allExams.filter(e => e.exam_date >= todayStr).slice(0, 4)
  const pendingCount  = allTasks.filter(t => !t.is_done).length

  const nowDate        = new Date()
  const todayDow       = nowDate.getDay()
  const currentTimeStr = `${nowDate.getHours().toString().padStart(2, '0')}:${nowDate.getMinutes().toString().padStart(2, '0')}:00`

  const todaySchedules = allSchedules
    .filter(s => s.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const greet = () => {
    const h = nowDate.getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Estudiante'

  const inClassNow = todaySchedules.find(s => currentTimeStr >= s.start_time && currentTimeStr <= s.end_time)
  const nextClass  = todaySchedules.find(s => s.start_time > currentTimeStr)
  const nextExam   = upcomingExams[0]

  type FocusState = {
    icon: string
    title: string
    desc: string
    color: string
    bg: string
    live?: boolean
  }

  let focus: FocusState
  if (inClassNow) {
    const sub = allSubjects.find(s => s.id === inClassNow.subject_id)
    const color = sub?.color || 'var(--color-primary)'
    focus = {
      icon:  'school',
      title: sub?.name || 'Clase en curso',
      desc:  `Termina a las ${inClassNow.end_time.slice(0, 5)}${(inClassNow.room || sub?.room) ? ` · Sala ${inClassNow.room || sub?.room}` : ''}`,
      color,
      bg:    `color-mix(in srgb, ${color} 10%, var(--s-low))`,
      live:  true,
    }
  } else if (nextClass) {
    const sub = allSubjects.find(s => s.id === nextClass.subject_id)
    const color = sub?.color || 'var(--color-primary)'
    focus = {
      icon:  'schedule',
      title: `Próxima: ${sub?.name || 'Clase'}`,
      desc:  `A las ${nextClass.start_time.slice(0, 5)}${(nextClass.room || sub?.room) ? ` · Sala ${nextClass.room || sub?.room}` : ''}`,
      color,
      bg:    `color-mix(in srgb, ${color} 8%, var(--s-low))`,
    }
  } else if (nextExam && daysUntil(nextExam.exam_date) <= 3) {
    const sub  = allSubjects.find(s => s.id === nextExam.subject_id)
    const days = daysUntil(nextExam.exam_date)
    const actCfg = ACTIVITY_TYPES[(nextExam.activity_type || 'exam') as keyof typeof ACTIVITY_TYPES]
    focus = {
      icon:  actCfg?.icon || 'event_upcoming',
      title: `${days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`}: ${nextExam.title}`,
      desc:  sub?.name || actCfg?.label_es || '',
      color: 'var(--danger)',
      bg:    'var(--priority-high-bg)',
    }
  } else if (pendingCount > 0) {
    focus = {
      icon:  'task_alt',
      title: `${pendingCount} tarea${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`,
      desc:  'Mantén el enfoque, vas bien',
      color: 'var(--color-primary)',
      bg:    'color-mix(in srgb, var(--color-primary) 8%, var(--s-low))',
    }
  } else {
    focus = {
      icon:  'done_all',
      title: 'Todo al día',
      desc:  'Sin tareas pendientes ni clases en curso',
      color: 'var(--success)',
      bg:    'color-mix(in srgb, var(--success) 10%, var(--s-low))',
    }
  }

  const QUICK_ACTIONS = [
    { href: '/planner?create=task', icon: 'add_task',          label: 'Nueva tarea',     color: 'var(--color-primary)'  },
    { href: '/planner?create=exam', icon: 'event',             label: 'Nuevo examen',    color: '#ef4444'               },
    { href: '/notes?new=1',          icon: 'edit_note',         label: 'Nota rápida',     color: 'var(--warning)'        },
    { href: '/ai?tab=import',       icon: 'document_scanner',  label: 'Registrar horario con IA', color: '#10b981'      },
    { href: '/ai',                  icon: 'auto_awesome',      label: 'Preguntar a IA',  color: '#c084fc'               },
  ]

  // Motivational messages by hour (for empty "Hoy" widget)
  const motivationalMsg = (() => {
    const h = nowDate.getHours()
    if (h < 7)  return { text: 'Madrugador. Hoy va a ser un buen día.',   icon: 'nights_stay'     }
    if (h < 12) return { text: 'Empieza con enfoque. Tienes el día libre.', icon: 'wb_sunny'       }
    if (h < 15) return { text: 'Sin clases. Aprovecha para estudiar.',      icon: 'local_library'  }
    if (h < 19) return { text: 'Tarde libre. Perfecto para avanzar.',       icon: 'self_improvement'}
    return              { text: 'Noche tranquila. Descansa o repasa.',       icon: 'bedtime'        }
  })()

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="mb-3 lg:mb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="mono text-[10px] tracking-[0.18em] uppercase font-medium mb-1"
            style={{ color: 'var(--color-tertiary)' }}>Skolar Sanctuary</p>

          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight"
            style={{ color: 'var(--on-surface)' }}>
            {greet()}, <span style={{ color: 'var(--color-primary)' }}>{firstName}</span>.
          </h1>

          {/* Context strip */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {todaySchedules.length > 0 && (
              <span className="flex items-center gap-1.5 text-[11px]"
                style={{ color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined text-[13px]"
                  style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>today</span>
                {todaySchedules.length} clase{todaySchedules.length !== 1 ? 's' : ''} hoy
              </span>
            )}
            {pendingCount > 0 ? (
              <span className="flex items-center gap-1.5 text-[11px]"
                style={{ color: 'var(--on-surface-variant)' }}>
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                    style={{ backgroundColor: 'var(--danger)' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{ backgroundColor: 'var(--danger)' }} />
                </span>
                {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--success)' }}>
                <span className="material-symbols-outlined text-[13px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Al día
              </span>
            )}
            {upcomingExams.length > 0 && (() => {
              const d = daysUntil(upcomingExams[0].exam_date)
              const c = d < 3 ? 'var(--danger)' : d < 7 ? 'var(--warning)' : 'var(--color-outline)'
              return (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: c }}>
                  <span className="material-symbols-outlined text-[13px]">event_upcoming</span>
                  {d === 0 ? 'Actividad hoy' : d === 1 ? 'Actividad mañana' : `Actividad en ${d}d`}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Clock — desktop only */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <LiveClock />
        </div>
      </header>

      {/* ── Tu foco ahora ─────────────────────────────────────────────────── */}
      <div className="mb-3 lg:mb-4 rounded-2xl px-4 py-3 lg:py-4 flex items-center gap-3"
        style={{
          backgroundColor: focus.bg,
          border: `1px solid color-mix(in srgb, ${focus.color} 20%, transparent)`,
        }}>
        <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${focus.color} 16%, transparent)` }}>
          <span className="material-symbols-outlined text-[18px] lg:text-[20px]"
            style={{ color: focus.color, fontVariationSettings: "'FILL' 1" }}>
            {focus.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {focus.live && (
              <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70"
                  style={{ backgroundColor: focus.color }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ backgroundColor: focus.color }} />
              </span>
            )}
            <p className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--on-surface)' }}>
              {focus.title}
            </p>
          </div>
          {focus.desc && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-outline)' }}>
              {focus.desc}
            </p>
          )}
        </div>
        <span className="mono text-[9px] uppercase tracking-[0.15em] font-bold flex-shrink-0 hidden sm:block"
          style={{ color: focus.color }}>
          Tu foco ahora
        </span>
      </div>

      {/* ── Today's schedule ──────────────────────────────────────────────── */}
      <div className="mb-3 lg:mb-4 rounded-2xl p-3 lg:p-4"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold flex items-center gap-1.5 text-sm" style={{ color: 'var(--on-surface)' }}>
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>today</span>
            Hoy
          </h2>
          {todaySchedules.length > 4 && (
            <Link href="/calendar"
              className="mono text-[10px] uppercase tracking-widest transition-opacity hover:opacity-60"
              style={{ color: 'var(--color-primary)' }}>
              Ver todo
            </Link>
          )}
        </div>

        {todaySchedules.length === 0 ? (
          <div className="py-1 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                {motivationalMsg.icon}
              </span>
            </div>
            <p className="text-[11px] italic leading-snug" style={{ color: 'var(--on-surface-variant)' }}>
              {motivationalMsg.text}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {todaySchedules.map(s => {
              const subject = allSubjects.find(sub => sub.id === s.subject_id)
              if (!subject) return null
              const isNow  = currentTimeStr >= s.start_time && currentTimeStr <= s.end_time
              const isDone = currentTimeStr > s.end_time
              return (
                <div key={s.id}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                  style={{
                    backgroundColor: isNow
                      ? `color-mix(in srgb, ${subject.color} 10%, var(--s-base))`
                      : 'var(--s-base)',
                    border: isNow
                      ? `1px solid color-mix(in srgb, ${subject.color} 25%, transparent)`
                      : '1px solid var(--border-subtle)',
                    opacity: isDone ? 0.45 : 1,
                  }}>
                  <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                      {subject.name}
                    </p>
                    <p className="mono text-[10px]" style={{ color: 'var(--color-outline)' }}>
                      <ClientTime time24={s.start_time.slice(0, 5)} />–<ClientTime time24={s.end_time.slice(0, 5)} />
                      {(s.room || subject.room) ? ` · ${s.room || subject.room}` : ''}
                    </p>
                  </div>
                  {isNow && (
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: subject.color }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                        style={{ backgroundColor: subject.color }} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Animated feeds ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <TaskFeed tasks={allTasks} subjects={allSubjects} />
        <ExamFeed exams={allExams} subjects={allSubjects} />
      </div>

      {/* ── Quick Access ─────────────────────────────────────────────────── */}
      <div className="mt-3 lg:mt-4">
        <p className="mono text-[9px] uppercase tracking-[0.18em] mb-2 font-medium"
          style={{ color: 'var(--color-outline)' }}>Acciones rápidas</p>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACTIONS.map(({ href, icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all duration-200 hover:scale-[1.04] active:scale-[0.97]"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 9%, var(--s-low))`,
                border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
              >
                <span className="material-symbols-outlined text-[19px]"
                  style={{ color, fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-center leading-tight"
                style={{ color }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
