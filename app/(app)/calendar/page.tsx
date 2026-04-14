'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { uniqueById } from '@/lib/utils'
import type { Subject, Schedule, Exam, Task } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { useTimeFormat } from '@/hooks/useTimeFormat'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, DateSelectArg, EventClickArg } from '@fullcalendar/core'

interface ClickedEvent {
  type: 'exam' | 'schedule' | 'task'
  title: string
  date?: string
  location?: string
  notes?: string
  color?: string
  professor?: string
  priority?: string
  subjectName?: string
  taskStatus?: string
  activityType?: string
  percentage?: number | null
}

const SANCTUARY_CALENDAR_CSS = `
  /* ─── Reset ─────────────────────────────────── */
  .fc { font-family: 'Inter', system-ui, sans-serif !important; }
  .fc *:focus { outline: none !important; box-shadow: none !important; }

  /* ─── Scrollgrid borders (ghost) ─────────────── */
  .fc .fc-scrollgrid { border: none !important; border-radius: 0 !important; }
  .fc td, .fc th { border-color: var(--border-subtle) !important; }
  .fc .fc-scrollgrid-section > td,
  .fc .fc-scrollgrid-section > th { border: none !important; }

  /* ─── Toolbar ────────────────────────────────── */
  .fc .fc-toolbar {
    padding: 14px 20px 12px !important;
    margin-bottom: 0 !important;
    gap: 12px !important;
    flex-wrap: wrap !important;
  }
  .fc .fc-toolbar-title {
    font-size: 18px !important;
    font-weight: 800 !important;
    letter-spacing: -0.03em !important;
    color: var(--on-surface) !important;
    text-transform: uppercase !important;
  }

  /* ─── Buttons ────────────────────────────────── */
  .fc .fc-button,
  .fc .fc-button-primary {
    background: transparent !important;
    border: 1px solid var(--border-strong) !important;
    color: var(--color-outline) !important;
    border-radius: 999px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    padding: 4px 13px !important;
    line-height: 1.4 !important;
    transition: all 0.15s ease !important;
    box-shadow: none !important;
    text-transform: none !important;
    text-shadow: none !important;
  }
  .fc .fc-button:hover,
  .fc .fc-button-primary:hover {
    background: color-mix(in srgb, var(--on-surface) 5%, transparent) !important;
    color: var(--on-surface) !important;
    border-color: var(--border-strong) !important;
  }
  .fc .fc-button:disabled { opacity: 0.3 !important; }

  .fc .fc-button-primary:not(:disabled).fc-button-active,
  .fc .fc-button-primary:not(:disabled):active {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent) !important;
    color: var(--color-primary) !important;
    border-color: color-mix(in srgb, var(--color-primary) 25%, transparent) !important;
    box-shadow: none !important;
  }
  .fc .fc-today-button {
    border-color: color-mix(in srgb, var(--color-primary) 25%, transparent) !important;
    color: var(--color-primary) !important;
  }
  .fc .fc-today-button:not(:disabled):hover {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
    color: var(--color-primary) !important;
  }
  .fc .fc-prev-button,
  .fc .fc-next-button { padding: 4px 8px !important; }

  /* ─── Column headers ─────────────────────────── */
  .fc .fc-col-header { background: transparent !important; }
  .fc .fc-col-header-cell {
    background: transparent !important;
    border-color: var(--border-subtle) !important;
    padding: 8px 0 !important;
  }
  .fc .fc-col-header-cell-cushion {
    color: var(--color-outline) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.15em !important;
    text-decoration: none !important;
    padding: 0 !important;
  }

  /* ─── Day cells ──────────────────────────────── */
  .fc .fc-daygrid-day {
    background: transparent !important;
    transition: background-color 0.15s ease !important;
  }
  .fc .fc-daygrid-day:hover { background: color-mix(in srgb, var(--on-surface) 2%, transparent) !important; }
  .fc .fc-daygrid-day.fc-day-other { opacity: 0.35 !important; }

  /* Weekends slightly dimmer */
  .fc .fc-day-sat,
  .fc .fc-day-sun { background: color-mix(in srgb, var(--on-surface) 3%, transparent) !important; }

  /* Today highlight — stronger prominence */
  .fc .fc-day-today {
    background: color-mix(in srgb, var(--color-primary) 9%, transparent) !important;
    box-shadow: inset 0 2px 0 var(--color-primary) !important;
  }
  .fc .fc-day-today .fc-daygrid-day-number {
    background: var(--color-primary) !important;
    color: var(--on-primary) !important;
    border-radius: 50% !important;
    width: 26px !important;
    height: 26px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 800 !important;
  }

  /* Past days — attenuated so "what's coming" reads first */
  .fc .fc-day-past { opacity: 0.42 !important; }
  .fc .fc-day-past:hover { opacity: 0.68 !important; transition: opacity 0.15s ease !important; }

  /* Future days — full clarity */
  .fc .fc-day-future { opacity: 1 !important; }

  /* Day numbers */
  .fc .fc-daygrid-day-number {
    color: var(--color-outline) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    padding: 8px 10px !important;
    text-decoration: none !important;
  }

  /* ─── Events ─────────────────────────────────── */
  .fc .fc-event {
    border: none !important;
    border-left: 3px solid !important;
    border-radius: 5px !important;
    font-size: 10.5px !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
    padding: 2px 5px !important;
    cursor: pointer !important;
    transition: opacity 0.15s, transform 0.15s !important;
    backdrop-filter: none !important;
  }
  .fc .fc-event:hover {
    opacity: 0.85 !important;
    transform: translateY(-1px) !important;
  }
  .fc .fc-event-main { color: inherit !important; }
  .fc .fc-event-title { font-weight: 600 !important; }

  /* Time grid events */
  .fc .fc-timegrid-event {
    border-radius: 6px !important;
    padding: 3px 6px !important;
  }

  /* ─── Time grid ──────────────────────────────── */
  .fc .fc-timegrid-slot-label-cushion {
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    color: var(--color-outline) !important;
    padding-right: 12px !important;
  }

  /* Week/Day events: enforce minimum 48px height */
  .fc .fc-timegrid-event { min-height: 48px !important; }
  .fc .fc-timegrid-now-indicator-line {
    border-color: var(--color-primary) !important;
    border-width: 2px !important;
    opacity: 0.9 !important;
  }
  .fc .fc-timegrid-now-indicator-arrow {
    border-top-color: var(--color-primary) !important;
    border-bottom-color: var(--color-primary) !important;
    opacity: 0.9 !important;
    border-width: 5px !important;
  }

  /* ─── Popover (more events) ──────────────────── */
  .fc .fc-more-popover {
    background: var(--s-high) !important;
    border: 1px solid var(--border-default) !important;
    border-radius: 16px !important;
    box-shadow: 0 16px 48px var(--overlay-bg) !important;
    overflow: hidden !important;
  }
  .fc .fc-more-popover .fc-popover-header {
    background: var(--s-base) !important;
    color: var(--on-surface) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.1em !important;
    padding: 10px 14px !important;
  }
  .fc .fc-more-popover .fc-popover-close {
    color: var(--color-outline) !important;
    opacity: 1 !important;
  }
  .fc .fc-popover-body { padding: 8px !important; }
  .fc .fc-daygrid-more-link {
    color: var(--color-primary) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    text-decoration: none !important;
  }
  .fc .fc-daygrid-more-link:hover { color: var(--on-surface) !important; }

  /* ─── All-day row (timegrid) ─────────────────── */
  .fc .fc-timegrid-axis { border-color: var(--border-subtle) !important; }
  .fc .fc-timegrid-col { border-color: var(--border-subtle) !important; }
  .fc .fc-highlight { background: color-mix(in srgb, var(--color-primary) 8%, transparent) !important; }

  /* ─── List view ──────────────────────────────── */
  .fc .fc-list-day-cushion {
    background: var(--s-low) !important;
    color: var(--color-outline) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 10px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.15em !important;
  }
  .fc .fc-list-event:hover td { background: color-mix(in srgb, var(--on-surface) 2%, transparent) !important; }
  .fc .fc-list-empty { background: transparent !important; color: var(--color-outline) !important; }

  /* ─── Slot height (timegrid) ────────────────── */
  .fc .fc-timegrid-slot-lane { height: 30px !important; }
  .fc .fc-timegrid-slot-label { height: 30px !important; }

  /* ─── Event type differentiation ────────────── */

  /* Schedule (class) — solid left accent, show prominently */
  .fc-ev-schedule { border-left-width: 4px !important; }

  /* Exam — thicker border, distinct label prefix via title (added in JS) */
  .fc-ev-exam {
    border-left-width: 4px !important;
    font-weight: 700 !important;
  }
  .fc-ev-exam .fc-event-title {
    font-weight: 700 !important;
    letter-spacing: 0.01em !important;
  }

  /* Task — dashed left border signals "deadline", not "block" */
  .fc-ev-task {
    border-left-style: dashed !important;
    border-left-width: 3px !important;
  }

  /* ─── Daygrid events (month view) — compact text pills ────────── */
  .fc .fc-daygrid-event {
    border-radius: 4px !important;
    padding: 1px 4px !important;
    margin: 1px 2px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    overflow: hidden !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
  }
  .fc .fc-daygrid-day-events {
    padding: 2px 4px !important;
    min-height: 14px !important;
  }

  /* ─── Room/location sub-label in timegrid ────── */
  .fc-ev-location {
    font-size: 9.5px !important;
    font-weight: 500 !important;
    opacity: 0.72 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    display: block !important;
    margin-top: 1px !important;
  }

  /* ─── Month day cells — more breathing room ──── */
  .fc .fc-daygrid-day-frame { min-height: 80px !important; }
  .fc .fc-daygrid-day-top { padding: 4px 6px !important; }
  .fc .fc-daygrid-day-number {
    padding: 4px 8px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
  }

  /* ─── Week view: allow horizontal scroll to show all days (desktop) ── */
  .fc-timeGridWeek-view .fc-scrollgrid { overflow-x: auto !important; }
  .fc-timeGridWeek-view .fc-scrollgrid-sync-table { min-width: 560px !important; }
  .fc-timeGridWeek-view .fc-col-header { min-width: 560px !important; }
  .fc-timeGridWeek-view .fc-timegrid-body { min-width: 560px !important; }
  /* Week view event titles — allow wrapping so full name shows */
  .fc-timeGridWeek-view .fc-event-title {
    white-space: normal !important;
    word-break: break-word !important;
    line-height: 1.2 !important;
  }

  /* ─── Scrollbar ──────────────────────────────── */
  .fc ::-webkit-scrollbar { width: 4px; height: 4px; }
  .fc ::-webkit-scrollbar-track { background: transparent; }
  .fc ::-webkit-scrollbar-thumb { background: var(--s-highest); border-radius: 4px; }

  /* ─── Mobile overrides ───────────────────────── */
  @media (max-width: 768px) {

    /* ── Toolbar: 2-row layout ── */
    .fc .fc-toolbar {
      display: grid !important;
      grid-template-columns: auto 1fr auto !important;
      grid-template-rows: auto auto !important;
      padding: 8px 10px 6px !important;
      gap: 5px 6px !important;
      margin-bottom: 0 !important;
      align-items: center !important;
    }
    /* Row 1: [nav arrows + today] [title] [— empty —] */
    .fc .fc-toolbar-chunk:first-child {
      grid-column: 1; grid-row: 1;
      display: flex; align-items: center; gap: 3px;
    }
    .fc .fc-toolbar-chunk:nth-child(2) {
      grid-column: 2; grid-row: 1;
      display: flex; justify-content: center;
    }
    /* Row 2: view switcher centered across all columns */
    .fc .fc-toolbar-chunk:last-child {
      grid-column: 1 / -1; grid-row: 2;
      display: flex; justify-content: center; gap: 4px;
    }
    .fc .fc-toolbar-title {
      font-size: 12px !important;
      letter-spacing: -0.01em !important;
    }
    .fc .fc-button,
    .fc .fc-button-primary {
      font-size: 9px !important;
      padding: 3px 9px !important;
    }
    .fc .fc-prev-button,
    .fc .fc-next-button { padding: 3px 6px !important; }

    /* ── Month view: compact cells ── */
    .fc .fc-daygrid-day-frame { min-height: 44px !important; }
    .fc .fc-daygrid-day-top { padding: 2px 3px !important; }
    .fc .fc-daygrid-day-number {
      font-size: 9px !important;
      padding: 2px 3px !important;
      line-height: 1.3 !important;
    }
    .fc .fc-day-today .fc-daygrid-day-number {
      width: 18px !important;
      height: 18px !important;
      font-size: 9px !important;
    }
    .fc .fc-col-header-cell-cushion {
      font-size: 9px !important;
      letter-spacing: 0.04em !important;
      padding: 4px 2px !important;
    }

    /* Month events: single-line pill, title only */
    .fc .fc-daygrid-event {
      font-size: 7.5px !important;
      padding: 1px 3px !important;
      border-radius: 3px !important;
      margin-bottom: 1px !important;
      line-height: 1.4 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      max-width: 100% !important;
    }
    .fc .fc-daygrid-event-dot { display: none !important; }
    .fc .fc-daygrid-more-link {
      font-size: 8px !important;
      font-weight: 700 !important;
      padding: 0 2px !important;
    }
    .fc .fc-daygrid-body-natural .fc-daygrid-day-events { padding-bottom: 2px !important; }

    /* Today box-shadow stays visible but smaller on mobile */
    .fc .fc-day-today { box-shadow: inset 0 1.5px 0 var(--color-primary) !important; }

    /* ── Week / Day views ── */
    .fc-timeGridWeek-view .fc-scrollgrid { overflow-x: visible !important; }
    .fc-timeGridWeek-view .fc-scrollgrid-sync-table { min-width: 0 !important; }
    .fc-timeGridWeek-view .fc-col-header { min-width: 0 !important; }
    .fc-timeGridWeek-view .fc-timegrid-body { min-width: 0 !important; }

    .fc .fc-timegrid-slot-lane { height: 28px !important; }
    .fc .fc-timegrid-slot-label { height: 28px !important; }
    .fc .fc-timegrid-slot-label-cushion { font-size: 9px !important; padding-right: 3px !important; }
    .fc .fc-timegrid-axis { width: 34px !important; }
    .fc .fc-timegrid-event { min-height: 28px !important; font-size: 10px !important; padding: 2px 3px !important; border-radius: 4px !important; }
    .fc-timeGridDay-view .fc-timegrid-event { min-height: 48px !important; font-size: 11px !important; }
    .fc .fc-timegrid-event .fc-event-title { font-size: 10px !important; line-height: 1.2 !important; white-space: normal !important; word-break: break-word !important; }
  }
`

export default function CalendarPage() {
  const { t, language } = useTranslation()
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [schedules,     setSchedules]     = useState<Schedule[]>([])
  const [exams,         setExams]         = useState<Exam[]>([])
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [loading,       setLoading]       = useState(true)
  const [clickedEvent,  setClickedEvent]  = useState<ClickedEvent | null>(null)
  const [initialView,   setInitialView]   = useState('dayGridMonth')
  const [legendOpen,    setLegendOpen]    = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)
  const { use12h } = useTimeFormat()
  const [addExamDate,  setAddExamDate]  = useState<string | null>(null)

  const [newExamTitle,   setNewExamTitle]   = useState('')
  const [newExamSubject, setNewExamSubject] = useState('')
  const [newExamTime,    setNewExamTime]    = useState('')
  const [addingExam,     setAddingExam]     = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) {
      setInitialView('timeGridDay')
      setIsMobile(true)
    }
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

  // Build events
  const events: EventInput[] = []

  schedules.forEach((s) => {
    const subject = subjects.find(sub => sub.id === s.subject_id)
    if (!subject) return
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end   = new Date(today.getFullYear(), today.getMonth() + 3, 0)
    const cursor = new Date(start)
    while (cursor <= end) {
      if (cursor.getDay() === s.day_of_week) {
        const dateStr = cursor.toISOString().split('T')[0]
        const room = s.room || subject.room
        events.push({
          id:              `schedule-${s.id}-${dateStr}`,
          title:           subject.name,
          start:           `${dateStr}T${s.start_time}`,
          end:             `${dateStr}T${s.end_time}`,
          backgroundColor: `color-mix(in srgb, ${subject.color} 50%, var(--s-base))`,
          borderColor:     subject.color,
          textColor:       subject.color,
          classNames:      ['fc-ev-schedule'],
          extendedProps:   { type: 'schedule', location: room, professor: subject.professor },
        })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  })

  exams.forEach((e) => {
    const subject   = subjects.find(s => s.id === e.subject_id)
    const typeCfg   = ACTIVITY_TYPES[e.activity_type || 'exam']
    const typeColor = typeCfg.color
    events.push({
      id:              `exam-${e.id}`,
      title:           e.title,
      start:           e.exam_time ? `${e.exam_date}T${e.exam_time}` : e.exam_date,
      allDay:          !e.exam_time,
      backgroundColor: `color-mix(in srgb, ${typeColor} 35%, var(--s-base))`,
      borderColor:     typeColor,
      textColor:       typeColor,
      classNames:      ['fc-ev-exam'],
      extendedProps:   {
        type: 'exam', subjectName: subject?.name, location: e.location, notes: e.notes,
        activityType: e.activity_type || 'exam', percentage: e.percentage,
      },
    })
  })

  tasks.forEach((task) => {
    if (!task.due_date || task.is_done) return
    const subject = subjects.find(s => s.id === task.subject_id)
    // Use subject color if available, otherwise priority color
    const color = subject?.color
      || (task.priority === 'high' ? '#ef4444' : task.priority === 'mid' ? '#f59e0b' : '#60a5fa')
    events.push({
      id:              `task-${task.id}`,
      title:           task.text,
      start:           task.due_date,
      allDay:          true,
      backgroundColor: `color-mix(in srgb, ${color} 28%, var(--s-base))`,
      borderColor:     color,
      textColor:       color,
      classNames:      ['fc-ev-task'],
      extendedProps:   { type: 'task', priority: task.priority, subjectName: subject?.name, taskStatus: task.status },
    })
  })

  const handleEventClick = (info: EventClickArg) => {
    const p = info.event.extendedProps
    setClickedEvent({
      type:         p.type,
      title:        info.event.title,
      date:         info.event.startStr,
      location:     p.location,
      notes:        p.notes,
      color:        info.event.borderColor,
      professor:    p.professor,
      priority:     p.priority,
      subjectName:  p.subjectName,
      taskStatus:   p.taskStatus,
      activityType: p.activityType,
      percentage:   p.percentage,
    })
  }

  const handleDateSelect = (info: DateSelectArg) => {
    setAddExamDate(info.startStr.split('T')[0])
  }

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newExamTitle.trim() || !addExamDate) return
    setAddingExam(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('exams').insert({
      user_id:    user.id,
      title:      newExamTitle.trim(),
      exam_date:  addExamDate,
      exam_time:  newExamTime || null,
      subject_id: newExamSubject || null,
    })
    setAddExamDate(null); setNewExamTitle(''); setNewExamSubject(''); setNewExamTime('')
    setAddingExam(false); fetchData()
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="skeleton h-12 w-64" />
        <div className="skeleton h-[600px]" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">

      {/* Page header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="mono text-[10px] tracking-[0.2em] uppercase font-medium block mb-0.5"
            style={{ color: 'var(--color-primary)' }}>Academic Timeline</span>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {t('calendar.title')}
          </h1>
        </div>
        {/* Legend toggle — mobile only */}
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            backgroundColor: legendOpen ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--s-low)',
            color: legendOpen ? 'var(--color-primary)' : 'var(--color-outline)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="material-symbols-outlined text-[14px]">legend_toggle</span>
          {legendOpen ? t('common.close') : 'Leyenda'}
        </button>
      </div>

      {/* Legend — always visible on desktop, collapsible on mobile */}
      <div className={`mb-4 rounded-xl p-3 ${legendOpen ? 'flex' : 'hidden lg:flex'} flex-wrap gap-x-4 gap-y-2`}
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        {subjects.map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs font-medium" style={{ color: 'var(--on-surface-variant)' }}>{s.name}</span>
          </div>
        ))}
        {exams.length > 0 && (
          (Object.keys(ACTIVITY_TYPES) as Array<keyof typeof ACTIVITY_TYPES>).filter(k =>
            exams.some(e => (e.activity_type || 'exam') === k)
          ).map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: ACTIVITY_TYPES[k].color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--on-surface-variant)' }}>
                {language === 'en' ? ACTIVITY_TYPES[k].label_en : ACTIVITY_TYPES[k].label_es}
              </span>
            </div>
          ))
        )}
        {tasks.some(tk => !tk.is_done && tk.due_date) && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-dashed" style={{ borderColor: 'var(--warning)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--on-surface-variant)' }}>{t('nav.tasks')}</span>
          </div>
        )}
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
        <style>{SANCTUARY_CALENDAR_CSS}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={initialView}
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month'),
            week:  t('calendar.week'),
            day:   t('calendar.day'),
          }}
          events={events}
          eventClick={handleEventClick}
          selectable={true}
          select={handleDateSelect}
          height="auto"
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          scrollTime={(() => {
            const todayDow = new Date().getDay()
            const earliest = schedules
              .filter(s => s.day_of_week === todayDow)
              .map(s => s.start_time)
              .sort()[0]
            if (!earliest) return '07:00:00'
            const [h, m] = earliest.split(':').map(Number)
            const mins = Math.max(6 * 60, h * 60 + m - 30)
            return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`
          })()}
          slotLabelInterval="01:00:00"
          locale={language === 'en' ? 'en' : 'es'}
          eventTimeFormat={use12h
            ? { hour: 'numeric', minute: '2-digit', hour12: true }
            : { hour: '2-digit', minute: '2-digit', hour12: false }
          }
          slotLabelFormat={use12h
            ? { hour: 'numeric', minute: '2-digit', hour12: true }
            : { hour: '2-digit', minute: '2-digit', hour12: false }
          }
          views={{
            timeGridWeek: {
              dayHeaderFormat: isMobile
                ? { weekday: 'narrow' }
                : { weekday: 'short', day: 'numeric' },
              slotDuration: isMobile ? '00:30:00' : '00:30:00',
            },
            timeGridDay: {
              dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'short' },
              slotDuration: '00:30:00',
            },
          }}
          dayMaxEvents={isMobile ? 2 : 4}
          eventDisplay="block"
          nowIndicator={true}
          eventContent={(arg) => {
            const type = arg.event.extendedProps.type as string
            const isMonthView = arg.view.type === 'dayGridMonth'

            // Month view: compact text pill (title only, truncated for mobile)
            if (isMonthView) {
              const title = arg.event.title
              const displayTitle = isMobile && title.length > 12 ? title.slice(0, 11) + '…' : title
              return (
                <div style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '0 2px',
                  lineHeight: 1.4,
                }}>
                  {displayTitle}
                </div>
              )
            }

            // Custom render for schedule events: show room below title
            if (type === 'schedule') {
              const loc = arg.event.extendedProps.location as string | undefined
              const isWeekView = arg.view.type === 'timeGridWeek'
              const isDayView  = arg.view.type === 'timeGridDay'
              // Only truncate in mobile week view (7 narrow columns); day view gets full space
              const titleText = (isMobile && isWeekView && arg.event.title.length > 14)
                ? arg.event.title.slice(0, 13) + '…'
                : arg.event.title
              const titleSize = isDayView ? '12px' : '10.5px'
              return (
                <div style={{ padding: isDayView ? '4px 6px' : '2px 4px', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {arg.timeText && (!isMobile || isDayView) && (
                    <span style={{ fontSize: '8.5px', fontWeight: 500, opacity: 0.7, lineHeight: 1.2, display: 'block', whiteSpace: 'nowrap' }}>
                      {arg.timeText}
                    </span>
                  )}
                  <span style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', display: 'block' }}>
                    {titleText}
                  </span>
                  {loc && (!isMobile || isDayView) && (
                    <span className="fc-ev-location" style={{ fontSize: isDayView ? '10px' : undefined }}>
                      {loc}
                    </span>
                  )}
                </div>
              )
            }
            // Activity/Exam: type label + title
            if (type === 'exam') {
              const actType = (arg.event.extendedProps.activityType || 'exam') as keyof typeof ACTIVITY_TYPES
              const cfg = ACTIVITY_TYPES[actType]
              return (
                <div style={{ padding: '2px 4px', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, opacity: 0.75, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '9px', fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                    {cfg.label_es}
                  </span>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', display: 'block' }}>
                    {arg.event.title}
                  </span>
                </div>
              )
            }
            // Task: dashed border visually, prefix with check icon
            if (type === 'task') {
              const status = arg.event.extendedProps.taskStatus as string | undefined
              const statusIcon = status === 'done' ? '✓' : status === 'in_progress' ? '◑' : '○'
              return (
                <div style={{
                  padding: '1px 5px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  borderLeft: `2px dashed ${arg.event.borderColor}`,
                  borderRadius: '4px',
                  height: '100%',
                }}>
                  <span style={{ fontSize: '9px', flexShrink: 0, opacity: 0.8 }}>{statusIcon}</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {arg.event.title}
                  </span>
                </div>
              )
            }
            return undefined
          }}
        />
      </div>

      {/* Event detail modal */}
      {clickedEvent && (
        <div className="modal-overlay" onClick={() => setClickedEvent(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: clickedEvent.color || 'var(--color-primary)' }} />
                <div>
                  <span className="mono text-[9px] uppercase tracking-widest block"
                    style={{ color: 'var(--color-outline)' }}>
                    {clickedEvent.type === 'exam'
                      ? (clickedEvent.activityType
                          ? (language === 'en'
                              ? ACTIVITY_TYPES[clickedEvent.activityType as keyof typeof ACTIVITY_TYPES]?.label_en
                              : ACTIVITY_TYPES[clickedEvent.activityType as keyof typeof ACTIVITY_TYPES]?.label_es)
                          : t('nav.exams'))
                      : clickedEvent.type === 'task' ? t('nav.tasks') : t('subjects.schedules')}
                  </span>
                  <h2 className="font-bold text-base" style={{ color: 'var(--on-surface)' }}>
                    {clickedEvent.title}
                  </h2>
                </div>
              </div>
              <button onClick={() => setClickedEvent(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ color: 'var(--color-outline)' }} aria-label={t('common.close')}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {clickedEvent.subjectName && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>menu_book</span>
                  {clickedEvent.subjectName}
                </div>
              )}
              {clickedEvent.date && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>calendar_today</span>
                  {new Date(clickedEvent.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
              {clickedEvent.professor && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>person</span>
                  {clickedEvent.professor}
                </div>
              )}
              {clickedEvent.percentage != null && (
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>percent</span>
                  <span className="mono text-sm font-bold" style={{ color: clickedEvent.color || 'var(--on-surface)' }}>
                    {clickedEvent.percentage}%
                  </span>
                </div>
              )}
              {clickedEvent.priority && (
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>flag</span>
                  <span className="mono text-[11px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      backgroundColor: clickedEvent.priority === 'high' ? 'var(--priority-high-bg)' : clickedEvent.priority === 'mid' ? 'var(--priority-mid-bg)' : 'var(--priority-low-bg)',
                      color: clickedEvent.priority === 'high' ? 'var(--priority-high)' : clickedEvent.priority === 'mid' ? 'var(--priority-mid)' : 'var(--priority-low)',
                    }}>
                    {clickedEvent.priority === 'high' ? t('tasks.high') : clickedEvent.priority === 'mid' ? t('tasks.mid') : t('tasks.low')}
                  </span>
                </div>
              )}
              {clickedEvent.location && (
                <div className="flex items-center gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>location_on</span>
                  {clickedEvent.location}
                </div>
              )}
              {clickedEvent.notes && (
                <div className="flex items-start gap-2.5" style={{ color: 'var(--on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-[16px] mt-0.5" style={{ color: 'var(--color-outline)' }}>sticky_note_2</span>
                  {clickedEvent.notes}
                </div>
              )}
            </div>
            <button onClick={() => setClickedEvent(null)} className="btn-secondary w-full mt-5">{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* Add exam from date select */}
      {addExamDate && (
        <div className="modal-overlay" onClick={() => setAddExamDate(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()} role="dialog">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-soft)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>event_upcoming</span>
              </div>
              <div>
                <span className="mono text-[9px] uppercase tracking-widest block" style={{ color: 'var(--color-outline)' }}>
                  {addExamDate}
                </span>
                <h2 className="font-bold" style={{ color: 'var(--on-surface)' }}>{t('calendar.addExam')}</h2>
              </div>
            </div>
            <form onSubmit={handleAddExam} className="space-y-3">
              <div>
                <label htmlFor="newExamTitle" className="label">{t('exams.examTitle')} *</label>
                <input id="newExamTitle" className="input" value={newExamTitle}
                  onChange={e => setNewExamTitle(e.target.value)} aria-required="true" />
              </div>
              <div>
                <label htmlFor="newExamSubject" className="label">{t('tasks.subject')}</label>
                <select id="newExamSubject" className="input" value={newExamSubject}
                  onChange={e => setNewExamSubject(e.target.value)}>
                  <option value="">{t('tasks.noSubject')}</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="newExamTime" className="label">{t('exams.time')}</label>
                <input id="newExamTime" type="time" className="input" value={newExamTime}
                  onChange={e => setNewExamTime(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAddExamDate(null)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={addingExam} className="btn-primary flex-1">
                  {addingExam ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
