import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { getTranslator } from '@/lib/i18n/server'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { UrgentCountdown } from '@/features/home/components/UrgentCountdown'
import { DashboardRefresher } from '@/features/home/components/DashboardRefresher'
import { GreetingTitle } from '@/features/home/components/GreetingTitle'
import { AnnouncementsStrip, type DashAnnouncement } from '@/features/home/components/AnnouncementsStrip'
import { AgendaList } from '@/features/home/components/AgendaList'
import { TasksList } from '@/features/home/components/TasksList'
import { EvaluationsList } from '@/features/home/components/EvaluationsList'

export default async function DashboardPage() {
  const { t, lang } = getTranslator()
  const language = lang as 'es' | 'en'
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
    supabase.from('profiles').select('full_name, current_week, semester_weeks').eq('id', user.id).single(),
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

  // Announcements for enrolled subjects (include teacher's name + content + subject color + read state)
  const enrolledSubjectIds = (enrollmentData ?? []).map((e: { subject_id: string }) => e.subject_id)
  const [annRes, readRes] = enrolledSubjectIds.length > 0
    ? await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, content, priority, created_at, subject_id, teacher_id, subjects(name, color)')
          .in('subject_id', enrolledSubjectIds)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('student_id', user.id),
      ])
    : [{ data: [] }, { data: [] }]

  const annRows = (annRes.data ?? []) as unknown as {
    id: string
    title: string
    content: string | null
    priority: 'normal' | 'urgent'
    created_at: string
    subject_id: string
    teacher_id: string | null
    subjects: { name: string; color: string } | null
  }[]

  const readSet = new Set(
    ((readRes.data ?? []) as { announcement_id: string }[]).map(r => r.announcement_id),
  )

  // Fetch teacher names in one round-trip
  const teacherIds = Array.from(new Set(annRows.map(a => a.teacher_id).filter((id): id is string => !!id)))
  const teacherNameMap: Record<string, string> = {}
  if (teacherIds.length > 0) {
    const { data: teacherProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', teacherIds)
    for (const p of (teacherProfiles ?? []) as { id: string; full_name: string | null }[]) {
      if (p.full_name) teacherNameMap[p.id] = p.full_name
    }
  }

  const announcements: DashAnnouncement[] = annRows
    .map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      priority: a.priority,
      created_at: a.created_at,
      teacherName: a.teacher_id ? (teacherNameMap[a.teacher_id] ?? null) : null,
      subjectName: a.subjects?.name ?? null,
      subjectColor: a.subjects?.color ?? null,
      read: readSet.has(a.id),
    }))
    // Filter placeholder content from the home strip (item still exists on /anuncios)
    .filter(a => (a.content?.trim().length ?? 0) > 0 || a.title.trim().length >= 4)

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

  const todaySchedules = allSchedules
    .filter(s => s.day_of_week === todayDow)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const firstName = profile?.full_name?.split(' ')[0] || t('dashboard.studentFallback')

  const nextExam = upcomingExams[0]

  // ── Urgent banner data: deadline ISO + title/meta ──
  // Tasks default to 23:59 of due_date; exams to 23:59 of exam_date.
  const urgentBanner = (() => {
    if (urgentTasks.length > 0) {
      const top = urgentTasks[0]
      const sub = allSubjects.find(s => s.id === top.subject_id)
      const deadlineISO = top.due_date ? `${top.due_date}T23:59:00` : null
      return {
        kind: 'task' as const,
        title: top.text,
        meta: sub ? sub.name : '',
        deadlineISO,
        href: '/tareas',
      }
    }
    if (nextExam) {
      const exDeadlineDays = Math.round((new Date(nextExam.exam_date).getTime() - new Date(todayStr).getTime()) / 86400000)
      if (exDeadlineDays <= 2) {
        const sub = allSubjects.find(s => s.id === nextExam.subject_id)
        return {
          kind: 'exam' as const,
          title: nextExam.title,
          meta: sub ? sub.name : '',
          deadlineISO: `${nextExam.exam_date}T23:59:00`,
          href: '/evaluaciones',
        }
      }
    }
    return null
  })()

  // ── Top alert (sub-header right side): "1 entrega cierra en HHh MMm" ──
  const alertDueLabel = (() => {
    if (!urgentBanner || !urgentBanner.deadlineISO) return null
    const diffMin = Math.max(0, Math.floor((new Date(urgentBanner.deadlineISO).getTime() - Date.now()) / 60000))
    if (diffMin > 24 * 60) return null  // only show if within 24h
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    const time = `${h}h ${m.toString().padStart(2, '0')}m`
    const tpl = t('dashboard.alertEntregaSingular') || '{n} entrega cierra en {time}'
    return tpl.replace('{n}', '1').replace('{time}', time)
  })()

  // ── Weighted average across subjects (by credits, scale 0-20) ──
  const weightedAvg = (() => {
    let weightedSum = 0
    let creditsSum = 0
    for (const subject of allSubjects) {
      const subjExams = allExams.filter(e => e.subject_id === subject.id && e.percentage != null)
      let earned = 0
      let coverage = 0
      for (const e of subjExams) {
        if (e.grade != null) {
          earned += (e.grade * (e.percentage ?? 0)) / 100
          coverage += e.percentage ?? 0
        }
      }
      if (coverage > 0) {
        const subjectAvg = earned / (coverage / 100)
        const credits = subject.credits || 1
        weightedSum += subjectAvg * credits
        creditsSum += credits
      }
    }
    return creditsSum > 0 ? weightedSum / creditsSum : null
  })()


  // ── Stats for the hero pills ──
  const todayClassesCount = todaySchedules.length

  // Pending tasks for the "Tareas" col, sorted by due date.
  // Hide tasks overdue by more than 7 days (still visible on /tareas).
  const pendingTasks = allTasks
    .filter(t => {
      if (t.is_done) return false
      if (t.due_date) {
        const overdueDays = Math.round(
          (new Date(todayStr).getTime() - new Date(t.due_date).getTime()) / 86400000,
        )
        if (overdueDays > 7) return false
      }
      return true
    })
    .sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
      return ad - bd
    })
    .slice(0, 4)

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">
      <DashboardRefresher />

      {/* ─────────── SUB-HEADER · meta chips + alert ─────────── */}
      <DashMetaBar
        avg={weightedAvg}
        alertDueLabel={alertDueLabel}
      />

      {/* ─────────── GREETING HERO ─────────── */}
      <section className="dash-hero">
        <GreetingTitle firstName={firstName} />

        <div className="dash-hero__stats">
          {/* Hechas — Clases hoy */}
          <div className="dash-hero__stat">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="dash-hero__stat-num">{completedCount}</span>
            <span className="dash-hero__stat-eyebrow">{t('dashboard.statCompleted')}</span>
            <span className="dash-hero__stat-label">
              {todayClassesCount} {language === 'es' ? 'clases hoy' : 'classes today'}
            </span>
          </div>

          {/* Urgentes — Pendiente */}
          <div className={`dash-hero__stat ${urgentTasks.length > 0 ? 'dash-hero__stat--urgent' : ''}`}>
            <span className="material-symbols-outlined">priority_high</span>
            <span className="dash-hero__stat-num">{urgentTasks.length}</span>
            <span className="dash-hero__stat-eyebrow">{language === 'es' ? 'URGENTE' : 'URGENT'}</span>
            <span className="dash-hero__stat-label">
              {urgentTasks.length === 1
                ? (language === 'es' ? 'Pendiente' : 'Pending')
                : (language === 'es' ? 'Pendientes' : 'Pending')}
            </span>
          </div>

          {/* Esta sem — Tareas */}
          <div className="dash-hero__stat">
            <span className="material-symbols-outlined">task_alt</span>
            <span className="dash-hero__stat-num">{weekTasks}</span>
            <span className="dash-hero__stat-eyebrow">{language === 'es' ? 'ESTA SEM.' : 'THIS WEEK'}</span>
            <span className="dash-hero__stat-label">{language === 'es' ? 'Tareas' : 'Tasks'}</span>
          </div>

          {/* Próximas — Evaluaciones */}
          <div className="dash-hero__stat">
            <span className="material-symbols-outlined">edit_calendar</span>
            <span className="dash-hero__stat-num">{upcomingExams.length}</span>
            <span className="dash-hero__stat-eyebrow">{t('dashboard.statUpcoming')}</span>
            <span className="dash-hero__stat-label">{language === 'es' ? 'Evaluaciones' : 'Evaluations'}</span>
          </div>
        </div>
      </section>

      {/* ─────────── URGENT BANNER ─────────── */}
      {urgentBanner && urgentBanner.deadlineISO && (
        <UrgentCountdown
          href={urgentBanner.href}
          deadlineISO={urgentBanner.deadlineISO}
          title={urgentBanner.title}
          meta={urgentBanner.meta}
        />
      )}

      {/* ─────────── ANNOUNCEMENTS ─────────── */}
      <AnnouncementsStrip announcements={announcements} />

      {/* ─────────── 3-column grid: Agenda / Tareas / Evaluaciones ─────────── */}
      <div className="dash-cols">

        {/* ── Agenda del día ── */}
        <section className="dash-col">
          <div className="dash-col__head">
            <div className="dash-col__head-left">
              <span className="material-symbols-outlined dash-col__head-icon">today</span>
              <span className="dash-col__title">{t('dashboard.agendaHeader') || "Agenda del día"}</span>
              {todaySchedules.length > 0 && (
                <span className="dash-col__count">{todaySchedules.length}</span>
              )}
            </div>
            <Link href="/calendar?view=day" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="dash-col__items">
            {todaySchedules.length === 0 ? (
              <EmptyToday t={t} h={nowDate.getHours()} />
            ) : (
              <AgendaList schedules={todaySchedules} subjects={allSubjects} />
            )}
          </div>
        </section>

        {/* ── Tareas (sin tabs) ── */}
        <section className="dash-col">
          <div className="dash-col__head">
            <div className="dash-col__head-left">
              <span className="material-symbols-outlined dash-col__head-icon">task_alt</span>
              <span className="dash-col__title">{t('dashboard.tasksHeader') || 'Tareas'}</span>
              {pendingTasks.length > 0 && (
                <span className="dash-col__count">{pendingTasks.length}</span>
              )}
            </div>
            <Link href="/tareas" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="dash-col__items">
            {pendingTasks.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--color-outline)', padding: '8px 0' }}>
                {t('feeds.noTasks') || 'Sin tareas pendientes'}
              </p>
            ) : (
              <TasksList tasks={pendingTasks} subjects={allSubjects} todayStr={todayStr} />
            )}
          </div>

          <Link href="/tareas?new=1" className="dash-col__add">
            <span className="material-symbols-outlined">add</span>
            {t('dashboard.addTaskCta') || 'Agregar tarea'}
          </Link>
        </section>

        {/* ── Evaluaciones ── */}
        <section className="dash-col">
          <div className="dash-col__head">
            <div className="dash-col__head-left">
              <span className="material-symbols-outlined dash-col__head-icon">edit_calendar</span>
              <span className="dash-col__title">{t('dashboard.upcomingHeader') || 'Evaluaciones'}</span>
              {upcomingExams.length > 0 && (
                <span className="dash-col__count">{upcomingExams.length}</span>
              )}
            </div>
            <Link href="/evaluaciones" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="dash-col__items">
            {upcomingExams.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--color-outline)', padding: '8px 0' }}>
                {t('feeds.noActivities') || 'Sin actividades próximas'}
              </p>
            ) : (
              <EvaluationsList exams={upcomingExams} subjects={allSubjects} todayStr={todayStr} />
            )}
          </div>
        </section>
      </div>
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

