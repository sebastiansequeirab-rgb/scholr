import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { daysUntil } from '@/lib/utils'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { getTranslator } from '@/lib/i18n/server'
import { LiveClock } from '@/features/home/components/LiveClock'
import { ClientTime } from '@/features/home/components/ClientTime'
import { TaskFeed } from '@/features/home/components/TaskFeed'
import { ExamFeed } from '@/features/home/components/ExamFeed'

const interp = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

export default async function DashboardPage() {
  const { t, lang } = getTranslator()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: profile },
    { data: tasks },
    { data: exams },
    { data: subjects },
    { data: schedules },
    { data: enrollmentData },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at'),
    // exams + subjects: no user_id filter — RLS includes own rows + enrolled teacher rows
    supabase.from('exams').select('*').order('exam_date'),
    supabase.from('subjects').select('*'),
    supabase.from('schedules').select('*').eq('user_id', user.id),
    supabase.from('enrollments').select('subject_id').eq('student_id', user.id).eq('status', 'active'),
  ])

  // For teacher-assigned exams the grade lives in exam_grades, not on the exam row.
  // Fetch this user's grades and overlay onto exams so downstream code sees the right value.
  const teacherExamIds = (exams ?? []).filter(e => e.assigned_by != null).map(e => e.id as string)
  const teacherGradeMap: Record<string, number | null> = {}
  if (teacherExamIds.length > 0) {
    const { data: grades } = await supabase
      .from('exam_grades')
      .select('exam_id, grade')
      .eq('student_id', user.id)
      .in('exam_id', teacherExamIds)
    for (const g of (grades ?? []) as { exam_id: string; grade: number | null }[]) {
      teacherGradeMap[g.exam_id] = g.grade
    }
  }
  const examsWithGrades = (exams ?? []).map(e => ({
    ...e,
    grade: e.assigned_by != null ? (teacherGradeMap[e.id as string] ?? null) : e.grade,
  }))

  // Fetch announcements for enrolled subjects
  const enrolledSubjectIds = (enrollmentData ?? []).map((e: { subject_id: string }) => e.subject_id)
  const { data: announcementsData } = enrolledSubjectIds.length > 0
    ? await supabase
        .from('announcements')
        .select('id, title, priority, created_at, subjects(name)')
        .in('subject_id', enrolledSubjectIds)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] }

  const announcements = (announcementsData ?? []) as unknown as {
    id: string
    title: string
    priority: 'normal' | 'urgent'
    created_at: string
    subjects: { name: string } | null
  }[]

  const allTasks     = (tasks         || []) as Task[]
  const allExams     = examsWithGrades as Exam[]
  const allSubjects  = (subjects      || []) as Subject[]
  const allSchedules = (schedules     || []) as Schedule[]

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
    if (h < 12) return t('dashboard.morning')
    if (h < 18) return t('dashboard.afternoon')
    return t('dashboard.evening')
  }

  const firstName = profile?.full_name?.split(' ')[0] || t('dashboard.studentFallback')

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
    const time = inClassNow.end_time.slice(0, 5)
    const room = inClassNow.room || sub?.room
    focus = {
      icon:  'school',
      title: sub?.name || t('dashboard.focusInClass'),
      desc:  room
        ? interp(t('dashboard.focusInClassDescRoom'), { time, room })
        : interp(t('dashboard.focusInClassDesc'),     { time }),
      color,
      bg:    `color-mix(in srgb, ${color} 10%, var(--s-low))`,
      live:  true,
    }
  } else if (nextClass) {
    const sub = allSubjects.find(s => s.id === nextClass.subject_id)
    const color = sub?.color || 'var(--color-primary)'
    const time = nextClass.start_time.slice(0, 5)
    const room = nextClass.room || sub?.room
    focus = {
      icon:  'schedule',
      title: interp(t('dashboard.focusNextClass'), { name: sub?.name || '' }),
      desc:  room
        ? interp(t('dashboard.focusNextClassDescRoom'), { time, room })
        : interp(t('dashboard.focusNextClassDesc'),     { time }),
      color,
      bg:    `color-mix(in srgb, ${color} 8%, var(--s-low))`,
    }
  } else if (nextExam && daysUntil(nextExam.exam_date) <= 3) {
    const sub  = allSubjects.find(s => s.id === nextExam.subject_id)
    const days = daysUntil(nextExam.exam_date)
    const actCfg = ACTIVITY_TYPES[(nextExam.activity_type || 'exam') as keyof typeof ACTIVITY_TYPES]
    const tplKey = days === 0 ? 'dashboard.focusExamToday'
                 : days === 1 ? 'dashboard.focusExamTomorrow'
                 :              'dashboard.focusExamInDays'
    focus = {
      icon:  actCfg?.icon || 'event_upcoming',
      title: interp(t(tplKey), { n: days, title: nextExam.title }),
      desc:  sub?.name || (lang === 'es' ? actCfg?.label_es : actCfg?.label_en) || '',
      color: 'var(--danger)',
      bg:    'var(--priority-high-bg)',
    }
  } else if (pendingCount > 0) {
    focus = {
      icon:  'task_alt',
      title: interp(t(pendingCount === 1 ? 'dashboard.focusPending' : 'dashboard.focusPendingPlural'), { n: pendingCount }),
      desc:  t('dashboard.focusPendingDesc'),
      color: 'var(--color-primary)',
      bg:    'color-mix(in srgb, var(--color-primary) 8%, var(--s-low))',
    }
  } else {
    focus = {
      icon:  'done_all',
      title: t('dashboard.focusAllDone'),
      desc:  t('dashboard.focusAllDoneDesc'),
      color: 'var(--success)',
      bg:    'color-mix(in srgb, var(--success) 10%, var(--s-low))',
    }
  }

  const QUICK_ACTIONS = [
    { href: '/planner?create=task', icon: 'add_task',          label: t('dashboard.qaNewTask'),        color: 'var(--color-primary)'  },
    { href: '/planner?create=exam', icon: 'event',             label: t('dashboard.qaNewExam'),        color: 'var(--danger)'         },
    { href: '/notes?new=1',         icon: 'edit_note',         label: t('dashboard.qaQuickNote'),      color: 'var(--warning)'        },
    { href: '/ai?tab=import',       icon: 'document_scanner',  label: t('dashboard.qaImportSchedule'), color: 'var(--success)'        },
    { href: '/ai',                  icon: 'auto_awesome',      label: t('dashboard.qaAskAI'),          color: 'var(--color-tertiary)' },
  ]

  // Motivational messages by hour (for empty "Hoy" widget)
  const motivationalMsg = (() => {
    const h = nowDate.getHours()
    if (h < 7)  return { text: t('dashboard.motivEarly'),     icon: 'nights_stay'     }
    if (h < 12) return { text: t('dashboard.motivMorning'),   icon: 'wb_sunny'        }
    if (h < 15) return { text: t('dashboard.motivAfternoon'), icon: 'local_library'   }
    if (h < 19) return { text: t('dashboard.motivEvening'),   icon: 'self_improvement'}
    return              { text: t('dashboard.motivNight'),    icon: 'bedtime'         }
  })()

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="mb-3 lg:mb-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="mono text-[10px] tracking-[0.18em] uppercase font-medium mb-1"
            style={{ color: 'var(--color-tertiary)' }}>{t('dashboard.brandTag')}</p>

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
                {interp(t(todaySchedules.length === 1 ? 'dashboard.classCount' : 'dashboard.classCountPlural'), { n: todaySchedules.length })}
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
                {interp(t(pendingCount === 1 ? 'dashboard.pendingCount' : 'dashboard.pendingCountPlural'), { n: pendingCount })}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--success)' }}>
                <span className="material-symbols-outlined text-[13px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {t('dashboard.allCaughtUp')}
              </span>
            )}
            {upcomingExams.length > 0 && (() => {
              const d = daysUntil(upcomingExams[0].exam_date)
              const c = d < 3 ? 'var(--danger)' : d < 7 ? 'var(--warning)' : 'var(--color-outline)'
              const label = d === 0 ? t('dashboard.activityToday')
                          : d === 1 ? t('dashboard.activityTomorrow')
                          :           interp(t('dashboard.activityInDays'), { n: d })
              return (
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: c }}>
                  <span className="material-symbols-outlined text-[13px]">event_upcoming</span>
                  {label}
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

      {/* ── Announcements from enrolled courses ───────────────────────────── */}
      {announcements.length > 0 && (
        <div className="mb-3 lg:mb-4 space-y-2">
          {announcements.map((a) => {
            const accent = a.priority === 'urgent' ? 'var(--danger)' : 'var(--color-primary)'
            const bgPct  = a.priority === 'urgent' ? 10 : 8
            const brdPct = a.priority === 'urgent' ? 25 : 20
            return (
              <div key={a.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} ${bgPct}%, var(--s-low))`,
                  border: `1px solid color-mix(in srgb, ${accent} ${brdPct}%, transparent)`,
                }}>
                <span className="material-symbols-outlined text-[18px] flex-shrink-0"
                  style={{ color: accent, fontVariationSettings: "'FILL' 1" }}>
                  campaign
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                    {a.title}
                  </p>
                  {a.subjects && (
                    <p className="text-[10px]" style={{ color: 'var(--on-surface-variant)' }}>
                      {a.subjects.name}
                      {a.priority === 'urgent' && (
                        <span className="ml-2 font-bold uppercase text-[9px]" style={{ color: 'var(--danger)' }}>
                          · {t('dashboard.urgentLabel')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
          {t('dashboard.focusLabel')}
        </span>
      </div>

      {/* ── Today's schedule ──────────────────────────────────────────────── */}
      <div className="mb-3 lg:mb-4 rounded-2xl p-3 lg:p-4"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-bold flex items-center gap-1.5 text-sm" style={{ color: 'var(--on-surface)' }}>
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>today</span>
            {t('dashboard.todayHeader')}
          </h2>
          {todaySchedules.length > 4 && (
            <Link href="/calendar"
              className="mono text-[10px] uppercase tracking-widest transition-opacity hover:opacity-60"
              style={{ color: 'var(--color-primary)' }}>
              {t('dashboard.viewAll')}
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
          style={{ color: 'var(--color-outline)' }}>{t('dashboard.quickAccess')}</p>
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
