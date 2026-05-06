import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Task, Exam, Subject, Schedule } from '@/types'
import { getTranslator } from '@/lib/i18n/server'
import { LiveClock } from '@/features/home/components/LiveClock'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { UrgentCountdown } from '@/features/home/components/UrgentCountdown'
import { subjectTag } from '@/lib/utils'

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

  // Announcements for enrolled subjects (include teacher's name + content + subject color)
  const enrolledSubjectIds = (enrollmentData ?? []).map((e: { subject_id: string }) => e.subject_id)
  const { data: announcementsRaw } = enrolledSubjectIds.length > 0
    ? await supabase
        .from('announcements')
        .select('id, title, content, priority, created_at, subject_id, teacher_id, subjects(name, color)')
        .in('subject_id', enrolledSubjectIds)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] }

  const annRows = (announcementsRaw ?? []) as unknown as {
    id: string
    title: string
    content: string | null
    priority: 'normal' | 'urgent'
    created_at: string
    subject_id: string
    teacher_id: string | null
    subjects: { name: string; color: string } | null
  }[]

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

  const announcements = annRows.map(a => ({
    ...a,
    teacherName: a.teacher_id ? (teacherNameMap[a.teacher_id] ?? null) : null,
  }))

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
        meta: sub ? `${sub.name} · ${t('dashboard.todayCloses') || 'Cierra hoy 23:59'}` : '',
        deadlineISO,
        href: '/planner',
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
          href: '/planner',
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

  // ── ISO week for the Semana N / 52 chip ──
  const isoWeek = (() => {
    const d = new Date(Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  })()

  // ── Stats for the hero pills ──
  const todayClassesCount = todaySchedules.length

  // Pending tasks for the "Tareas" col, sorted by due date
  const pendingTasks = allTasks
    .filter(t => !t.is_done)
    .sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity
      return ad - bd
    })
    .slice(0, 4)

  // Get full schedule rooms info from subject
  const subjectByCode = (s: Subject) => s.name.slice(0, 6).toUpperCase()

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">

      {/* ─────────── SUB-HEADER · meta chips + alert ─────────── */}
      <DashMetaBar
        weekIndex={isoWeek}
        weekTotal={52}
        avg={weightedAvg}
        alertDueLabel={alertDueLabel}
      />

      {/* ─────────── GREETING HERO ─────────── */}
      <section className="dash-hero">
        <div className="min-w-0">
          <span className="dash-hero__eyebrow">
            {t('dashboard.brandTag')} · {t('dashboard.assistantTag') || 'Asistente Académico'}
          </span>
          <h1 className="dash-hero__title">
            {greet()}, <span className="serif">{firstName}</span>.
          </h1>

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
        </div>

        <LiveClock />
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
      {announcements.length > 0 && (
        <section className="ann-strip">
          <div className="ann-strip__head">
            <div className="ann-strip__title">
              <span className="material-symbols-outlined">campaign</span>
              {t('dashboard.announcementsHeader') || 'Anuncios'}
              <span className="ann-strip__title-count">{announcements.length}</span>
            </div>
            <span className="ann-strip__unread">
              {(t('dashboard.announcementsUnread') || '{n} sin leer').replace(
                '{n}',
                String(announcements.filter(a => a.priority === 'urgent').length || announcements.length),
              )}
            </span>
          </div>

          <div className="ann-strip__grid">
            {announcements.map(a => {
              const tag = subjectTag(a.subjects?.color)
              const teacherName = a.teacherName || (language === 'es' ? 'Profesor' : 'Teacher')
              const initials = teacherName
                .split(' ')
                .slice(0, 2)
                .map(n => n[0])
                .join('')
                .toUpperCase()
              const subjectColor = a.subjects?.color || 'var(--color-primary)'
              const subjCode = (a.subjects?.name || '').slice(0, 4).toUpperCase()
              const created = new Date(a.created_at)
              const diffMin = Math.floor((Date.now() - created.getTime()) / 60000)
              const time =
                diffMin < 1
                  ? language === 'es' ? 'Ahora' : 'Now'
                  : diffMin < 60
                    ? `${language === 'es' ? 'Hace' : ''} ${diffMin} min`.trim()
                    : diffMin < 1440
                      ? `${language === 'es' ? 'Hace' : ''} ${Math.floor(diffMin / 60)} h`.trim()
                      : `${language === 'es' ? 'Hace' : ''} ${Math.floor(diffMin / 1440)} d`.trim()
              const preview = a.content || a.title

              return (
                <div key={a.id} className={`ann ${tag}`}>
                  <div
                    className="ann__avatar"
                    style={{ background: `color-mix(in srgb, ${subjectColor} 35%, var(--color-primary))` }}
                  >
                    {initials || '·'}
                  </div>
                  <div className="ann__head">
                    <span className="ann__name">{teacherName}</span>
                    {subjCode && <span className="ann__chip">{subjCode}</span>}
                  </div>
                  <span className="ann__time">{time}</span>
                  <p className="ann__text">{preview}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─────────── 3-column grid: Agenda / Tareas / Próximas ─────────── */}
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
            <Link href="/calendar" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          {todaySchedules.length === 0 ? (
            <EmptyToday t={t} h={nowDate.getHours()} />
          ) : (
            <div className="flex flex-col">
              {todaySchedules.slice(0, 5).map(s => {
                const subject = allSubjects.find(sub => sub.id === s.subject_id)
                if (!subject) return null
                const startHHMM = s.start_time.slice(0, 5)
                const endHHMM   = s.end_time.slice(0, 5)
                const isNow  = currentTimeStr >= s.start_time && currentTimeStr <= s.end_time
                const isDone = currentTimeStr > s.end_time
                const subjCode = subjectByCode(subject)
                const room = s.room || subject.room || ''
                const prof = subject.professor || ''
                const meta = [subjCode, room, prof].filter(Boolean).join(' · ')

                let endMins = 0
                if (isNow) {
                  const [eh, em] = endHHMM.split(':').map(Number)
                  const [nh, nm] = currentTimeStr.split(':').map(Number)
                  endMins = (eh * 60 + em) - (nh * 60 + nm)
                }

                return (
                  <div
                    key={s.id}
                    className="agenda-item"
                    style={{ ['--accent-color' as never]: subject.color }}
                  >
                    <div className="agenda-item__time">
                      <strong>{startHHMM}</strong>
                      {endHHMM}
                    </div>
                    <div className="agenda-item__bar" />
                    <div className="agenda-item__body">
                      <div className="agenda-item__title">{subject.name}</div>
                      {meta && <div className="agenda-item__meta">{meta}</div>}
                      {isDone && (
                        <div className="agenda-item__status agenda-item__status--done">
                          <span className="material-symbols-outlined">check_circle</span>
                          {t('dashboard.completed') || 'Completada'}
                        </div>
                      )}
                      {isNow && (
                        <div className="agenda-item__status agenda-item__status--live">
                          <span className="live-pulse" />
                          {t('dashboard.liveNow') || 'EN VIVO'} ·
                          {' '}
                          {(t('dashboard.liveMinsLeft') || 'faltan {n} min').replace('{n}', String(Math.max(0, endMins)))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
            <Link href="/planner" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="flex flex-col">
            {pendingTasks.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--color-outline)', padding: '8px 0' }}>
                {t('feeds.noTasks') || 'Sin tareas pendientes'}
              </p>
            ) : (
              pendingTasks.map(task => {
                const sub = allSubjects.find(s => s.id === task.subject_id)
                const accent = sub?.color || 'var(--color-primary)'
                const subjCode = sub ? sub.name.slice(0, 4).toUpperCase() : '—'
                const due = task.due_date ? new Date(task.due_date) : null
                const days = due ? Math.round((due.getTime() - new Date(todayStr).getTime()) / 86400000) : null
                const dueLabel = days == null
                  ? ''
                  : days === 0
                    ? language === 'es' ? 'Hoy' : 'Today'
                    : days === 1
                      ? language === 'es' ? 'Mañana' : 'Tmrw'
                      : days < 0
                        ? language === 'es' ? `Hace ${Math.abs(days)}d` : `${Math.abs(days)}d ago`
                        : `${days}d`
                const dueTime = due
                  ? `${due.getHours().toString().padStart(2, '0')}:${due.getMinutes().toString().padStart(2, '0')}`
                  : ''
                const prio = task.priority || 'low'
                const prioLabel = prio === 'high'
                  ? language === 'es' ? 'ALTA' : 'HIGH'
                  : prio === 'mid'
                    ? language === 'es' ? 'MEDIA' : 'MED'
                    : language === 'es' ? 'BAJA' : 'LOW'

                return (
                  <div
                    key={task.id}
                    className="task-row"
                    style={{
                      ['--accent-color' as never]: accent,
                      ['--accent-bg-strong' as never]: `color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                  >
                    <div className="task-row__bar" />
                    <div className="task-row__body">
                      <div className="task-row__head">
                        {sub && (
                          <span className="task-row__chip">{subjCode}</span>
                        )}
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
                    <span className={`task-row__prio task-row__prio--${prio}`}>{prioLabel}</span>
                  </div>
                )
              })
            )}
          </div>

          <Link href="/planner?create=task" className="dash-col__add">
            <span className="material-symbols-outlined">add</span>
            {t('dashboard.addTaskCta') || 'Agregar tarea'}
          </Link>
        </section>

        {/* ── Próximas (Actividades, sin tabs) ── */}
        <section className="dash-col">
          <div className="dash-col__head">
            <div className="dash-col__head-left">
              <span className="material-symbols-outlined dash-col__head-icon">flag</span>
              <span className="dash-col__title">{t('dashboard.upcomingHeader') || 'Próximas'}</span>
              {upcomingExams.length > 0 && (
                <span className="dash-col__count">{upcomingExams.length}</span>
              )}
            </div>
            <Link href="/planner" className="dash-col__more">
              {t('dashboard.viewAll')}
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>

          <div className="flex flex-col">
            {upcomingExams.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--color-outline)', padding: '8px 0' }}>
                {t('feeds.noActivities') || 'Sin actividades próximas'}
              </p>
            ) : (
              upcomingExams.slice(0, 4).map(exam => {
                const sub = allSubjects.find(s => s.id === exam.subject_id)
                const accent = sub?.color || 'var(--color-primary)'
                const subjCode = sub ? sub.name.slice(0, 4).toUpperCase() : '—'
                const date = new Date(exam.exam_date + 'T00:00:00')
                const day = date.getDate()
                const month = date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' })
                  .replace('.', '')
                  .toUpperCase()
                const days = Math.round((date.getTime() - new Date(todayStr).getTime()) / 86400000)
                const countLabel = days === 0
                  ? language === 'es' ? 'HOY' : 'TODAY'
                  : days === 1
                    ? language === 'es' ? 'MAÑ' : 'TMW'
                    : `${days}D`
                const countTone = days < 7 ? 'urgent' : days < 14 ? 'soon' : 'later'
                const typeLabel = exam.activity_type
                  ? exam.activity_type.charAt(0).toUpperCase() + exam.activity_type.slice(1)
                  : ''
                const pctLabel = exam.percentage ? ` ${exam.percentage}%` : ''

                return (
                  <div
                    key={exam.id}
                    className="next-item"
                    style={{
                      ['--accent-color' as never]: accent,
                      ['--accent-bg-strong' as never]: `color-mix(in srgb, ${accent} 22%, transparent)`,
                    }}
                  >
                    <div className="next-item__date">
                      <span className="next-item__date-d">{day}</span>
                      <span className="next-item__date-m">{month}</span>
                    </div>
                    <div className="next-item__bar" />
                    <div className="next-item__body">
                      <div className="next-item__title truncate">{exam.title}</div>
                      <div className="next-item__meta">
                        <span className="next-item__chip-mat">{subjCode}</span>
                        {typeLabel && <span>{typeLabel}{pctLabel}</span>}
                      </div>
                    </div>
                    <span className={`next-item__count next-item__count--${countTone}`}>
                      {countLabel}
                    </span>
                  </div>
                )
              })
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

