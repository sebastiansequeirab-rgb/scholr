'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { uniqueById, subjectTag } from '@/lib/utils'
import type { Subject, Schedule, Exam, Task } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'

type CalView = 'month' | 'week' | 'day'

type CalEvent = {
  id: string
  type: 'schedule' | 'exam' | 'task'
  title: string
  start: Date
  end: Date | null
  allDay: boolean
  subjectId: string | null
  subjectColor: string
  tagClass: 'tag-purple' | 'tag-cyan' | 'tag-green' | 'tag-amber' | 'tag-rose' | 'tag-blue'
  code: string
  location: string | null
  professor: string | null
  status: 'completed' | 'live' | 'upcoming' | 'urgent' | null
  activityType?: keyof typeof ACTIVITY_TYPES
  notes?: string | null
  percentage?: number | null
  priority?: 'high' | 'mid' | 'low'
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function subjectCode(name: string): string {
  const w = stripAccents(name).split(/\s+/).filter(Boolean)
  if (!w.length) return '·'
  if (w[0].length >= 4) return w[0].slice(0, 4).toUpperCase()
  return w[0].toUpperCase()
}

function pad(n: number) { return String(n).padStart(2, '0') }
function hhmm(d: Date) { return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeekMon(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (c.getDay() + 6) % 7   // Mon=0 … Sun=6
  c.setDate(c.getDate() - dow)
  return c
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  c.setDate(c.getDate() + n)
  return c
}

function startOfMonthGrid(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return startOfWeekMon(first)
}

function isoWeekOf(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const SLOT_START = 6   // 06:00
const SLOT_END   = 22  // 22:00
const SLOT_HOURS = SLOT_END - SLOT_START
const ROW_PX     = 56

function topPxFor(d: Date): number {
  const m = d.getHours() * 60 + d.getMinutes() - SLOT_START * 60
  return (m / 60) * ROW_PX
}
function heightPxFor(start: Date, end: Date): number {
  const s = start.getHours() * 60 + start.getMinutes()
  const e = end.getHours() * 60 + end.getMinutes()
  return Math.max(28, ((e - s) / 60) * ROW_PX)
}

export default function CalendarPage() {
  const { t, language } = useTranslation()
  const locale = language === 'en' ? 'en-US' : 'es-ES'

  const [subjects,  setSubjects]  = useState<Subject[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [exams,     setExams]     = useState<Exam[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [loading,   setLoading]   = useState(true)

  const [view,    setView]    = useState<CalView>('month')
  const [cursor,  setCursor]  = useState<Date>(() => new Date())
  const [now,     setNow]     = useState<Date>(() => new Date())
  const [picked,  setPicked]  = useState<CalEvent | null>(null)

  const searchParams = useSearchParams()

  // Apply ?view=day|week|month from URL (used by the dashboard "Agenda" link)
  useEffect(() => {
    const v = searchParams.get('view')
    if (v === 'day' || v === 'week' || v === 'month') setView(v)
  }, [searchParams])

  // Mobile bumps default to day view (only when no explicit ?view= override)
  useEffect(() => {
    if (searchParams.get('view')) return
    if (window.innerWidth < 768) setView('day')
  }, [searchParams])

  // Tick "now" every minute for live indicators
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: ss }, { data: sc }, { data: es }, { data: ts }] = await Promise.all([
      supabase.from('subjects').select('*'),
      supabase.from('schedules').select('*'),
      supabase.from('exams').select('*'),
      supabase.from('tasks').select('*').not('due_date', 'is', null),
    ])
    setSubjects(uniqueById(ss || []))
    setSchedules(sc || [])
    setExams(es || [])
    setTasks(ts || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ────── Build events inside a [from, to) window ─────────
  const buildEvents = useCallback((from: Date, to: Date): CalEvent[] => {
    const out: CalEvent[] = []
    const subById = new Map(subjects.map(s => [s.id, s]))

    // Schedules → repeat across the window per day_of_week
    schedules.forEach(s => {
      const sub = subById.get(s.subject_id)
      if (!sub) return
      const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
      while (cursor < to) {
        if (cursor.getDay() === s.day_of_week) {
          const [sh, sm] = s.start_time.split(':').map(Number)
          const [eh, em] = s.end_time.split(':').map(Number)
          const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), sh, sm)
          const end   = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), eh, em)
          let status: CalEvent['status'] = null
          if (end < now) status = 'completed'
          else if (start <= now && now <= end) status = 'live'
          out.push({
            id: `schedule-${s.id}-${start.toISOString()}`,
            type: 'schedule',
            title: sub.name,
            start, end, allDay: false,
            subjectId: sub.id,
            subjectColor: sub.color,
            tagClass: subjectTag(sub.color),
            code: subjectCode(sub.name),
            location: s.room || sub.room,
            professor: sub.professor,
            status,
          })
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    })

    // Exams → single occurrence
    exams.forEach(e => {
      const sub = e.subject_id ? subById.get(e.subject_id) : null
      const dateOnly = !e.exam_time
      const [y, mo, d] = e.exam_date.split('-').map(Number)
      let start: Date
      let end: Date | null
      if (dateOnly) {
        start = new Date(y, mo - 1, d)
        end = null
      } else {
        const [hh, mm] = e.exam_time!.split(':').map(Number)
        start = new Date(y, mo - 1, d, hh, mm)
        end = new Date(start.getTime() + 90 * 60_000)
      }
      if (start >= to) return
      if ((end ?? start) < from) return
      const subColor = sub?.color ?? '#3b82f6'
      out.push({
        id: `exam-${e.id}`,
        type: 'exam',
        title: e.title,
        start, end,
        allDay: dateOnly,
        subjectId: sub?.id ?? null,
        subjectColor: subColor,
        tagClass: subjectTag(subColor),
        code: sub ? subjectCode(sub.name) : 'EVAL',
        location: e.location,
        professor: sub?.professor ?? null,
        status: null,
        activityType: (e.activity_type || 'exam') as keyof typeof ACTIVITY_TYPES,
        notes: e.notes,
        percentage: e.percentage,
      })
    })

    // Tasks (deadlines) → all-day on due_date
    tasks.forEach(task => {
      if (!task.due_date || task.is_done) return
      const [y, mo, d] = task.due_date.split('-').map(Number)
      const start = new Date(y, mo - 1, d)
      if (start >= to) return
      if (start < from) return
      const sub = task.subject_id ? subById.get(task.subject_id) : null
      const subColor = sub?.color ?? '#94a3b8'
      const status: CalEvent['status'] = task.priority === 'high' ? 'urgent' : null
      out.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.text,
        start, end: null,
        allDay: true,
        subjectId: sub?.id ?? null,
        subjectColor: subColor,
        tagClass: subjectTag(subColor),
        code: sub ? subjectCode(sub.name) : 'TASK',
        location: null,
        professor: null,
        status,
        priority: task.priority,
      })
    })

    return out
  }, [subjects, schedules, exams, tasks, now])

  // ────── Range for the active view ──────
  const range = useMemo(() => {
    if (view === 'month') {
      const start = startOfMonthGrid(cursor)
      const end = addDays(start, 42)
      return { start, end }
    }
    if (view === 'week') {
      const start = startOfWeekMon(cursor)
      const end = addDays(start, 7)
      return { start, end }
    }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    const end = addDays(start, 1)
    return { start, end }
  }, [view, cursor])

  const events = useMemo(() => buildEvents(range.start, range.end), [buildEvents, range])

  // ────── Meta-bar inputs ──────
  const weightedAvg = useMemo(() => {
    let weightedSum = 0, creditsSum = 0
    for (const subject of subjects) {
      const subjExams = exams.filter(e => e.subject_id === subject.id && e.percentage != null)
      let earned = 0, coverage = 0
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
  }, [subjects, exams])

  const alertDueLabel = useMemo(() => {
    const todayStr = now.toISOString().split('T')[0]
    const urgentTask = tasks
      .filter(tk => !tk.is_done && tk.due_date && tk.priority === 'high')
      .filter(tk => tk.due_date! >= todayStr)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0]
    const candidate = urgentTask?.due_date ? new Date(`${urgentTask.due_date}T23:59:00`) : null
    if (!candidate) return null
    const diffMin = Math.max(0, Math.floor((candidate.getTime() - now.getTime()) / 60_000))
    if (diffMin > 24 * 60) return null
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    const time = `${h}h ${pad(m)}m`
    const tpl = t('dashboard.alertEntregaSingular') || (language === 'es' ? '{n} entrega cierra en {time}' : '{n} delivery closes in {time}')
    return tpl.replace('{n}', '1').replace('{time}', time)
  }, [tasks, now, t, language])

  // ────── Header strings (view-aware) ──────
  const headerText = useMemo(() => {
    const monthName = cursor.toLocaleDateString(locale, { month: 'long' })
    const upper = (s: string) => s.toUpperCase()
    if (view === 'month') {
      const eyebrow = `${upper(monthName)} ${cursor.getFullYear()}`
      const titleHead = monthName.charAt(0).toUpperCase() + monthName.slice(1)
      const titleEm = `${cursor.getFullYear()}`
      const monthEvents = events
      const classes  = monthEvents.filter(e => e.type === 'schedule').length
      const evals    = monthEvents.filter(e => e.type === 'exam').length
      const tasksN   = monthEvents.filter(e => e.type === 'task').length
      const sub = language === 'es'
        ? `${titleHead} ${cursor.getFullYear()} · ${classes} clases · ${evals} evaluaciones · ${tasksN} tareas`
        : `${titleHead} ${cursor.getFullYear()} · ${classes} classes · ${evals} assessments · ${tasksN} tasks`
      return { eyebrow, titleHead: titleHead, titleEm, sub }
    }
    if (view === 'week') {
      const ws = startOfWeekMon(cursor)
      const we = addDays(ws, 6)
      const sameMonth = ws.getMonth() === we.getMonth()
      const monthShort = ws.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
      const monthShortE = we.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
      const eyebrow = sameMonth
        ? `${ws.getDate()} ${language === 'es' ? 'AL' : 'TO'} ${we.getDate()} ${upper(monthShort)}`
        : `${ws.getDate()} ${upper(monthShort)} ${language === 'es' ? 'AL' : 'TO'} ${we.getDate()} ${upper(monthShortE)}`
      const wkN = isoWeekOf(ws)
      const titleHead = language === 'es' ? 'Semana' : 'Week'
      const titleEm = `${wkN}/52`
      const wkEvents = events
      const classes = wkEvents.filter(e => e.type === 'schedule').length
      const evals   = wkEvents.filter(e => e.type === 'exam').length
      const tasksN  = wkEvents.filter(e => e.type === 'task').length
      const fmt = (d: Date) => `${d.getDate()}`
      const sub = language === 'es'
        ? `${fmt(ws)} al ${fmt(we)} de ${monthShort} · ${classes} clases · ${evals} evaluaciones · ${tasksN} tareas`
        : `${fmt(ws)} to ${fmt(we)} ${monthShortE} · ${classes} classes · ${evals} assessments · ${tasksN} tasks`
      return { eyebrow: `CALENDARIO · ${eyebrow}`, titleHead, titleEm, sub }
    }
    // day
    const dayName = cursor.toLocaleDateString(locale, { weekday: 'long' })
    const monthShort = cursor.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
    const eyebrow = `${upper(dayName)} ${cursor.getDate()} ${upper(monthShort)}`
    const isToday = isSameDay(cursor, now)
    const titleHead = isToday ? (language === 'es' ? 'Hoy' : 'Today') : dayName.charAt(0).toUpperCase() + dayName.slice(1)
    const titleEm = isToday ? `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${cursor.getDate()}` : `${cursor.getDate()}`
    const dayEvents = events
    const total = dayEvents.length
    const evals = dayEvents.filter(e => e.type === 'exam').length
    const urgentN = dayEvents.filter(e => e.status === 'urgent').length
    const sub = language === 'es'
      ? `${total} ${total === 1 ? 'evento' : 'eventos'} hoy · ${evals} ${evals === 1 ? 'evaluación' : 'evaluaciones'} · ${urgentN} ${urgentN === 1 ? 'tarea urgente' : 'tareas urgentes'}`
      : `${total} ${total === 1 ? 'event' : 'events'} today · ${evals} ${evals === 1 ? 'assessment' : 'assessments'} · ${urgentN} urgent ${urgentN === 1 ? 'task' : 'tasks'}`
    return { eyebrow: `CALENDARIO · ${eyebrow}`, titleHead, titleEm, sub }
  }, [view, cursor, events, locale, language, now])

  // ────── Frame title (centered) ──────
  const frameTitle = useMemo(() => {
    if (view === 'month') {
      const m = cursor.toLocaleDateString(locale, { month: 'long' })
      return `${language === 'es' ? `${m.charAt(0).toUpperCase() + m.slice(1)} de` : m.toUpperCase()} ${cursor.getFullYear()}`.toUpperCase()
    }
    if (view === 'week') {
      const ws = startOfWeekMon(cursor)
      const we = addDays(ws, 6)
      const monthShort = ws.toLocaleDateString(locale, { month: 'short' }).replace('.', '')
      return `${ws.getDate()} – ${we.getDate()} ${monthShort} ${ws.getFullYear()}`.toUpperCase()
    }
    return cursor.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
  }, [view, cursor, locale, language])

  // ────── Navigation ──────
  const navPrev = () => {
    if (view === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (view === 'week') setCursor(d => addDays(d, -7))
    else setCursor(d => addDays(d, -1))
  }
  const navNext = () => {
    if (view === 'month') setCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (view === 'week') setCursor(d => addDays(d, 7))
    else setCursor(d => addDays(d, 1))
  }
  const navToday = () => setCursor(new Date())

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-[600px]" />
      </div>
    )
  }

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">

      {/* Contextual top-bar (live clock + week + avg + urgent) */}
      <DashMetaBar
        weekIndex={isoWeekOf(now)}
        weekTotal={52}
        avg={weightedAvg}
        alertDueLabel={alertDueLabel}
      />

      {/* Page header */}
      <header className="cal-head">
        <div className="cal-head__left">
          <span className="kicker">{headerText.eyebrow}</span>
          <h1 className="cal-head__title">
            {headerText.titleHead}{' '}<span className="serif">{headerText.titleEm}</span>
          </h1>
          <p className="cal-head__sub">{headerText.sub}</p>
        </div>
        <div className="cal-head__actions">
          <div className="cal-seg" role="tablist" aria-label="Calendar view">
            {(['month', 'week', 'day'] as CalView[]).map(v => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                className={`cal-seg__btn ${view === v ? 'is-active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'day' ? t('calendar.day') : v === 'week' ? t('calendar.week') : t('calendar.month')}
              </button>
            ))}
          </div>
          <button className="cal-head__today" onClick={navToday}>
            <span className="material-symbols-outlined">calendar_today</span>
            {t('calendar.today')}
          </button>
          <button className="cal-head__new" onClick={() => alert(t('calendar.addExam'))}>
            <span className="material-symbols-outlined">add</span>
            {language === 'es' ? 'Nuevo' : 'New'}
          </button>
        </div>
      </header>

      {/* Frame */}
      <div className="cal-frame">
        <div className="cal-frame__toolbar">
          <button className="cal-iconbtn" onClick={navPrev} aria-label="Previous">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button className="cal-iconbtn" onClick={navNext} aria-label="Next">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <button className="cal-frame__today" onClick={navToday}>{t('calendar.today')}</button>
          <span className="cal-frame__title">{frameTitle}</span>
        </div>

        {view === 'month' && (
          <MonthView cursor={cursor} events={events} now={now} locale={locale} onPick={setPicked} />
        )}
        {view === 'week' && (
          <WeekView cursor={cursor} events={events} now={now} locale={locale} onPick={setPicked} />
        )}
        {view === 'day' && (
          <DayView cursor={cursor} events={events} now={now} locale={locale} language={language} onPick={setPicked} />
        )}
      </div>

      {/* Event detail modal */}
      {picked && (
        <div className="modal-overlay" onClick={() => setPicked(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: picked.subjectColor }} />
                <div>
                  <span className="mono text-[9px] uppercase tracking-widest block" style={{ color: 'var(--color-outline)' }}>
                    {picked.type === 'exam'
                      ? (picked.activityType
                          ? (language === 'en' ? ACTIVITY_TYPES[picked.activityType].label_en : ACTIVITY_TYPES[picked.activityType].label_es)
                          : t('nav.exams'))
                      : picked.type === 'task' ? t('nav.tasks') : t('subjects.schedules')}
                  </span>
                  <h2 className="font-bold text-base" style={{ color: 'var(--on-surface)' }}>{picked.title}</h2>
                </div>
              </div>
              <button onClick={() => setPicked(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ color: 'var(--color-outline)' }} aria-label={t('common.close')}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {picked.start && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>calendar_today</span>
                  {picked.start.toLocaleString(locale, { dateStyle: 'medium', ...(picked.allDay ? {} : { timeStyle: 'short', hour12: false }) })}
                  {picked.end && !picked.allDay && ` — ${hhmm(picked.end)}`}
                </div>
              )}
              {picked.professor && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>person</span>
                  {picked.professor}
                </div>
              )}
              {picked.location && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>location_on</span>
                  {picked.location}
                </div>
              )}
              {picked.percentage != null && (
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>percent</span>
                  <span className="mono text-sm font-bold" style={{ color: picked.subjectColor }}>{picked.percentage}%</span>
                </div>
              )}
              {picked.notes && (
                <div className="flex items-start gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px] mt-0.5" style={{ color: 'var(--color-outline)' }}>sticky_note_2</span>
                  {picked.notes}
                </div>
              )}
            </div>
            <button onClick={() => setPicked(null)} className="btn-secondary w-full mt-5">{t('common.close')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────  MONTH VIEW  ───────────────────────────── */
function MonthView({
  cursor, events, now, locale, onPick,
}: {
  cursor: Date
  events: CalEvent[]
  now: Date
  locale: string
  onPick: (e: CalEvent) => void
}) {
  const start = startOfMonthGrid(cursor)
  const days: Date[] = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const dowHeaders = Array.from({ length: 7 }, (_, i) =>
    addDays(start, i).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 3).toUpperCase()
  )

  const eventsForDay = (d: Date) =>
    events
      .filter(e => isSameDay(e.start, d))
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1
        if (!a.allDay && b.allDay) return 1
        return a.start.getTime() - b.start.getTime()
      })

  return (
    <div className="cal-month">
      <div className="cal-month__head">
        {dowHeaders.map((h, i) => <div key={i} className="cal-month__dow">{h}</div>)}
      </div>
      <div className="cal-month__grid">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const isTd = isSameDay(d, now)
          const dayEvents = eventsForDay(d)
          const visible = dayEvents.slice(0, 3)
          const overflow = dayEvents.length - visible.length
          return (
            <div key={i} className={`cal-month__cell ${inMonth ? '' : 'is-other'} ${isTd ? 'is-today' : ''}`}>
              <div className="cal-month__num-row">
                <span className="cal-month__num">{d.getDate()}</span>
              </div>
              <div className="cal-month__events">
                {visible.map(ev => {
                  const icon = ev.type === 'exam'
                    ? (ACTIVITY_TYPES[ev.activityType ?? 'exam'].icon)
                    : ev.type === 'task' ? 'task_alt' : null
                  return (
                    <button
                      key={ev.id}
                      className={`cal-evchip ${ev.tagClass} ${ev.type === 'task' ? 'cal-evchip--task' : ''} ${ev.status === 'urgent' ? 'cal-evchip--urgent' : ''}`}
                      onClick={() => onPick(ev)}
                      title={ev.title}
                    >
                      {icon && <span className="material-symbols-outlined cal-evchip__icon">{icon}</span>}
                      <span className="cal-evchip__title">{ev.title}</span>
                    </button>
                  )
                })}
                {overflow > 0 && (
                  <span className="cal-month__more">+{overflow} {locale.startsWith('es') ? 'más' : 'more'}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────  WEEK VIEW  ───────────────────────────── */
function WeekView({
  cursor, events, now, locale, onPick,
}: {
  cursor: Date
  events: CalEvent[]
  now: Date
  locale: string
  onPick: (e: CalEvent) => void
}) {
  const ws = startOfWeekMon(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const hours = Array.from({ length: SLOT_HOURS + 1 }, (_, i) => SLOT_START + i)

  const eventsForDay = (d: Date) => events.filter(e => isSameDay(e.start, d))

  return (
    <div className="cal-wk">
      {/* Day headers */}
      <div className="cal-wk__row-head">
        <div />
        {days.map((d, i) => {
          const isTd = isSameDay(d, now)
          const dayName = d.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').toUpperCase()
          return (
            <div key={i} className={`cal-wk__day-head ${isTd ? 'is-today' : ''}`}>
              <span className="cal-wk__dow">{dayName}</span>
              <span className="cal-wk__dnum">{d.getDate()}</span>
            </div>
          )
        })}
      </div>

      {/* All-day strip */}
      <div className="cal-wk__row-allday">
        <div className="cal-wk__allday-label">all-day</div>
        {days.map((d, i) => {
          const isTd = isSameDay(d, now)
          const dayEvents = eventsForDay(d).filter(e => e.allDay)
          return (
            <div key={i} className={`cal-wk__allday-cell ${isTd ? 'is-today' : ''}`}>
              {dayEvents.map(ev => (
                <button
                  key={ev.id}
                  className={`cal-evchip cal-evchip--allday ${ev.tagClass} ${ev.type === 'task' ? 'cal-evchip--task' : ''} ${ev.status === 'urgent' ? 'cal-evchip--urgent' : ''}`}
                  onClick={() => onPick(ev)}
                >
                  {ev.status === 'urgent' && <span className="material-symbols-outlined cal-evchip__icon">flag</span>}
                  {ev.type === 'task' && ev.status !== 'urgent' && <span className="material-symbols-outlined cal-evchip__icon">task_alt</span>}
                  <span className="cal-evchip__title">{ev.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {/* Timegrid */}
      <div className="cal-wk__grid">
        <div className="cal-wk__times">
          {hours.map(h => (
            <div key={h} className="cal-wk__hour-label">{pad(h)}:00</div>
          ))}
        </div>
        {days.map((d, i) => {
          const isTd = isSameDay(d, now)
          const dayEvents = eventsForDay(d).filter(e => !e.allDay && e.end)
          return (
            <div key={i} className={`cal-wk__col ${isTd ? 'is-today' : ''}`} style={{ height: ROW_PX * SLOT_HOURS }}>
              {hours.slice(0, -1).map(h => (
                <div key={h} className="cal-wk__row" style={{ top: (h - SLOT_START) * ROW_PX, height: ROW_PX }} />
              ))}
              {isTd && now.getHours() >= SLOT_START && now.getHours() < SLOT_END && (
                <div className="cal-wk__now" style={{ top: topPxFor(now) }}>
                  <span className="cal-wk__now-dot" />
                </div>
              )}
              {dayEvents.map(ev => {
                const top = topPxFor(ev.start)
                const h = heightPxFor(ev.start, ev.end!)
                const evIcon = ev.type === 'exam' ? ACTIVITY_TYPES[ev.activityType ?? 'exam'].icon : null
                return (
                  <button
                    key={ev.id}
                    className={`cal-evcard ${ev.tagClass} ${ev.type === 'exam' ? 'cal-evcard--exam' : ''} ${ev.status === 'live' ? 'cal-evcard--live' : ''} ${ev.status === 'completed' ? 'cal-evcard--done' : ''}`}
                    style={{ top, height: h }}
                    onClick={() => onPick(ev)}
                  >
                    {(evIcon || ev.status === 'live' || ev.status === 'completed') && (
                      <div className="cal-evcard__head">
                        {evIcon && <span className="material-symbols-outlined cal-evcard__icon">{evIcon}</span>}
                        {ev.status === 'live' && <span className="cal-evcard__dot" aria-label="live" />}
                        {ev.status === 'completed' && <span className="material-symbols-outlined cal-evcard__check">check_circle</span>}
                      </div>
                    )}
                    <span className="cal-evcard__title">{ev.title}</span>
                    {(ev.location || ev.end) && (
                      <span className="cal-evcard__foot">
                        {ev.end && `${hhmm(ev.start)}–${hhmm(ev.end)}`}
                        {ev.location && ev.end && ' · '}
                        {ev.location && ev.location}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────  DAY VIEW  ───────────────────────────── */
function DayView({
  cursor, events, now, locale, language, onPick,
}: {
  cursor: Date
  events: CalEvent[]
  now: Date
  locale: string
  language: 'es' | 'en'
  onPick: (e: CalEvent) => void
}) {
  const dayEvents = events.filter(e => isSameDay(e.start, cursor))
  const allDay = dayEvents.filter(e => e.allDay)
  const timed = dayEvents.filter(e => !e.allDay && e.end).sort((a, b) => a.start.getTime() - b.start.getTime())
  const isTd = isSameDay(cursor, now)
  const hours = Array.from({ length: SLOT_HOURS + 1 }, (_, i) => SLOT_START + i)
  const dayLabel = cursor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()

  return (
    <div className="cal-day">
      <div className="cal-day__head">
        <span className="cal-day__head-label">{dayLabel}</span>
      </div>

      {/* Urgent banner (all-day + status urgent) */}
      {allDay.filter(e => e.status === 'urgent').map(ev => (
        <button key={ev.id} className="cal-day__urgent" onClick={() => onPick(ev)}>
          <span className="material-symbols-outlined">flag</span>
          <strong>{ev.title}</strong>
          <span className="cal-day__urgent-meta">
            {language === 'es' ? 'cierra hoy 23:59' : 'closes today 23:59'}
          </span>
        </button>
      ))}

      {/* Other all-day pills */}
      {allDay.filter(e => e.status !== 'urgent').length > 0 && (
        <div className="cal-day__allday">
          <div className="cal-day__allday-label">all-day</div>
          <div className="cal-day__allday-list">
            {allDay.filter(e => e.status !== 'urgent').map(ev => (
              <button
                key={ev.id}
                className={`cal-evchip cal-evchip--allday ${ev.tagClass} ${ev.type === 'task' ? 'cal-evchip--task' : ''}`}
                onClick={() => onPick(ev)}
              >
                <span className="cal-evchip__title">{ev.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timegrid (single column) */}
      <div className="cal-day__grid">
        <div className="cal-day__times">
          {hours.map(h => (
            <div key={h} className="cal-day__hour-label">{pad(h)}:00</div>
          ))}
        </div>
        <div className="cal-day__col" style={{ height: ROW_PX * SLOT_HOURS }}>
          {hours.slice(0, -1).map(h => (
            <div key={h} className="cal-day__row" style={{ top: (h - SLOT_START) * ROW_PX, height: ROW_PX }} />
          ))}
          {isTd && now.getHours() >= SLOT_START && now.getHours() < SLOT_END && (
            <div className="cal-day__now" style={{ top: topPxFor(now) }}><span className="cal-day__now-dot" /></div>
          )}
          {timed.map(ev => {
            const top = topPxFor(ev.start)
            const h = heightPxFor(ev.start, ev.end!)
            const status = ev.status
            return (
              <button
                key={ev.id}
                className={`cal-day-card ${ev.tagClass} ${ev.type === 'exam' ? 'cal-day-card--exam' : ''} ${status === 'live' ? 'cal-day-card--live' : ''} ${status === 'completed' ? 'cal-day-card--done' : ''}`}
                style={{ top, height: h }}
                onClick={() => onPick(ev)}
              >
                {(status === 'completed' || status === 'live') && (
                  <div className="cal-day-card__head">
                    {status === 'completed' && (
                      <span className="cal-day-card__badge cal-day-card__badge--done">
                        <span className="material-symbols-outlined">check_circle</span>
                        {language === 'es' ? 'Completada' : 'Completed'}
                      </span>
                    )}
                    {status === 'live' && (
                      <span className="cal-day-card__badge cal-day-card__badge--live">
                        <span className="cal-day-card__pulse" />
                        {language === 'es' ? 'EN VIVO' : 'LIVE'}
                      </span>
                    )}
                  </div>
                )}
                <h3 className="cal-day-card__title">{ev.title}</h3>
                <div className="cal-day-card__foot">
                  {hhmm(ev.start)} — {hhmm(ev.end!)}
                  {ev.location && ` · ${ev.location}`}
                  {ev.professor && ` · ${ev.professor}`}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
