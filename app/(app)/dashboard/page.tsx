import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { daysUntil } from '@/lib/utils'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { getTranslator } from '@/lib/i18n/server'
import { LiveClock } from '@/features/home/components/LiveClock'
import { ClientTime } from '@/features/home/components/ClientTime'
import { TaskFeed } from '@/features/home/components/TaskFeed'
import { ExamFeed } from '@/features/home/components/ExamFeed'

export default async function DashboardPage() {
  const { t } = getTranslator()
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
    supabase.from('exams').select('*').order('exam_date'),
    supabase.from('subjects').select('*'),
    supabase.from('schedules').select('*').eq('user_id', user.id),
    supabase.from('enrollments').select('subject_id').eq('student_id', user.id).eq('status', 'active'),
  ])

  // Overlay teacher-assigned grades from exam_grades
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

  // Announcements for enrolled subjects
  const enrolledSubjectIds = (enrollmentData ?? []).map((e: { subject_id: string }) => e.subject_id)
  const { data: announcementsData } = enrolledSubjectIds.length > 0
    ? await supabase
        .from('announcements')
        .select('id, title, priority, created_at, subjects(name)')
        .in('subject_id', enrolledSubjectIds)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const announcements = (announcementsData ?? []) as unknown as {
    id: string
    title: string
    priority: 'normal' | 'urgent'
    created_at: string
    subjects: { name: string } | null
  }[]

  const allTasks    = (tasks     || []) as Task[]
  const allExams    = examsWithGrades as Exam[]
  const allSubjects = (subjects  || []) as Subject[]
  const allSchedules= (schedules || []) as Schedule[]

  const todayStr      = new Date().toISOString().split('T')[0]
  const upcomingExams = allExams.filter(e => e.exam_date >= todayStr).slice(0, 4)
  const completedCount= allTasks.filter(t => t.is_done).length

  // Tasks due in next 24h
  const urgentTasks = allTasks.filter(task => {
    if (task.is_done || !task.due_date) return false
    const d = Math.round((new Date(task.due_date).getTime() - new Date(todayStr).getTime()) / 86400000)
    return d <= 1
  })

  // Tasks this week
  const weekTasks = allTasks.filter(task => {
    if (task.is_done || !task.due_date) return false
    const d = Math.round((new Date(task.due_date).getTime() - new Date(todayStr).getTime()) / 86400000)
    return d >= 0 && d <= 7
  }).length

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

  const nextExam = upcomingExams[0]

  // Urgent banner: only show if there's a real urgency
  const urgentBanner = (() => {
    if (urgentTasks.length > 0) {
      const top = urgentTasks[0]
      const sub = allSubjects.find(s => s.id === top.subject_id)
      const days = top.due_date ? Math.round((new Date(top.due_date).getTime() - new Date(todayStr).getTime()) / 86400000) : 99
      return {
        kind: 'task' as const,
        title: top.text,
        meta:  sub ? sub.name : '',
        daysLabel: days <= 0 ? t('feeds.today') : t('feeds.tmrwShort'),
        href: '/planner',
      }
    }
    if (nextExam && daysUntil(nextExam.exam_date) <= 2) {
      const sub = allSubjects.find(s => s.id === nextExam.subject_id)
      const days = daysUntil(nextExam.exam_date)
      return {
        kind: 'exam' as const,
        title: nextExam.title,
        meta:  sub ? sub.name : '',
        daysLabel: days === 0 ? t('feeds.today') : days === 1 ? t('feeds.tmrwShort') : `${days}d`,
        href: '/planner',
      }
    }
    return null
  })()

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">

      {/* ─────────── GREETING HERO ─────────── */}
      <section
        className="card mb-3"
        style={{ background: 'var(--s-low)', padding: '20px' }}
      >
        <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-start">
          {/* LEFT: greeting + stats */}
          <div className="min-w-0">
            {/* Status row */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="live-dot" />
              <span
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-outline)',
                  fontWeight: 600,
                }}
              >
                {t('dashboard.brandTag')} · {greet().toLowerCase()}
              </span>
            </div>

            {/* Headline */}
            <h1 className="headline">
              {greet()}, <span className="serif">{firstName}</span>.
            </h1>

            {/* KPI ribbon */}
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span className="stat__num">{completedCount}</span>
                <div className="flex flex-col">
                  <span className="stat__label">{t('dashboard.statCompleted')}</span>
                </div>
              </div>

              {urgentTasks.length > 0 ? (
                <div className="stat urgent">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--priority-high)' }}>
                    bolt
                  </span>
                  <span className="stat__num">{urgentTasks.length}</span>
                  <div className="flex flex-col">
                    <span className="stat__label">{t('dashboard.statUrgent')}</span>
                  </div>
                </div>
              ) : (
                <div className="stat">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-outline)' }}>
                    bolt
                  </span>
                  <span className="stat__num" style={{ color: 'var(--color-outline)' }}>0</span>
                  <div className="flex flex-col">
                    <span className="stat__label">{t('dashboard.statUrgent')}</span>
                  </div>
                </div>
              )}

              <div className="stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)' }}>
                  date_range
                </span>
                <span className="stat__num">{weekTasks}</span>
                <div className="flex flex-col">
                  <span className="stat__label">{t('dashboard.statWeek')}</span>
                </div>
              </div>

              <div className="stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-tertiary)' }}>
                  event_upcoming
                </span>
                <span className="stat__num">{upcomingExams.length}</span>
                <div className="flex flex-col">
                  <span className="stat__label">{t('dashboard.statUpcoming')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: clock */}
          <div className="hidden lg:block">
            <LiveClock />
          </div>
        </div>
      </section>

      {/* ─────────── URGENT BANNER ─────────── */}
      {urgentBanner && (
        <Link
          href={urgentBanner.href}
          className="block mb-3 transition-transform active:scale-[0.99]"
        >
          <div
            className="flex items-center gap-3 rounded-[14px] px-3.5 py-3"
            style={{
              background: 'var(--priority-high-bg)',
              border: '1px solid color-mix(in srgb, var(--priority-high) 25%, transparent)',
            }}
          >
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-mono"
              style={{
                background: 'var(--priority-high)',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>flag</span>
              {t('dashboard.urgentLabel')}
            </span>
            <span
              className="font-mono font-bold tabular"
              style={{ color: 'var(--priority-high)', fontSize: 13 }}
            >
              {urgentBanner.daysLabel}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--on-surface)' }}>
                {urgentBanner.title}
              </p>
              {urgentBanner.meta && (
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--on-surface-variant)' }}>
                  {urgentBanner.meta}
                </p>
              )}
            </div>
            <span
              className="material-symbols-outlined hidden sm:flex items-center justify-center"
              style={{ fontSize: 18, color: 'var(--priority-high)' }}
            >
              arrow_forward
            </span>
          </div>
        </Link>
      )}

      {/* ─────────── ANNOUNCEMENTS ─────────── */}
      {announcements.length > 0 && (
        <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-2">
          {announcements.map((a) => {
            const accent = a.priority === 'urgent' ? 'var(--danger)' : 'var(--color-primary)'
            return (
              <div
                key={a.id}
                className="card flex items-start gap-2.5"
                style={{ padding: '11px 12px' }}
              >
                <span
                  className="material-symbols-outlined flex-shrink-0 mt-0.5"
                  style={{ fontSize: 16, color: accent, fontVariationSettings: "'FILL' 1" }}
                >
                  campaign
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="badge" style={{ background: 'transparent', padding: 0, color: 'var(--color-outline)' }}>
                      {a.subjects?.name || t('common.general')}
                    </span>
                    {a.priority === 'urgent' && (
                      <span className="badge badge--danger">{t('dashboard.urgentLabel')}</span>
                    )}
                  </div>
                  <p className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--on-surface)' }}>
                    {a.title}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─────────── 3-column grid: Today / Tasks / Upcoming ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Today's classes */}
        <section className="card">
          <div className="section-head">
            <div className="section-head__left">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                today
              </span>
              <span className="section-head__title">{t('dashboard.todayHeader')}</span>
              {todaySchedules.length > 0 && (
                <span className="section-head__count tabular">{todaySchedules.length}</span>
              )}
            </div>
            <Link href="/calendar" className="section-head__link">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>chevron_right</span>
            </Link>
          </div>

          {todaySchedules.length === 0 ? (
            <EmptyToday t={t} h={nowDate.getHours()} />
          ) : (
            <div className="flex flex-col gap-1">
              {todaySchedules.slice(0, 5).map(s => {
                const subject = allSubjects.find(sub => sub.id === s.subject_id)
                if (!subject) return null
                const isNow  = currentTimeStr >= s.start_time && currentTimeStr <= s.end_time
                const isDone = currentTimeStr > s.end_time
                return (
                  <div
                    key={s.id}
                    className="row"
                    style={{
                      ['--accent-color' as never]: subject.color,
                      opacity: isDone ? 0.45 : 1,
                    }}
                  >
                    <div className="row__time">
                      <ClientTime time24={s.start_time.slice(0, 5)} />
                    </div>
                    <div className="row__main">
                      <div className="row__title flex items-center gap-1.5">
                        {isNow && <span className="live-dot" style={{ ['--success' as never]: subject.color }} />}
                        <span className="truncate">{subject.name}</span>
                      </div>
                      <div className="row__meta">
                        {(s.room || subject.room) && (
                          <>
                            <span className="material-symbols-outlined">place</span>
                            {s.room || subject.room}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="row__right">
                      <ClientTime time24={s.end_time.slice(0, 5)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Tasks */}
        <TaskFeed tasks={allTasks} subjects={allSubjects} />

        {/* Upcoming exams */}
        <ExamFeed exams={allExams} subjects={allSubjects} />
      </div>

      {/* ─────────── Quick Access ─────────── */}
      <section className="mt-4">
        <div className="section-head">
          <div className="section-head__left">
            <span className="kicker">{t('dashboard.quickAccess')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <QuickAction href="/planner?create=task" icon="add_task"          label={t('dashboard.qaNewTask')}        color="var(--color-primary)"  />
          <QuickAction href="/planner?create=exam" icon="event"             label={t('dashboard.qaNewExam')}        color="var(--danger)"         />
          <QuickAction href="/notes?new=1"         icon="edit_note"         label={t('dashboard.qaQuickNote')}      color="var(--warning)"        />
          <QuickAction href="/ai?tab=import"       icon="document_scanner"  label={t('dashboard.qaImportSchedule')} color="var(--success)"        />
          <QuickAction href="/ai"                  icon="auto_awesome"      label={t('dashboard.qaAskAI')}          color="var(--color-tertiary)" />
        </div>
      </section>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function EmptyToday({ t, h }: { t: (k: string) => string; h: number }) {
  const motiv = h < 7
    ? { text: t('dashboard.motivEarly'),     icon: 'nights_stay'      }
    : h < 12
      ? { text: t('dashboard.motivMorning'),   icon: 'wb_sunny'        }
      : h < 15
        ? { text: t('dashboard.motivAfternoon'), icon: 'local_library'  }
        : h < 19
          ? { text: t('dashboard.motivEvening'),   icon: 'self_improvement'}
          : { text: t('dashboard.motivNight'),     icon: 'bedtime'         }
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 18, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}
        >
          {motiv.icon}
        </span>
      </div>
      <p
        className="text-[12px] leading-snug serif italic"
        style={{ color: 'var(--on-surface-variant)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
      >
        {motiv.text}
      </p>
    </div>
  )
}

function QuickAction({ href, icon, label, color }: { href: string; icon: string; label: string; color: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 py-3 px-3 rounded-[12px] transition-all hover:translate-y-[-1px]"
      style={{
        background: `color-mix(in srgb, ${color} 8%, var(--s-low))`,
        border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      <div
        className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 17, color, fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <span className="text-[11.5px] font-semibold leading-tight" style={{ color }}>
        {label}
      </span>
    </Link>
  )
}
