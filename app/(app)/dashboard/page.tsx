import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { daysUntil, isToday } from '@/lib/utils'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { UrgentTasksSection } from '@/components/ui/UrgentTasksSection'
import { LiveClock } from '@/components/ui/LiveClock'

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

  // Today's progress
  const todayTasks    = allTasks.filter(t => t.due_date && isToday(t.due_date))
  const todayDone     = todayTasks.filter(t => t.is_done).length
  const todayProgress = todayTasks.length > 0 ? Math.round((todayDone / todayTasks.length) * 100) : 0

  // Upcoming exams (max 4)
  const todayStr      = new Date().toISOString().split('T')[0]
  const upcomingExams = allExams.filter(e => e.exam_date >= todayStr).slice(0, 4)

  // All pending tasks — UrgentTasksSection handles urgency sorting + slicing
  const pendingTasks = allTasks.filter(t => !t.is_done)

  const pendingCount = allTasks.filter(t => !t.is_done).length

  // Today's classes + AHORA indicator
  const todayDow = new Date().getDay()
  const nowDate  = new Date()
  const currentTimeStr = `${nowDate.getHours().toString().padStart(2, '0')}:${nowDate.getMinutes().toString().padStart(2, '0')}:00`

  const todaySchedules = allSchedules
    .filter(s => s.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 4)

  const greet = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const QUICK_LINKS = [
    { href: '/calendar', icon: 'calendar_month', label: 'Calendario', color: 'var(--color-primary)'  },
    { href: '/subjects', icon: 'menu_book',       label: 'Materias',   color: 'var(--color-tertiary)' },
    { href: '/tasks',    icon: 'check_circle',    label: 'Tareas',     color: 'var(--success)'        },
    { href: '/notes',    icon: 'sticky_note_2',   label: 'Notas',      color: 'var(--warning)'        },
    { href: '/exams',    icon: 'event_upcoming',  label: 'Exámenes',   color: 'var(--danger)'         },
  ]

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">

      {/* ── Hero Header ── */}
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1">
          <span className="mono text-[10px] tracking-[0.2em] uppercase font-medium block mb-3"
            style={{ color: 'var(--color-tertiary)' }}>Scholar Sanctuary</span>

          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.15]"
            style={{ color: 'var(--on-surface)' }}>
            {greet()},<br />
            <span style={{ color: 'var(--color-primary)' }}>
              {profile?.full_name?.split(' ')[0] || 'Estudiante'}
            </span>.
          </h1>

          {/* Context strip */}
          <div className="mt-4 flex items-center gap-5 flex-wrap">
            {todaySchedules.length > 0 && (
              <span className="flex items-center gap-1.5 text-[12px]"
                style={{ color: 'var(--on-surface-variant)' }}>
                <span className="material-symbols-outlined text-[14px]"
                  style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>today</span>
                {todaySchedules.length} clase{todaySchedules.length !== 1 ? 's' : ''} hoy
              </span>
            )}
            {pendingCount > 0 ? (
              <span className="flex items-center gap-1.5 text-[12px]"
                style={{ color: 'var(--on-surface-variant)' }}>
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                    style={{ backgroundColor: 'var(--danger)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: 'var(--danger)' }} />
                </span>
                {pendingCount} tarea{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--success)' }}>
                <span className="material-symbols-outlined text-[14px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Todo al día
              </span>
            )}
            {upcomingExams.length > 0 && (() => {
              const d = daysUntil(upcomingExams[0].exam_date)
              const c = d < 3 ? 'var(--danger)' : d < 7 ? 'var(--warning)' : 'var(--color-outline)'
              return (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: c }}>
                  <span className="material-symbols-outlined text-[14px]">event_upcoming</span>
                  {d === 0 ? 'Examen hoy' : d === 1 ? 'Examen mañana' : `Examen en ${d}d`}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Live Clock */}
        <div className="w-full md:w-56 flex-shrink-0">
          <LiveClock />
        </div>
      </header>

      {/* ── Quick Links Dock ── */}
      <div className="mb-5 rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex">
          {QUICK_LINKS.map(({ href, icon, label, color }, i) => (
            <Link
              key={href}
              href={href}
              className="group relative flex-1 flex flex-col items-center gap-2.5 py-4 px-3 transition-all duration-200"
              style={{ borderRight: i < QUICK_LINKS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
            >
              {/* Per-item accent hover fill */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }} />

              <div className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color }}>
                  {icon}
                </span>
              </div>
              <span className="relative text-[11px] font-semibold transition-colors duration-200 group-hover:text-[var(--on-surface)]"
                style={{ color: 'var(--color-outline)' }}>
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* Left column — urgent tasks */}
        <div className="md:col-span-8">
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>

            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--on-surface)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--danger)' }}>
                  priority_high
                </span>
                Tareas urgentes
              </h2>
              <div className="flex items-center gap-3">
                {todayTasks.length > 0 && (
                  <span className="mono text-[10px]" style={{ color: 'var(--color-outline)' }}>
                    {todayDone}/{todayTasks.length} hoy
                  </span>
                )}
                <Link href="/tasks"
                  className="mono text-[10px] uppercase tracking-widest transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-primary)' }}>
                  Ver todas →
                </Link>
              </div>
            </div>

            {/* Integrated progress bar — only when tasks exist today */}
            {todayTasks.length > 0 && (
              <div className="h-px rounded-full mb-5 overflow-hidden" style={{ backgroundColor: 'var(--s-highest)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${todayProgress}%`,
                    background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-container))',
                  }} />
              </div>
            )}

            <UrgentTasksSection initialTasks={pendingTasks} subjects={allSubjects} />
          </div>
        </div>

        {/* Right column */}
        <aside className="md:col-span-4 space-y-5">

          {/* Today's classes */}
          {todaySchedules.length > 0 && (
            <div className="rounded-2xl p-5"
              style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
              <h2 className="font-bold flex items-center gap-2 mb-4" style={{ color: 'var(--on-surface)' }}>
                <span className="material-symbols-outlined text-xl"
                  style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>today</span>
                Hoy
              </h2>
              <div className="space-y-2">
                {todaySchedules.map(s => {
                  const subject = allSubjects.find(sub => sub.id === s.subject_id)
                  if (!subject) return null
                  const isNow = currentTimeStr >= s.start_time && currentTimeStr <= s.end_time
                  return (
                    <div key={s.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                      style={{
                        backgroundColor: isNow
                          ? `color-mix(in srgb, ${subject.color} 8%, var(--s-base))`
                          : 'var(--s-base)',
                        border: isNow
                          ? `1px solid color-mix(in srgb, ${subject.color} 22%, transparent)`
                          : '1px solid transparent',
                      }}>
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: subject.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                            {subject.name}
                          </p>
                          {isNow && (
                            <span className="flex items-center gap-1 mono text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase flex-shrink-0"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${subject.color} 15%, transparent)`,
                                color: subject.color,
                              }}>
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                  style={{ backgroundColor: subject.color }} />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                                  style={{ backgroundColor: subject.color }} />
                              </span>
                              Ahora
                            </span>
                          )}
                        </div>
                        <p className="mono text-[10px]" style={{ color: 'var(--color-outline)' }}>
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          {(s.room || subject.room) && ` · ${s.room || subject.room}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming exams */}
          <div className="rounded-2xl p-6"
            style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--on-surface)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--color-primary)' }}>
                  event_upcoming
                </span>
                Próximos exámenes
              </h2>
              <Link href="/exams"
                className="mono text-[10px] uppercase tracking-widest transition-colors hover:opacity-80"
                style={{ color: 'var(--color-primary)' }}>
                Ver todos →
              </Link>
            </div>

            {upcomingExams.length === 0 ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined text-3xl mb-2 block"
                  style={{ color: 'var(--color-outline)' }}>event_available</span>
                <p className="text-sm" style={{ color: 'var(--color-outline)' }}>Sin exámenes próximos ✓</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingExams.map(exam => {
                  const subject = allSubjects.find(s => s.id === exam.subject_id)
                  const days    = daysUntil(exam.exam_date)
                  const urgency = days < 3 ? 'var(--danger)' : days < 7 ? 'var(--warning)' : 'var(--color-primary)'
                  return (
                    <div key={exam.id}
                      className="flex items-center gap-3 p-3 rounded-xl transition-all hover:brightness-110"
                      style={{ backgroundColor: days < 3 ? 'var(--priority-high-bg)' : 'var(--s-base)' }}>
                      <div className="w-11 h-11 flex flex-col items-center justify-center rounded-xl flex-shrink-0"
                        style={{ backgroundColor: `color-mix(in srgb, ${urgency} 12%, transparent)` }}>
                        <span className="mono text-[8px] uppercase leading-none" style={{ color: urgency }}>
                          {new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                        </span>
                        <span className="text-lg font-black leading-tight" style={{ color: urgency }}>
                          {new Date(exam.exam_date + 'T00:00:00').getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--on-surface)' }}>
                          {exam.title}
                        </p>
                        {subject && (
                          <span className="text-xs" style={{ color: subject.color }}>{subject.name}</span>
                        )}
                      </div>
                      <span className="mono text-[10px] font-bold flex-shrink-0" style={{ color: urgency }}>
                        {days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `${days}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
