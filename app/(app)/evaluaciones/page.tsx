'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { computeAlertDueLabel, computeWeightedAvg, subjectInfo } from '@/lib/meta'
import { DashMetaBar } from '@/features/home/components/DashMetaBar'
import { SideDrawer } from '@/components/ui/SideDrawer'
import type { ActivityType, Exam, StudyStep, Subject, Task } from '@/types'

const ACTIVITY_TYPES: ActivityType[] = ['exam', 'workshop', 'activity', 'task', 'study_session']

type Urgency = 'today' | 'tomorrow' | 'soon' | 'later' | 'past'
type CountdownTone = 'danger' | 'warning' | 'muted'

interface ComputedRow {
  exam: Exam
  day: string
  month: string
  subText: string
  urgency: Urgency
  countdown: string
  countdownTone: CountdownTone
  prep: number
  weight: number | null
}

function activityLabel(at: ActivityType, lang: 'es' | 'en'): string {
  const map = {
    es: { exam: 'EXAMEN', workshop: 'TALLER', activity: 'ACTIVIDAD', task: 'TAREA', study_session: 'ESTUDIO' },
    en: { exam: 'EXAM', workshop: 'WORKSHOP', activity: 'ACTIVITY', task: 'TASK', study_session: 'STUDY' },
  }
  return map[lang][at]
}

function formatDayMonth(dateStr: string, lang: 'es' | 'en'): { day: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDate().toString().padStart(2, '0')
  const month = d
    .toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short' })
    .toUpperCase()
    .replace('.', '')
  return { day, month }
}

function computeRow(exam: Exam, lang: 'es' | 'en', t: (k: string) => string): ComputedRow {
  const time = exam.exam_time || '23:59'
  const examMs = new Date(exam.exam_date + 'T' + time).getTime()
  const now = Date.now()
  const diffMs = examMs - now
  const dayMs = 86400000

  // Countdown text
  let countdown: string
  if (diffMs <= 0) countdown = t('evaluaciones.past')
  else if (diffMs < dayMs) {
    const totalMin = Math.floor(diffMs / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    countdown = h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
  } else {
    const days = Math.floor(diffMs / dayMs)
    countdown = `${days}d`
  }

  // Tone
  let countdownTone: CountdownTone = 'muted'
  if (diffMs > 0 && diffMs < dayMs / 2) countdownTone = 'danger' // <12h → red
  else if (diffMs > 0 && diffMs < dayMs * 2) countdownTone = 'warning' // <48h → amber

  // Urgency + sub label
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(exam.exam_date + 'T00:00:00')
  dueDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / dayMs)

  let urgency: Urgency
  let subText: string
  if (diffDays < 0) { urgency = 'past'; subText = t('evaluaciones.day.past') }
  else if (diffDays === 0) { urgency = 'today'; subText = t('evaluaciones.day.today') }
  else if (diffDays === 1) { urgency = 'tomorrow'; subText = t('evaluaciones.day.tomorrow') }
  else if (diffDays <= 7) { urgency = 'soon'; subText = t('evaluaciones.day.daysCount').replace('{n}', String(diffDays)) }
  else { urgency = 'later'; subText = t('evaluaciones.day.daysCount').replace('{n}', String(diffDays)) }

  // Prep% from study_plan completion
  const plan = Array.isArray(exam.study_plan) ? exam.study_plan : []
  const prep = plan.length === 0
    ? 0
    : Math.round(plan.filter(s => s.done).length / plan.length * 100)

  const { day, month } = formatDayMonth(exam.exam_date, lang)
  return {
    exam,
    day, month, subText,
    urgency,
    countdown, countdownTone,
    prep,
    weight: exam.percentage,
  }
}

// ─── Day block ───────────────────────────────────────────────────────────
function DayBlock({ row }: { row: ComputedRow }) {
  return (
    <div className="day-block">
      <div className="day-block__num-row">
        <span className="day-block__num">{row.day}</span>
        <span className={`day-block__dot is-${row.urgency}`} aria-hidden />
      </div>
      <div className="day-block__mo">{row.month}</div>
      <div
        className={`day-block__sub${
          row.urgency === 'today' ? ' is-today' :
          row.urgency === 'tomorrow' ? ' is-tomorrow' : ''
        }`}
      >
        {row.subText}
      </div>
    </div>
  )
}

// ─── Eval row ────────────────────────────────────────────────────────────
function EvalRow({
  row,
  subjects,
  onOpen,
}: {
  row: ComputedRow
  subjects: Subject[]
  onOpen: (id: string) => void
}) {
  const { t, language } = useTranslation()
  const info = subjectInfo(row.exam.subject_id, subjects)
  const tagClass = subjectTag(info.color)
  const weightLabel = row.weight != null
    ? t('evaluaciones.weightLabel').replace('{n}', String(row.weight))
    : null
  const countdownClass =
    row.countdownTone === 'danger'  ? 'countdown is-danger' :
    row.countdownTone === 'warning' ? 'countdown is-warning' :
    'countdown'
  const tipoText = activityLabel(row.exam.activity_type, language)

  return (
    <div className="timeline-row">
      <DayBlock row={row} />

      <div
        className={`eval-card ${tagClass}`}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(row.exam.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(row.exam.id)
          }
        }}
      >
        <div className="eval-card__head">
          <span className="subj-chip">{info.code}</span>
          <span className="tipo-chip">{tipoText}</span>
          {weightLabel && <span className="pct-chip">{weightLabel}</span>}
        </div>

        <div className="eval-card__title">{row.exam.title}</div>

        <div className="eval-card__meta">
          {row.exam.exam_time && (
            <span className="eval-card__meta-item">
              <span className="material-symbols-outlined">schedule</span>
              {row.exam.exam_time.slice(0, 5)}
            </span>
          )}
          {row.exam.location && (
            <span className="eval-card__meta-item">
              <span className="material-symbols-outlined">place</span>
              {row.exam.location}
            </span>
          )}
        </div>

        <div className="eval-card__prep-row">
          <span className="eval-card__prep-label">{t('evaluaciones.preparation')}</span>
          <span className="eval-card__prep-pct">{row.prep}%</span>
        </div>
        <div className="eval-card__bar" aria-hidden>
          <div className="eval-card__bar-fill" style={{ width: `${row.prep}%` }} />
        </div>

        <button
          type="button"
          className="eval-card__guide"
          onClick={(e) => { e.stopPropagation(); onOpen(row.exam.id) }}
        >
          {t('evaluaciones.openGuide')}
          <span className="material-symbols-outlined">north_east</span>
        </button>
      </div>

      <div className={countdownClass}>{row.countdown}</div>
    </div>
  )
}

// ─── Create form (Nueva evaluación) ──────────────────────────────────────
function ExamCreateForm({
  subjects,
  onSaved,
  onCancel,
}: {
  subjects: Subject[]
  onSaved: () => void
  onCancel: () => void
}) {
  const { t, language } = useTranslation()
  const supabase = useMemo(() => createClient(), [])

  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [activityType, setActivityType] = useState<ActivityType>('exam')
  const [percentage, setPercentage] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!title.trim()) {
      setError(language === 'es' ? 'El título es obligatorio.' : 'Title is required.')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); setError(language === 'es' ? 'No estás autenticado.' : 'Not authenticated.'); return }

    const pctNum = percentage.trim() === '' ? null : Number(percentage)
    const insert = {
      user_id: user.id,
      title: title.trim(),
      subject_id: subjectId || null,
      exam_date: date,
      exam_time: time || null,
      location: location.trim() || null,
      activity_type: activityType,
      percentage: pctNum != null && !isNaN(pctNum) ? pctNum : null,
      study_plan: [],
      estimated_hours: null,
    }
    const { error: dbErr } = await supabase.from('exams').insert(insert)
    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }
    onSaved()
  }

  return (
    <div className="drawer-form">
      <div className="drawer-form__field">
        <label className="drawer-form__label">{t('drawer.detail')}</label>
        <input
          className="drawer-form__input"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={language === 'es' ? 'Ej. Parcial Cálculo I' : 'e.g. Calculus midterm'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit() }}
        />
      </div>

      <div className="drawer-form__field">
        <label className="drawer-form__label">{t('drawer.subject')}</label>
        <select
          className="drawer-form__select"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">{language === 'es' ? 'Sin materia' : 'No subject'}</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="drawer-form__field">
        <label className="drawer-form__label">{t('drawer.type')}</label>
        <div className="drawer-form__type-grid">
          {ACTIVITY_TYPES.map(at => (
            <button
              key={at}
              type="button"
              className={`drawer-form__type${activityType === at ? ' is-active' : ''}`}
              onClick={() => setActivityType(at)}
            >
              {t(`evaluaciones.activity.${at}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="drawer-form__row">
        <div className="drawer-form__field">
          <label className="drawer-form__label">{t('drawer.date')}</label>
          <input
            className="drawer-form__input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="drawer-form__field">
          <label className="drawer-form__label">{t('drawer.time')}</label>
          <input
            className="drawer-form__input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className="drawer-form__row">
        <div className="drawer-form__field">
          <label className="drawer-form__label">{t('drawer.weight')}</label>
          <input
            className="drawer-form__input"
            type="number"
            min={0}
            max={100}
            step={1}
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="drawer-form__field">
          <label className="drawer-form__label">{t('drawer.location')}</label>
          <input
            className="drawer-form__input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={language === 'es' ? 'Aula, campus virtual…' : 'Room, online…'}
          />
        </div>
      </div>

      {error && <div className="drawer-form__error">{error}</div>}

      <div className="drawer-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={submit}
        >
          <span className="material-symbols-outlined">check</span>
          {saving ? '…' : (t('common.save') || (language === 'es' ? 'Guardar' : 'Save'))}
        </button>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>
          {t('drawer.close')}
        </button>
      </div>
    </div>
  )
}

// ─── Drawer body (editable study plan) ───────────────────────────────────
function EvalDrawerBody({
  exam,
  subjects,
  onSavePlan,
  onSaveHours,
  onDelete,
}: {
  exam: Exam
  subjects: Subject[]
  onSavePlan: (plan: StudyStep[]) => Promise<void>
  onSaveHours: (h: number | null) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t, language } = useTranslation()
  const info = subjectInfo(exam.subject_id, subjects)
  const tagClass = subjectTag(info.color)
  const weightLabel = exam.percentage != null
    ? t('evaluaciones.weightLabel').replace('{n}', String(exam.percentage))
    : null
  const tipoText = activityLabel(exam.activity_type, language)
  const { day, month } = formatDayMonth(exam.exam_date, language)
  const row = useMemo(() => computeRow(exam, language, t), [exam, language, t])

  const initialPlan = Array.isArray(exam.study_plan) ? exam.study_plan : []
  const completedCount = initialPlan.filter(s => s.done).length

  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [editingHours, setEditingHours] = useState(false)
  const [hoursDraft, setHoursDraft] = useState(
    exam.estimated_hours != null ? String(exam.estimated_hours) : ''
  )

  const updatePlan = (next: StudyStep[]) => onSavePlan(next)

  const toggleStep = (idx: number) => {
    const next = initialPlan.map((s, i) => i === idx ? { ...s, done: !s.done } : s)
    void updatePlan(next)
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditingText(initialPlan[idx]?.text || '')
  }

  const commitEdit = () => {
    if (editingIdx === null) return
    const text = editingText.trim()
    if (!text) {
      // empty → delete the step
      const next = initialPlan.filter((_, i) => i !== editingIdx)
      void updatePlan(next)
    } else {
      const next = initialPlan.map((s, i) => i === editingIdx ? { ...s, text } : s)
      void updatePlan(next)
    }
    setEditingIdx(null)
    setEditingText('')
  }

  const cancelEdit = () => { setEditingIdx(null); setEditingText('') }

  const deleteStep = (idx: number) => {
    const next = initialPlan.filter((_, i) => i !== idx)
    void updatePlan(next)
  }

  const addStep = () => {
    const text = addText.trim()
    if (!text) { setAddOpen(false); setAddText(''); return }
    const next = [...initialPlan, { text, done: false }]
    void updatePlan(next)
    setAddText('')
    setAddOpen(false)
  }

  const commitHours = () => {
    setEditingHours(false)
    const num = hoursDraft.trim() === '' ? null : Number(hoursDraft)
    if (num !== null && (isNaN(num) || num < 0)) {
      setHoursDraft(exam.estimated_hours != null ? String(exam.estimated_hours) : '')
      return
    }
    void onSaveHours(num)
  }

  const countdownColor =
    row.countdownTone === 'danger'  ? 'var(--danger)' :
    row.countdownTone === 'warning' ? 'var(--warning)' :
                                     'var(--on-surface)'

  return (
    <div className={tagClass}>
      <div className="drawer-chips">
        <span className="subj-chip">{info.code}</span>
        <span className="tipo-chip">{tipoText}</span>
        {weightLabel && <span className="pct-chip">{weightLabel}</span>}
      </div>

      <div className="drawer-section">
        <div className="drawer-section__label">{t('drawer.detail')}</div>
        <div className="drawer-meta">
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.date')}</span>
            <span className="drawer-meta__value is-mono">
              {day} {month}{exam.exam_time ? ` · ${exam.exam_time.slice(0, 5)}` : ''}
            </span>
          </div>
          {exam.location && (
            <div className="drawer-meta__row">
              <span className="drawer-meta__label">{t('drawer.location')}</span>
              <span className="drawer-meta__value">{exam.location}</span>
            </div>
          )}
          {exam.percentage != null && (
            <div className="drawer-meta__row">
              <span className="drawer-meta__label">{t('drawer.weight')}</span>
              <span className="drawer-meta__value is-mono">{exam.percentage}%</span>
            </div>
          )}
          <div className="drawer-meta__row">
            <span className="drawer-meta__label">{t('drawer.countdown')}</span>
            <span className="drawer-meta__value is-mono" style={{ color: countdownColor }}>
              {row.countdown}
            </span>
          </div>
          {exam.grade != null && (
            <div className="drawer-meta__row">
              <span className="drawer-meta__label">{t('drawer.grade')}</span>
              <span className="drawer-meta__value is-mono">
                {Number(exam.grade).toFixed(1)} / {exam.max_grade ?? 20}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="drawer-section">
        <div className="drawer-progress-row" style={{ marginBottom: 6 }}>
          <span className="drawer-section__label" style={{ marginBottom: 0 }}>
            {t('drawer.preparation')}
          </span>
          <span style={{ color: 'var(--on-surface)' }}>{row.prep}%</span>
        </div>
        <div className="drawer-progress" aria-hidden>
          <div className="drawer-progress__fill" style={{ width: `${row.prep}%` }} />
        </div>
      </div>

      <div className="drawer-section">
        <div className="drawer-section__label">{t('drawer.studyPlan')}</div>
        <div className="drawer-stats">
          <div
            className="drawer-stat drawer-stat--editable"
            onClick={() => { if (!editingHours) { setEditingHours(true); setHoursDraft(exam.estimated_hours != null ? String(exam.estimated_hours) : '') } }}
          >
            <div className="drawer-stat__label">{t('drawer.studyHours')}</div>
            {editingHours ? (
              <input
                autoFocus
                type="number"
                min={0}
                step={0.5}
                value={hoursDraft}
                onChange={(e) => setHoursDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitHours() }
                  else if (e.key === 'Escape') { setEditingHours(false); setHoursDraft(exam.estimated_hours != null ? String(exam.estimated_hours) : '') }
                }}
                onBlur={commitHours}
                placeholder={t('evaluaciones.hoursPlaceholder')}
              />
            ) : (
              <div className="drawer-stat__value">
                {exam.estimated_hours != null
                  ? `${exam.estimated_hours}${t('evaluaciones.hoursUnit')}`
                  : t('evaluaciones.hoursPlaceholder')}
              </div>
            )}
          </div>
          <div className="drawer-stat">
            <div className="drawer-stat__label">{t('drawer.completed')}</div>
            <div className="drawer-stat__value">{completedCount}/{initialPlan.length}</div>
          </div>
        </div>

        <div className="drawer-checklist">
          {initialPlan.map((step, idx) => (
            <div
              key={idx}
              className={`drawer-step${step.done ? ' is-done' : ''}`}
              onClick={(e) => {
                if (editingIdx === idx) return
                // Click outside the input toggles done
                const target = e.target as HTMLElement
                if (target.closest('.drawer-step__delete') || target.closest('.drawer-step__edit-input')) return
                toggleStep(idx)
              }}
            >
              <span className="drawer-step__check" aria-hidden onClick={(e) => { e.stopPropagation(); toggleStep(idx) }}>
                <span className="material-symbols-outlined">check</span>
              </span>
              {editingIdx === idx ? (
                <input
                  autoFocus
                  className="drawer-step__edit-input"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitEdit}
                  placeholder={t('evaluaciones.editPlaceholder')}
                />
              ) : (
                <span
                  className="drawer-step__text"
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(idx) }}
                  title={language === 'es' ? 'Doble click para editar' : 'Double-click to edit'}
                >
                  {step.text}
                </span>
              )}
              <button
                type="button"
                className="drawer-step__delete"
                onClick={(e) => { e.stopPropagation(); deleteStep(idx) }}
                aria-label={t('evaluaciones.deleteStep')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          ))}
        </div>

        {addOpen ? (
          <div className="drawer-add-step-active">
            <input
              autoFocus
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addStep() }
                else if (e.key === 'Escape') { e.preventDefault(); setAddOpen(false); setAddText('') }
              }}
              onBlur={() => { if (!addText.trim()) { setAddOpen(false); setAddText('') } }}
              placeholder={t('evaluaciones.stepPlaceholder')}
            />
            <span className="quick-add__hint">{t('tareas.quickHint')}</span>
          </div>
        ) : (
          <button type="button" className="drawer-add-step" onClick={() => setAddOpen(true)}>
            <span className="material-symbols-outlined">add</span>
            {t('evaluaciones.addStep')}
          </button>
        )}
      </div>

      <div className="drawer-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          <span className="material-symbols-outlined">delete</span>
          {t('drawer.delete')}
        </button>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function EvaluacionesPage() {
  const { t, language } = useTranslation()
  const supabase = useMemo(() => createClient(), [])

  const router = useRouter()
  const searchParams = useSearchParams()

  const [exams, setExams] = useState<Exam[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const fetchAll = useCallback(async () => {
    const [ex, sb, tk] = await Promise.all([
      supabase.from('exams').select('*').order('exam_date'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('tasks').select('*'),
    ])

    let allExams = (ex.data ?? []) as Exam[]

    // Overlay teacher-assigned grades from exam_grades
    const teacherExamIds = allExams.filter(e => e.assigned_by).map(e => e.id)
    if (teacherExamIds.length > 0) {
      const { data: grades } = await supabase
        .from('exam_grades')
        .select('exam_id, grade')
        .in('exam_id', teacherExamIds)
      if (grades) {
        const gmap = new Map(grades.map(g => [g.exam_id, g.grade]))
        allExams = allExams.map(e => {
          if (!e.assigned_by) return e
          return gmap.has(e.id) ? { ...e, grade: gmap.get(e.id) ?? null } : e
        })
      }
    }

    // Normalize study_plan to always be an array
    allExams = allExams.map(e => ({
      ...e,
      study_plan: Array.isArray(e.study_plan) ? e.study_plan : [],
    }))

    setExams(allExams)
    if (sb.data) setSubjects(sb.data as Subject[])
    if (tk.data) setTasks(tk.data as Task[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
    const ch = supabase.channel('evaluaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_grades' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, fetchAll])

  // Auto-open create form when arriving via ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreating(true)
      router.replace('/evaluaciones', { scroll: false })
    }
  }, [searchParams, router])

  // Derive upcoming rows
  const todayISO = new Date().toISOString().slice(0, 10)
  const upcomingExams = useMemo(
    () => exams.filter(e => e.exam_date >= todayISO),
    [exams, todayISO],
  )

  const rows = useMemo(
    () => upcomingExams.map(e => computeRow(e, language, t)),
    [upcomingExams, language, t],
  )

  const counts = {
    total: rows.length,
    urgent: rows.filter(r => r.urgency === 'today').length,
    week: rows.filter(r => r.urgency === 'today' || r.urgency === 'tomorrow' || r.urgency === 'soon').length,
  }
  const sub = t('evaluaciones.subTpl')
    .replace('{n}', String(counts.total))
    .replace('{urgent}', String(counts.urgent))
    .replace('{week}', String(counts.week))

  const openCard = (id: string) => setDrawerId(id)

  const drawerExam = drawerId ? exams.find(e => e.id === drawerId) ?? null : null

  const saveStudyPlan = async (examId: string, plan: StudyStep[]) => {
    setExams(prev => prev.map(e => e.id === examId ? { ...e, study_plan: plan } : e))
    await supabase.from('exams').update({ study_plan: plan }).eq('id', examId)
  }
  const saveEstimatedHours = async (examId: string, hours: number | null) => {
    setExams(prev => prev.map(e => e.id === examId ? { ...e, estimated_hours: hours } : e))
    await supabase.from('exams').update({ estimated_hours: hours }).eq('id', examId)
  }
  const deleteExam = async (examId: string) => {
    setExams(prev => prev.filter(e => e.id !== examId))
    if (drawerId === examId) setDrawerId(null)
    await supabase.from('exams').delete().eq('id', examId)
  }

  // Real DashMetaBar values
  const avg = computeWeightedAvg(subjects, exams)
  const alertDueLabel = computeAlertDueLabel(tasks, exams, language)

  return (
    <div className="max-w-[1240px] mx-auto reveal-stagger">
      <DashMetaBar
        avg={avg}
        alertDueLabel={alertDueLabel}
      />

      <header className="screen-head" style={{ marginTop: 14 }}>
        <div className="screen-head__left">
          <span className="kicker">{t('evaluaciones.eyebrow')}</span>
          <h1 className="screen-head__title">
            {t('evaluaciones.titleA')} <span className="serif">{t('evaluaciones.titleSerif')}</span>
          </h1>
          <p className="screen-head__sub">{loading ? '…' : sub}</p>
        </div>

        <div className="screen-head__actions">
          <button type="button" className="btn btn-secondary">
            <span className="material-symbols-outlined">tune</span>
            {t('evaluaciones.filter')}
          </button>
          <button type="button" className="btn-new" onClick={() => setCreating(true)}>
            <span className="material-symbols-outlined">add</span>
            {t('evaluaciones.add')}
          </button>
        </div>
      </header>

      {!loading && rows.length === 0 ? (
        <div
          className="kan-col__empty"
          style={{ marginTop: 32, padding: 40, textAlign: 'center' }}
        >
          {t('evaluaciones.empty')}
        </div>
      ) : (
        <section className="timeline">
          {rows.map(row => (
            <EvalRow
              key={row.exam.id}
              row={row}
              subjects={subjects}
              onOpen={openCard}
            />
          ))}
        </section>
      )}

      <SideDrawer
        open={creating || !!drawerId}
        onClose={() => { setCreating(false); setDrawerId(null) }}
        kicker={creating
          ? (language === 'es' ? 'Nueva' : 'New')
          : t('drawer.detail')}
        title={creating
          ? (language === 'es' ? 'Crear evaluación' : 'Create exam')
          : (drawerExam ? drawerExam.title : '')}
      >
        {creating ? (
          <ExamCreateForm
            subjects={subjects}
            onSaved={() => { setCreating(false); fetchAll() }}
            onCancel={() => setCreating(false)}
          />
        ) : drawerExam && (
          <EvalDrawerBody
            exam={drawerExam}
            subjects={subjects}
            onSavePlan={(plan) => saveStudyPlan(drawerExam.id, plan)}
            onSaveHours={(h) => saveEstimatedHours(drawerExam.id, h)}
            onDelete={() => deleteExam(drawerExam.id)}
          />
        )}
      </SideDrawer>
    </div>
  )
}
