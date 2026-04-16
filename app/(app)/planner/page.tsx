'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { daysUntil, isToday, isTomorrow, uniqueById, uniqueByName, formatTime } from '@/lib/utils'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { TaskNotes } from '@/components/tasks/TaskNotes'
import type { Task, Exam, Subject, Schedule, Subtask, ActivityType, SubmissionStatus } from '@/types'
import { ACTIVITY_TYPES } from '@/types'

type TypeFilter       = 'all' | 'tasks' | 'exams' | 'assignments'
type StatusFilter     = 'all' | 'not_started' | 'in_progress' | 'completed'
type SubmissionFilter = 'all' | 'pending' | 'submitted' | 'graded' | 'ungraded'

// ─── Bottom sheet for creating items ─────────────────────────────────────────
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function CreateSheet({
  subjects,
  schedules,
  onClose,
  onSaved,
  defaultType = 'task',
}: {
  subjects: Subject[]
  schedules: Schedule[]
  onClose: () => void
  defaultType?: 'task' | 'exam' | 'assignment'
  onSaved: () => void
}) {
  const { t, language } = useTranslation()
  const [itemType,   setItemType]   = useState<'task' | 'exam' | 'assignment'>(defaultType)
  const [title,      setTitle]      = useState('')
  const [priority,   setPriority]   = useState<'high' | 'mid' | 'low'>('mid')
  const [subjectId,  setSubjectId]  = useState('')
  const [dueDate,    setDueDate]    = useState('')
  const [examTime,   setExamTime]   = useState('')
  const [location,   setLocation]   = useState('')
  const [percentage,  setPercentage]  = useState('')
  const [grade,       setGrade]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [scheduleDay, setScheduleDay] = useState<number | null>(null)

  const subjectSchedules = schedules.filter(s => s.subject_id === subjectId)

  // Auto-populate time + room based on selected subject's schedule
  useEffect(() => {
    setScheduleDay(null)
    if (itemType === 'task' || !subjectId) return
    const subject = subjects.find(s => s.id === subjectId)
    const scheds = schedules.filter(sc => sc.subject_id === subjectId)
    if (scheds.length === 1) {
      const sc = scheds[0]
      setLocation(sc.room || subject?.room || '')
      setExamTime(sc.start_time.slice(0, 5))
    } else if (scheds.length === 0 && subject?.room) {
      setLocation(subject.room)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, itemType])

  // When day is selected in multi-schedule case
  useEffect(() => {
    if (scheduleDay === null) return
    const subject = subjects.find(s => s.id === subjectId)
    const sc = schedules.find(sc => sc.subject_id === subjectId && sc.day_of_week === scheduleDay)
    if (sc) {
      setLocation(sc.room || subject?.room || '')
      setExamTime(sc.start_time.slice(0, 5))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDay])

  const handleSave = async () => {
    if (!title.trim()) { setError(t('auth.errors.required')); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    if (itemType === 'task') {
      await supabase.from('tasks').insert({
        user_id:    user.id,
        text:       title.trim(),
        priority,
        due_date:   dueDate || null,
        subject_id: subjectId || null,
        is_done:    false,
        status:     'not_started',
        position:   0,
      })
    } else {
      const activityType: ActivityType = itemType === 'exam' ? 'exam' : 'activity'
      await supabase.from('exams').insert({
        user_id:       user.id,
        title:         title.trim(),
        exam_date:     dueDate || new Date().toISOString().split('T')[0],
        exam_time:     examTime || null,
        location:      location.trim() || null,
        subject_id:    subjectId || null,
        activity_type: activityType,
        percentage:    percentage !== '' ? parseFloat(percentage) : null,
        grade:         grade !== '' ? parseFloat(grade) : null,
      })
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl animate-slide-up overflow-y-auto"
        style={{
          backgroundColor: 'var(--s-low)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.3)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          maxHeight: '90vh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border-strong)' }} />
        </div>

        <div className="px-5 space-y-4 pb-2">
          <h2 className="text-lg font-bold" style={{ color: 'var(--on-surface)' }}>
            {t('planner.add')}
          </h2>

          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'task',       label: t('planner.tasks'),       icon: 'task_alt',   color: 'var(--color-primary)' },
              { key: 'exam',       label: t('planner.exams'),       icon: 'school',     color: '#ef4444'              },
              { key: 'assignment', label: t('planner.assignments'), icon: 'assignment', color: '#8b5cf6'              },
            ] as const).map(({ key, label, icon, color }) => (
              <button
                key={key}
                type="button"
                onClick={() => setItemType(key)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all border text-xs font-semibold"
                style={{
                  backgroundColor: itemType === key ? `color-mix(in srgb, ${color} 12%, transparent)` : 'var(--s-base)',
                  borderColor:     itemType === key ? color : 'var(--border-subtle)',
                  color:           itemType === key ? color : 'var(--color-outline)',
                }}
              >
                <span className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: itemType === key ? "'FILL' 1" : "'FILL' 0" }}>
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="label">{t('planner.titlePlaceholder')}</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={itemType === 'task'
                ? (language === 'es' ? '¿Qué tienes que hacer?' : 'What do you need to do?')
                : (language === 'es' ? 'Título de la actividad' : 'Activity title')}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          {/* Priority — tasks only */}
          {itemType === 'task' && (
            <div>
              <label className="label">{t('planner.priority')}</label>
              <div className="flex gap-2">
                {([
                  { value: 'high', label: t('planner.high'), color: 'var(--priority-high)', bg: 'var(--priority-high-bg)' },
                  { value: 'mid',  label: t('planner.mid'),  color: 'var(--priority-mid)',  bg: 'var(--priority-mid-bg)'  },
                  { value: 'low',  label: t('planner.low'),  color: 'var(--priority-low)',  bg: 'var(--priority-low-bg)'  },
                ] as const).map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5"
                    style={{
                      color:           priority === p.value ? p.color : 'var(--color-outline)',
                      backgroundColor: priority === p.value ? p.bg   : 'transparent',
                      borderColor:     priority === p.value ? p.color : 'var(--border-default)',
                    }}
                  >
                    <span style={{ fontSize: '7px', lineHeight: 1 }}>●</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="label">{t('planner.subject')}</label>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">{t('planner.noSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Day picker for subjects with multiple weekly schedules */}
          {itemType !== 'task' && subjectSchedules.length > 1 && (
            <div>
              <label className="label">
                {language === 'es' ? 'Día del examen' : 'Exam day'}
              </label>
              <div className="flex gap-2 flex-wrap">
                {subjectSchedules.map(sc => {
                  const isSelected = scheduleDay === sc.day_of_week
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setScheduleDay(sc.day_of_week)}
                      className="flex flex-col items-center px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                        color:           isSelected ? 'var(--color-primary)' : 'var(--color-outline)',
                        borderColor:     isSelected ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-default)',
                      }}
                    >
                      <span>{DAY_LABELS[sc.day_of_week]}</span>
                      <span className="mono text-[10px] opacity-70">{sc.start_time.slice(0, 5)}</span>
                    </button>
                  )
                })}
              </div>
              {scheduleDay === null && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-outline)' }}>
                  {language === 'es' ? 'Selecciona el día para completar hora y salón' : 'Select day to fill in time and room'}
                </p>
              )}
            </div>
          )}

          {/* Date + Time */}
          <div className={`grid gap-3 ${itemType !== 'task' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="label">{t('planner.date')}</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            {itemType !== 'task' && (
              <div>
                <label className="label">{t('planner.time')}</label>
                <input type="time" className="input" value={examTime} onChange={e => setExamTime(e.target.value)} />
              </div>
            )}
          </div>

          {/* Location — exams/assignments only */}
          {itemType !== 'task' && (
            <div>
              <label className="label">{t('planner.location')}</label>
              <input
                className="input"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={language === 'es' ? 'Salón, aula...' : 'Room, location...'}
              />
            </div>
          )}

          {/* Peso + Nota — exams/assignments only */}
          {itemType !== 'task' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{language === 'es' ? 'Peso (%)' : 'Weight (%)'}</label>
                <div className="relative">
                  <input
                    type="number" min="0" max="100" step="0.5"
                    className="input pr-8"
                    placeholder="0–100"
                    value={percentage}
                    onChange={e => setPercentage(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                    style={{ color: 'var(--color-outline)' }}>%</span>
                </div>
              </div>
              <div>
                <label className="label">{language === 'es' ? 'Nota (opcional)' : 'Grade (optional)'}</label>
                <div className="relative">
                  <input
                    type="number" min="0" max="20" step="0.5"
                    className="input pr-10"
                    placeholder="0–20"
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color: 'var(--color-outline)' }}>/20</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('planner.cancel')}</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? t('common.loading') : t('planner.save')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Simple task card ─────────────────────────────────────────────────────────
function TaskCard({
  task,
  subjects,
  onDelete,
  onRefresh,
}: {
  task: Task
  subjects: Subject[]
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const [expanded,       setExpanded]       = useState(false)
  const [notesOpen,      setNotesOpen]      = useState(false)
  const [subtasks,       setSubtasks]       = useState<Subtask[]>([])
  const [subtasksLoaded, setSubtasksLoaded] = useState(false)
  const [taskStatus,     setTaskStatus]     = useState<Task['status']>(task.status || 'not_started')
  const supabase = createClient()

  const subject = subjects.find(s => s.id === task.subject_id)

  const loadSubtasks = useCallback(async () => {
    if (subtasksLoaded) return
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', task.id).order('position')
    setSubtasks(data || [])
    setSubtasksLoaded(true)
  }, [task.id, subtasksLoaded, supabase])

  const cycleStatus = async () => {
    const next: Task['status'] = taskStatus === 'not_started' ? 'in_progress'
      : taskStatus === 'in_progress' ? 'done' : 'not_started'
    setTaskStatus(next)
    await supabase.from('tasks').update({
      status:  next,
      is_done: next === 'done',
      done_at: next === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    onRefresh()
  }

  const toggleSubtask = async (st: Subtask) => {
    await supabase.from('subtasks').update({ is_done: !st.is_done }).eq('id', st.id)
    setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, is_done: !s.is_done } : s))
  }

  const STATUS_CFG = {
    not_started: { icon: 'radio_button_unchecked', color: 'var(--color-outline)' },
    in_progress:  { icon: 'pending',               color: 'var(--warning)'       },
    done:         { icon: 'check_circle',           color: 'var(--success)'       },
  }
  const statusCfg = STATUS_CFG[taskStatus]
  const isDone = taskStatus === 'done'

  const dueBadge = () => {
    if (!task.due_date) return null
    const days = daysUntil(task.due_date)
    if (isToday(task.due_date))    return { label: t('planner.today'),    color: 'var(--danger)',        bg: 'var(--priority-high-bg)' }
    if (isTomorrow(task.due_date)) return { label: t('planner.tomorrow'), color: 'var(--warning)',       bg: 'var(--priority-mid-bg)'  }
    if (days <= 7)                  return { label: `${days}d`,           color: 'var(--warning)',       bg: 'var(--priority-mid-bg)'  }
    return                                  { label: `${days}d`,           color: 'var(--color-primary)', bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }
  }
  const badge = dueBadge()

  return (
    <div
      className={`rounded-2xl p-4 mb-2 transition-all duration-200 group ${isDone ? 'opacity-55' : ''}`}
      style={{
        backgroundColor: 'var(--s-low)',
        border: taskStatus === 'in_progress'
          ? '1px solid color-mix(in srgb, var(--warning) 30%, transparent)'
          : '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status toggle */}
        <button
          onClick={cycleStatus}
          className="w-6 h-6 flex-shrink-0 mt-0.5 flex items-center justify-center hover:scale-110 transition-transform"
          style={{ color: statusCfg.color }}
          aria-label={taskStatus}
        >
          <span className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: isDone ? "'FILL' 1" : "'FILL' 0" }}>
            {statusCfg.icon}
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-sm font-semibold ${isDone ? 'line-through' : ''}`}
              style={{ color: isDone ? 'var(--color-outline)' : 'var(--on-surface)' }}>
              {task.text}
            </span>
            {taskStatus === 'in_progress' && (
              <span className="mono text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"
                style={{ backgroundColor: 'var(--priority-mid-bg)', color: 'var(--warning)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--warning)' }} />
                {t('planner.in_progress')}
              </span>
            )}
            {badge && (
              <span className="mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                style={{ backgroundColor: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}
            {subject && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${subject.color}18`, color: subject.color }}>
                {subject.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setExpanded(!expanded); if (!expanded) loadSubtasks() }}
              className="mono text-[10px] flex items-center gap-1 hover:opacity-80"
              style={{ color: 'var(--color-outline)' }}
            >
              <span className="material-symbols-outlined text-[12px]">{expanded ? 'expand_less' : 'expand_more'}</span>
              {subtasksLoaded && subtasks.length > 0 ? `${subtasks.filter(s => s.is_done).length}/${subtasks.length} ` : ''}
              {t('planner.subtasks')}
            </button>
            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className="mono text-[10px] flex items-center gap-1 hover:opacity-80"
              style={{ color: notesOpen ? 'var(--color-primary)' : 'var(--color-outline)' }}
            >
              {task.notes && task.notes.length > 7 && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
              )}
              <span className="material-symbols-outlined text-[12px]">edit_note</span>
              {t('planner.notes')}
            </button>
          </div>

          {expanded && subtasksLoaded && (
            <div className="mt-2 space-y-1.5 animate-slide-up">
              {subtasks.map(st => (
                <div key={st.id} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSubtask(st)}
                    className="w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      borderColor:     st.is_done ? 'var(--color-primary)' : 'var(--border-strong)',
                      backgroundColor: st.is_done ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                    }}
                  >
                    {st.is_done && <span className="material-symbols-outlined text-[10px]" style={{ color: 'var(--color-primary)' }}>check</span>}
                  </button>
                  <span className={`text-xs flex-1 ${st.is_done ? 'line-through' : ''}`}
                    style={{ color: st.is_done ? 'var(--color-outline)' : 'var(--on-surface-variant)' }}>
                    {st.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {notesOpen && <TaskNotes task={task} onSaved={onRefresh} />}
        </div>

        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-400/10 flex-shrink-0"
          style={{ color: 'var(--danger)' }}
          aria-label="Delete"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  )
}

// ─── Academic card (exams/assignments) ────────────────────────────────────────
const STATUS_CFG = {
  pending:   { icon: 'radio_button_unchecked', label_es: 'Pendiente',  label_en: 'Pending',   color: 'var(--color-outline)', fill: 0 },
  submitted: { icon: 'upload_file',            label_es: 'Entregada',  label_en: 'Submitted', color: 'var(--warning)',       fill: 0 },
  graded:    { icon: 'check_circle',           label_es: 'Calificada', label_en: 'Graded',    color: 'var(--success)',       fill: 1 },
}

function AcademicCard({
  exam,
  subjects,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  exam: Exam
  subjects: Subject[]
  onEdit: (exam: Exam) => void
  onDelete: (id: string) => void
  onStatusChange: (examId: string, newStatus: SubmissionStatus, grade?: number) => Promise<void>
}) {
  const { language } = useTranslation()
  const { use12h }   = useTimeFormat()
  const [gradingOpen, setGradingOpen] = useState(false)
  const [gradeInput,  setGradeInput]  = useState('')
  const [confirming,  setConfirming]  = useState(false)

  const subject   = subjects.find(s => s.id === exam.subject_id)
  const days      = daysUntil(exam.exam_date)
  const typeCfg   = ACTIVITY_TYPES[exam.activity_type || 'exam']
  const typeColor = typeCfg.color
  const typeLabel = language === 'es' ? typeCfg.label_es : typeCfg.label_en
  const date      = new Date(exam.exam_date + 'T00:00:00')
  const urgency   = days < 0 ? 'var(--color-outline)' : days < 3 ? 'var(--danger)' : days < 7 ? 'var(--warning)' : 'var(--color-primary)'
  const daysLabel = days < 0
    ? (language === 'es' ? 'Pasado' : 'Past')
    : days === 0 ? (language === 'es' ? 'Hoy' : 'Today')
    : days === 1 ? (language === 'es' ? 'Mañana' : 'Tomorrow')
    : `${days}${language === 'es' ? 'd' : 'd'}`

  const status = (exam.submission_status || 'pending') as keyof typeof STATUS_CFG
  const sCfg   = STATUS_CFG[status]

  const handleStatusClick = () => {
    if (status === 'pending')   { onStatusChange(exam.id, 'submitted'); return }
    if (status === 'submitted') { setGradingOpen(true); return }
    if (status === 'graded')    { setConfirming(true); return }
  }

  const handleGradeSave = async () => {
    const g = gradeInput !== '' ? parseFloat(gradeInput) : undefined
    await onStatusChange(exam.id, 'graded', g)
    setGradingOpen(false)
    setGradeInput('')
  }

  const handleConfirmReset = async () => {
    await onStatusChange(exam.id, 'pending')
    setConfirming(false)
  }

  return (
    <div
      className="rounded-2xl mb-2 overflow-hidden group"
      style={{
        backgroundColor: 'var(--s-low)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `4px solid ${typeColor}`,
      }}
    >
      <div className="p-4 pb-3">
        {/* Row 1: type badge + countdown badge + date */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="flex items-center gap-1 mono text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
            style={{ backgroundColor: `${typeColor}18`, color: typeColor }}
          >
            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {typeCfg.icon}
            </span>
            {typeLabel}
          </span>

          <span
            className="mono text-[13px] font-black px-2.5 py-0.5 rounded-full"
            style={{
              color:           urgency,
              backgroundColor: `color-mix(in srgb, ${urgency} 10%, transparent)`,
              border:          `1px solid color-mix(in srgb, ${urgency} 25%, transparent)`,
            }}
          >
            {daysLabel}
          </span>

          <span className="ml-auto mono text-[9px] capitalize" style={{ color: 'var(--color-outline)' }}>
            {date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold mb-1.5" style={{ color: 'var(--on-surface)' }}>{exam.title}</h3>

        {/* Subject + percentage */}
        <div className="flex items-center gap-2 mb-2">
          {subject && (
            <span className="text-xs font-medium" style={{ color: subject.color }}>{subject.name}</span>
          )}
          {exam.percentage != null && (
            <span className="mono text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
              {exam.percentage}%
            </span>
          )}
        </div>

        {/* Time + location */}
        {(exam.exam_time || exam.location) && (
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-outline)' }}>
            {exam.exam_time && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                {formatTime(exam.exam_time, use12h)}
              </span>
            )}
            {exam.location && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">location_on</span>
                {exam.location}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status row + hover actions */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-2.5"
        style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={handleStatusClick}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all"
          style={{
            color:           sCfg.color,
            borderColor:     `color-mix(in srgb, ${sCfg.color} 30%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${sCfg.color} 8%, transparent)`,
          }}
        >
          <span className="material-symbols-outlined text-[12px]"
            style={{ fontVariationSettings: `'FILL' ${sCfg.fill}` }}>
            {sCfg.icon}
          </span>
          {language === 'es' ? sCfg.label_es : sCfg.label_en}
        </button>

        <div className="ml-auto flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(exam)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}
          >
            <span className="material-symbols-outlined text-[13px]">edit</span>
            {language === 'es' ? 'Editar' : 'Edit'}
          </button>
          <button
            onClick={() => onDelete(exam.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}
          >
            <span className="material-symbols-outlined text-[13px]">delete</span>
            {language === 'es' ? 'Eliminar' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Inline grade input (submitted → graded) */}
      {gradingOpen && (
        <div className="px-4 pb-3 flex items-center gap-2 animate-slide-up"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="relative">
            <input
              type="number" min="0" max="20" step="0.5"
              value={gradeInput}
              onChange={e => setGradeInput(e.target.value)}
              placeholder="0–20"
              className="input text-sm h-8 w-24 pr-10"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold"
              style={{ color: 'var(--color-outline)' }}>/20</span>
          </div>
          <button onClick={handleGradeSave}
            className="btn-primary text-xs px-3 h-8">
            {language === 'es' ? 'Guardar' : 'Save'}
          </button>
          <button onClick={() => { setGradingOpen(false); setGradeInput('') }}
            className="text-xs font-medium" style={{ color: 'var(--color-outline)' }}>
            {language === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Inline confirm reset (graded → pending) */}
      {confirming && (
        <div className="px-4 pb-3 flex items-center gap-2 animate-slide-up"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span className="text-xs flex-1" style={{ color: 'var(--color-outline)' }}>
            {language === 'es' ? '¿Volver a pendiente?' : 'Reset to pending?'}
          </span>
          <button onClick={handleConfirmReset}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
            {language === 'es' ? 'Sí' : 'Yes'}
          </button>
          <button onClick={() => setConfirming(false)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
            No
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Edit exam modal ──────────────────────────────────────────────────────────
function EditExamModal({
  exam,
  subjects,
  onClose,
  onSaved,
}: {
  exam: Exam
  subjects: Subject[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t, language } = useTranslation()
  const [title,      setTitle]      = useState(exam.title)
  const [subjectId,  setSubjectId]  = useState(exam.subject_id || '')
  const [examDate,   setExamDate]   = useState(exam.exam_date)
  const [examTime,   setExamTime]   = useState(exam.exam_time || '')
  const [location,   setLocation]   = useState(exam.location || '')
  const [percentage, setPercentage] = useState<string>(exam.percentage != null ? String(exam.percentage) : '')
  const [grade,      setGrade]      = useState<string>(exam.grade != null ? String(exam.grade) : '')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !examDate) { setError(t('auth.errors.required')); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const pctNum   = percentage !== '' ? parseFloat(percentage) : null
    const gradeNum = grade !== '' ? parseFloat(grade) : null
    const { error: dbErr } = await supabase.from('exams').update({
      user_id:    user.id,
      title:      title.trim(),
      subject_id: subjectId || null,
      exam_date:  examDate,
      exam_time:  examTime || null,
      location:   location.trim() || null,
      percentage: pctNum,
      grade:      gradeNum,
    }).eq('id', exam.id)
    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--on-surface)' }}>
          {language === 'es' ? 'Editar actividad' : 'Edit activity'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{language === 'es' ? 'Título' : 'Title'} *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} aria-required="true" />
          </div>
          <div>
            <label className="label">{t('planner.subject')}</label>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">{t('planner.noSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('planner.date')} *</label>
              <input type="date" className="input" value={examDate} onChange={e => setExamDate(e.target.value)} aria-required="true" />
            </div>
            <div>
              <label className="label">{t('planner.time')}</label>
              <input type="time" className="input" value={examTime} onChange={e => setExamTime(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">{t('planner.location')}</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t('planner.percentage')}</label>
              <div className="relative">
                <input
                  type="number" min="0" max="100" step="0.5"
                  className="input pr-8"
                  placeholder="0–100"
                  value={percentage}
                  onChange={e => setPercentage(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                  style={{ color: 'var(--color-outline)' }}>%</span>
              </div>
            </div>
            <div>
              <label className="label">{language === 'es' ? 'Nota' : 'Grade'}</label>
              <div className="relative">
                <input
                  type="number" min="0" max="20" step="0.5"
                  className="input pr-10"
                  placeholder="0–20"
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                  style={{ color: 'var(--color-outline)' }}>/20</span>
              </div>
            </div>
          </div>
          {error && (
            <p className="text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PlannerPage() {
  const { t, language } = useTranslation()

  const [tasks,         setTasks]         = useState<Task[]>([])
  const [exams,         setExams]         = useState<Exam[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [schedules,     setSchedules]     = useState<Schedule[]>([])
  const [loading,       setLoading]       = useState(true)
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [sheetType,     setSheetType]     = useState<'task' | 'exam' | 'assignment'>('task')
  const [editingExam,   setEditingExam]   = useState<Exam | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [typeFilter,       setTypeFilter]       = useState<TypeFilter>('all')
  const [subjectFilter,    setSubjectFilter]    = useState<string>('')
  const [statusFilter,     setStatusFilter]     = useState<StatusFilter>('all')
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('all')
  const [filterOpen,       setFilterOpen]       = useState(false)
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: ts }, { data: es }, { data: ss }, { data: sc }] = await Promise.all([
      supabase.from('tasks').select('*').order('position').order('created_at'),
      supabase.from('exams').select('*').order('exam_date'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('schedules').select('*'),
    ])
    setTasks(ts || [])
    setExams(es || [])
    setSubjects(uniqueByName(uniqueById(ss || [])))
    setSchedules(sc || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const supabase = createClient()
    const ch = supabase.channel('planner-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchData])

  // Auto-open CreateSheet when navigated from a Quick Action
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const create = params.get('create')
    if (create === 'task' || create === 'exam' || create === 'assignment') {
      setSheetType(create)
      setSheetOpen(true)
      // Clean the URL so refreshing doesn't re-open the sheet
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const deleteTask = async (id: string) => {
    await createClient().from('tasks').delete().eq('id', id)
    fetchData()
  }

  const deleteExam = async (id: string) => {
    await createClient().from('exams').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchData()
  }

  const updateSubmissionStatus = useCallback(async (examId: string, newStatus: SubmissionStatus, grade?: number) => {
    const supabase = createClient()
    const update: Record<string, unknown> = { submission_status: newStatus }
    if (newStatus === 'submitted') {
      update.submitted_at = new Date().toISOString()
    } else if (newStatus === 'graded') {
      update.graded_at = new Date().toISOString()
      if (grade !== undefined) update.grade = grade
    } else if (newStatus === 'pending') {
      update.submitted_at     = null
      update.graded_at        = null
      update.grade            = null
      update.reminder_triggered = false
    }
    await supabase.from('exams').update(update).eq('id', examId)
    fetchData()
  }, [fetchData])

  const todayStr = new Date().toISOString().split('T')[0]

  // Reminder: exams submitted > 3 days ago, not yet triggered
  const reminderExams = exams.filter(e => {
    if (e.submission_status !== 'submitted') return false
    if (e.reminder_triggered) return false
    if (!e.submitted_at) return false
    const daysSince = (Date.now() - new Date(e.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 3
  })

  const dismissReminder = async () => {
    setReminderDismissed(true)
    const ids = reminderExams.map(e => e.id)
    if (ids.length > 0) {
      await createClient().from('exams').update({ reminder_triggered: true }).in('id', ids)
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  let filteredTasks = [...tasks]
  let filteredExams = [...exams]

  if (typeFilter === 'tasks') {
    filteredExams = []
  } else if (typeFilter === 'exams') {
    filteredTasks = []
    filteredExams = filteredExams.filter(e => e.activity_type === 'exam')
  } else if (typeFilter === 'assignments') {
    filteredTasks = []
    filteredExams = filteredExams.filter(e => e.activity_type !== 'exam')
  }

  if (subjectFilter) {
    filteredTasks = filteredTasks.filter(task => task.subject_id === subjectFilter)
    filteredExams = filteredExams.filter(e => e.subject_id === subjectFilter)
  }

  if (statusFilter === 'not_started') {
    filteredTasks = filteredTasks.filter(task => !task.is_done && (task.status || 'not_started') === 'not_started')
    filteredExams = filteredExams.filter(e => e.exam_date >= todayStr)
  } else if (statusFilter === 'in_progress') {
    filteredTasks = filteredTasks.filter(task => !task.is_done && task.status === 'in_progress')
    filteredExams = []
  } else if (statusFilter === 'completed') {
    filteredTasks = filteredTasks.filter(task => task.is_done)
    filteredExams = filteredExams.filter(e => e.exam_date < todayStr)
  }

  if (submissionFilter !== 'all') {
    filteredExams = filteredExams.filter(e => {
      const s = e.submission_status || 'pending'
      if (submissionFilter === 'pending')   return s === 'pending'
      if (submissionFilter === 'submitted') return s === 'submitted'
      if (submissionFilter === 'graded')    return s === 'graded'
      if (submissionFilter === 'ungraded')  return s === 'pending' || s === 'submitted'
      return true
    })
  }

  const pendingTasks   = filteredTasks.filter(task => !task.is_done)
  const completedTasks = filteredTasks.filter(task => task.is_done)
  const upcomingExams  = filteredExams.filter(e => e.exam_date >= todayStr)
  const pastExams      = filteredExams.filter(e => e.exam_date < todayStr)

  const totalVisible   = pendingTasks.length + upcomingExams.length + completedTasks.length + pastExams.length
  const isEmpty        = totalVisible === 0

  const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
    { key: 'all',         label: t('planner.all')         },
    { key: 'tasks',       label: t('planner.tasks')       },
    { key: 'exams',       label: t('planner.exams')       },
    { key: 'assignments', label: t('planner.assignments') },
  ]

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',         label: t('planner.all')         },
    { key: 'not_started', label: t('planner.not_started') },
    { key: 'in_progress', label: t('planner.in_progress') },
    { key: 'completed',   label: t('planner.completed')   },
  ]

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-32 lg:pb-10">

      {/* Header */}
      <div className="mb-5">
        <p className="mono text-[10px] tracking-[0.18em] uppercase mb-1" style={{ color: 'var(--color-primary)' }}>
          Scholar Sanctuary
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {t('planner.title')}
        </h1>
      </div>

      {/* ── Filters: type tabs + filter button in one row ── */}
      <div className="flex items-center gap-2 mb-4">
        {/* Type segmented control */}
        <div className="flex gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {TYPE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap"
              style={{
                backgroundColor: typeFilter === key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                color:           typeFilter === key ? 'var(--color-primary)' : 'var(--color-outline)',
                borderColor:     typeFilter === key ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-subtle)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filter button — shows badge when filters are active */}
        <button
          onClick={() => setFilterOpen(o => !o)}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          style={{
            backgroundColor: (subjectFilter || statusFilter !== 'all' || submissionFilter !== 'all')
              ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
              : 'transparent',
            color: (subjectFilter || statusFilter !== 'all' || submissionFilter !== 'all') ? 'var(--color-primary)' : 'var(--color-outline)',
            borderColor: (subjectFilter || statusFilter !== 'all' || submissionFilter !== 'all')
              ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)'
              : 'var(--border-subtle)',
          }}
        >
          <span className="material-symbols-outlined text-[13px]">tune</span>
          {(subjectFilter || statusFilter !== 'all' || submissionFilter !== 'all') && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }} />
          )}
        </button>
      </div>

      {/* ── Subject chips (always visible when subjects exist) ── */}
      {subjects.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 -mt-1">
          <button
            onClick={() => setSubjectFilter('')}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap"
            style={{
              backgroundColor: !subjectFilter ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
              color:           !subjectFilter ? 'var(--color-primary)' : 'var(--color-outline)',
              borderColor:     !subjectFilter ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-subtle)',
            }}
          >
            {t('planner.allSubjects')}
          </button>
          {subjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSubjectFilter(s.id === subjectFilter ? '' : s.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap"
              style={{
                backgroundColor: subjectFilter === s.id ? `color-mix(in srgb, ${s.color} 15%, transparent)` : 'transparent',
                color:           subjectFilter === s.id ? s.color : 'var(--color-outline)',
                borderColor:     subjectFilter === s.id ? `color-mix(in srgb, ${s.color} 40%, transparent)` : 'var(--border-subtle)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.color, flexShrink: 0, display: 'inline-block' }} />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Collapsible filter panel ── */}
      {filterOpen && (
        <div className="mb-4 p-3 rounded-2xl animate-slide-up space-y-3"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
          {/* Task status */}
          <div>
            <p className="mono text-[9px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? 'Estado de tarea' : 'Task status'}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: statusFilter === key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                    color:           statusFilter === key ? 'var(--color-primary)' : 'var(--color-outline)',
                    borderColor:     statusFilter === key ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-default)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Submission status (exams only) */}
          <div>
            <p className="mono text-[9px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? 'Estado de entrega' : 'Submission status'}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: 'all',       label_es: 'Todas',         label_en: 'All'          },
                { key: 'pending',   label_es: 'Pendiente',     label_en: 'Pending'      },
                { key: 'submitted', label_es: 'Entregada',     label_en: 'Submitted'    },
                { key: 'graded',    label_es: 'Calificada',    label_en: 'Graded'       },
                { key: 'ungraded',  label_es: 'Sin calificar', label_en: 'Ungraded'     },
              ] as const).map(({ key, label_es, label_en }) => (
                <button
                  key={key}
                  onClick={() => setSubmissionFilter(key)}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                  style={{
                    backgroundColor: submissionFilter === key ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
                    color:           submissionFilter === key ? 'var(--color-primary)' : 'var(--color-outline)',
                    borderColor:     submissionFilter === key ? 'color-mix(in srgb, var(--color-primary) 30%, transparent)' : 'var(--border-default)',
                  }}
                >
                  {language === 'es' ? label_es : label_en}
                </button>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {(statusFilter !== 'all' || submissionFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setSubmissionFilter('all') }}
              className="text-xs font-semibold"
              style={{ color: 'var(--danger)' }}
            >
              {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
            </button>
          )}
        </div>
      )}

      {/* Reminder banner */}
      {reminderExams.length > 0 && !reminderDismissed && (
        <div className="mb-4 p-3 rounded-2xl flex items-center gap-3 animate-slide-up"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)',
          }}>
          <span className="material-symbols-outlined text-[18px] flex-shrink-0"
            style={{ color: 'var(--warning)', fontVariationSettings: "'FILL' 1" }}>
            notification_important
          </span>
          <p className="flex-1 text-xs font-medium" style={{ color: 'var(--on-surface)' }}>
            {language === 'es'
              ? `Tienes ${reminderExams.length} evaluación${reminderExams.length > 1 ? 'es' : ''} entregada${reminderExams.length > 1 ? 's' : ''} sin calificar`
              : `You have ${reminderExams.length} submitted evaluation${reminderExams.length > 1 ? 's' : ''} without a grade`}
          </p>
          <button onClick={dismissReminder}
            className="p-1 rounded-lg flex-shrink-0 transition-all hover:bg-black/5"
            style={{ color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20" />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && (
        <div className="text-center py-20">
          <div className="relative inline-block mb-5">
            <div className="absolute inset-0 rounded-full blur-[40px] opacity-20"
              style={{ backgroundColor: 'var(--color-primary)' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
              <span className="material-symbols-outlined text-3xl"
                style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>{t('planner.noItems')}</p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-outline)' }}>{t('planner.noItemsDesc')}</p>
          <button onClick={() => setSheetOpen(true)} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('planner.add')}
          </button>
        </div>
      )}

      {/* Items */}
      {!loading && !isEmpty && (
        <div>
          {/* Pending tasks + upcoming exams */}
          {pendingTasks.map(task => (
            <TaskCard key={`t-${task.id}`} task={task} subjects={subjects} onDelete={deleteTask} onRefresh={fetchData} />
          ))}
          {upcomingExams.map(exam => (
            <AcademicCard key={`e-${exam.id}`} exam={exam} subjects={subjects} onEdit={setEditingExam} onDelete={id => setDeleteConfirm(id)} onStatusChange={updateSubmissionStatus} />
          ))}

          {/* Completed / Past */}
          {(completedTasks.length > 0 || pastExams.length > 0) && statusFilter !== 'not_started' && statusFilter !== 'in_progress' && (
            <details className="mt-4">
              <summary
                className="mono text-[10px] uppercase tracking-widest cursor-pointer mb-3 flex items-center gap-2 select-none"
                style={{ color: 'var(--color-outline)' }}
              >
                <span className="material-symbols-outlined text-[13px]">history</span>
                {t('planner.completed')} ({completedTasks.length + pastExams.length})
              </summary>
              <div className="mt-2 opacity-55">
                {completedTasks.map(task => (
                  <TaskCard key={`td-${task.id}`} task={task} subjects={subjects} onDelete={deleteTask} onRefresh={fetchData} />
                ))}
                {pastExams.map(exam => (
                  <AcademicCard key={`ep-${exam.id}`} exam={exam} subjects={subjects} onEdit={setEditingExam} onDelete={id => setDeleteConfirm(id)} onStatusChange={updateSubmissionStatus} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 w-12 h-12 rounded-full flex items-center justify-center z-30 transition-all active:scale-95 hover:scale-105"
        style={{
          backgroundColor: 'var(--color-primary)',
          color:           'var(--on-primary, white)',
          boxShadow:       '0 4px 18px color-mix(in srgb, var(--color-primary) 28%, transparent)',
        }}
        aria-label={t('planner.add')}
      >
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>

      {/* Create sheet */}
      {sheetOpen && (
        <CreateSheet subjects={subjects} schedules={schedules} onClose={() => { setSheetOpen(false); setSheetType('task') }} onSaved={fetchData} defaultType={sheetType} />
      )}

      {/* Edit exam modal */}
      {editingExam && (
        <EditExamModal exam={editingExam} subjects={subjects} onClose={() => setEditingExam(null)} onSaved={fetchData} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm" role="dialog" aria-modal="true">
            <h2 className="font-bold mb-2" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? '¿Eliminar esta actividad?' : 'Delete this activity?'}
            </h2>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button onClick={() => deleteExam(deleteConfirm)} className="btn-danger flex-1">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
