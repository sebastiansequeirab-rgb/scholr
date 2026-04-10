'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { daysUntil, formatTime } from '@/lib/utils'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import type { Exam, Subject, ActivityType } from '@/types'
import { ACTIVITY_TYPES } from '@/types'

interface ActivityFormProps {
  exam?: Exam | null
  subjects: Subject[]
  onClose: () => void
  onSaved: () => void
}

function ActivityForm({ exam, subjects, onClose, onSaved }: ActivityFormProps) {
  const { t, language } = useTranslation()
  const isEditing = !!exam

  const [activityType, setActivityType] = useState<ActivityType>(exam?.activity_type || 'exam')
  const [title,        setTitle]        = useState(exam?.title || '')
  const [subjectId,    setSubjectId]    = useState(exam?.subject_id || '')
  const [examDate,     setExamDate]     = useState(exam?.exam_date || '')
  const [examTime,     setExamTime]     = useState(exam?.exam_time || '')
  const [percentage,   setPercentage]   = useState<string>(exam?.percentage != null ? String(exam.percentage) : '')
  const [location,     setLocation]     = useState(exam?.location || '')
  const [notes,        setNotes]        = useState(exam?.notes || '')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [autoFilled,   setAutoFilled]   = useState(false)

  const typeCfg = ACTIVITY_TYPES[activityType]

  // Auto-fill time + room from schedule when subject or date changes
  useEffect(() => {
    if (!subjectId || isEditing) return
    const fetchSchedule = async () => {
      const supabase = createClient()
      let query = supabase.from('schedules').select('*').eq('subject_id', subjectId)
      if (examDate) {
        const dow = new Date(examDate + 'T12:00:00').getDay()
        query = query.eq('day_of_week', dow)
      }
      const { data } = await query.limit(1).maybeSingle()
      if (data) {
        setExamTime(data.start_time?.slice(0, 5) || '')
        setLocation(data.room || '')
        setAutoFilled(true)
      } else if (!examDate) {
        const { data: fallback } = await supabase
          .from('schedules').select('*').eq('subject_id', subjectId).limit(1).maybeSingle()
        if (fallback) {
          setExamTime(fallback.start_time?.slice(0, 5) || '')
          setLocation(fallback.room || '')
          setAutoFilled(true)
        }
      }
    }
    fetchSchedule()
  }, [subjectId, examDate, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !examDate) { setError(t('auth.errors.required')); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const pctNum = percentage !== '' ? parseFloat(percentage) : null
    const payload = {
      user_id: user.id, title: title.trim(),
      subject_id: subjectId || null, exam_date: examDate,
      exam_time: examTime || null, location: location.trim() || null,
      notes: notes.trim() || null,
      activity_type: activityType,
      percentage: pctNum,
    }
    const { error: dbError } = isEditing
      ? await supabase.from('exams').update(payload).eq('id', exam!.id)
      : await supabase.from('exams').insert(payload)
    if (dbError) { setError(dbError.message); setLoading(false); return }
    onSaved(); onClose()
  }

  const TYPE_ORDER: ActivityType[] = ['exam', 'workshop', 'activity', 'task', 'study_session']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--on-surface)' }}>
          {isEditing ? t('activities.edit') : t('activities.add')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Activity type selector */}
          <div>
            <label className="label">{t('activities.type')}</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TYPE_ORDER.map(type => {
                const cfg = ACTIVITY_TYPES[type]
                const isActive = activityType === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActivityType(type)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all border"
                    style={{
                      backgroundColor: isActive ? `${cfg.color}15` : 'var(--s-base)',
                      borderColor:     isActive ? cfg.color : 'var(--border-subtle)',
                      color:           isActive ? cfg.color : 'var(--color-outline)',
                    }}
                    title={language === 'es' ? cfg.label_es : cfg.label_en}
                  >
                    <span className="material-symbols-outlined text-[18px]"
                      style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                      {cfg.icon}
                    </span>
                    <span className="text-[8px] font-semibold text-center leading-tight">
                      {language === 'es' ? cfg.label_es : cfg.label_en}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="actTitle" className="label">{t('activities.activityTitle')} *</label>
            <input id="actTitle" className="input" value={title} onChange={e => setTitle(e.target.value)} aria-required="true" />
          </div>
          <div>
            <label htmlFor="actSubject" className="label">{t('tasks.subject')}</label>
            <select id="actSubject" className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">{t('tasks.noSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {autoFilled && (
            <div className="flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
              {t('activities.autoFilled')}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="actDate" className="label">{t('activities.date')} *</label>
              <input id="actDate" type="date" className="input" value={examDate} onChange={e => setExamDate(e.target.value)} aria-required="true" />
            </div>
            <div>
              <label htmlFor="actTime" className="label">{t('activities.time')}</label>
              <input id="actTime" type="time" className="input" value={examTime} onChange={e => { setExamTime(e.target.value); setAutoFilled(false) }} />
            </div>
          </div>

          {/* Percentage — only for types that require it */}
          {typeCfg.requiresPercentage && (
            <div>
              <label htmlFor="actPct" className="label">{t('activities.percentage')}</label>
              <div className="relative">
                <input
                  id="actPct"
                  type="number"
                  min="0" max="100" step="0.5"
                  className="input pr-8"
                  placeholder="0 – 100"
                  value={percentage}
                  onChange={e => setPercentage(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                  style={{ color: 'var(--color-outline)' }}>%</span>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="actLocation" className="label">{t('activities.location')}</label>
            <input id="actLocation" className="input" value={location} onChange={e => { setLocation(e.target.value); setAutoFilled(false) }} />
          </div>
          <div>
            <label htmlFor="actNotes" className="label">{t('activities.notes')}</label>
            <textarea id="actNotes" className="input min-h-[80px] resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {error && (
            <p className="text-xs px-3 py-2.5 rounded-xl" role="alert"
              style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
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

export default function ExamsPage() {
  const { t, language } = useTranslation()
  const [exams,         setExams]         = useState<Exam[]>([])
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [loading,       setLoading]       = useState(true)
  const [modalOpen,     setModalOpen]     = useState(false)
  const [editingExam,   setEditingExam]   = useState<Exam | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { use12h } = useTimeFormat()

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: es }, { data: ss }] = await Promise.all([
      supabase.from('exams').select('*').order('exam_date'),
      supabase.from('subjects').select('*').order('name'),
    ])
    setExams(es || [])
    setSubjects(ss || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('exams').delete().eq('id', id)
    setDeleteConfirm(null); fetchData()
  }

  const now      = new Date().toISOString().split('T')[0]
  const upcoming = exams.filter(e => e.exam_date >= now)
  const past     = exams.filter(e => e.exam_date < now)
  const featured = upcoming[0] || null

  const ActivityCard = ({ exam, isFeatured = false }: { exam: Exam; isFeatured?: boolean }) => {
    const subject  = subjects.find(s => s.id === exam.subject_id)
    const days     = daysUntil(exam.exam_date)
    const typeCfg  = ACTIVITY_TYPES[exam.activity_type || 'exam']
    const typeColor = typeCfg.color
    const date     = new Date(exam.exam_date + 'T00:00:00')
    const typeLabel = language === 'es' ? typeCfg.label_es : typeCfg.label_en

    if (isFeatured) {
      const urgency = days < 0 ? 'var(--color-outline)' : days < 3 ? 'var(--danger)' : days < 7 ? 'var(--warning)' : 'var(--color-primary)'
      const daysLabel = days < 0 ? t('activities.past_label') : days === 0 ? t('activities.today') : days === 1 ? t('activities.tomorrow') : `${days} ${t('activities.daysLeft')}`
      return (
        <div className="rounded-2xl relative overflow-hidden"
          style={{
            backgroundColor: 'var(--s-low)',
            border: '1px solid var(--border-subtle)',
            borderTop: `3px solid ${typeColor}`,
          }}>
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-[80px] opacity-10 pointer-events-none"
            style={{ backgroundColor: typeColor }} />

          <div className="relative z-10 p-7">
            <div className="flex items-center gap-3 mb-5">
              {/* Type badge */}
              <span className="flex items-center gap-1.5 mono text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{typeCfg.icon}</span>
                {typeLabel}
              </span>
              {/* Countdown badge */}
              <span className="mono text-[11px] px-3 py-1 rounded-full font-bold uppercase tracking-widest inline-flex items-center gap-1.5"
                style={{
                  color: urgency,
                  border: `1px solid color-mix(in srgb, ${urgency} 30%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${urgency} 8%, transparent)`,
                }}>
                <span className="material-symbols-outlined text-[12px]">timer</span>
                {daysLabel}
              </span>
              <span className="mono text-[10px] capitalize" style={{ color: 'var(--color-outline)' }}>
                {date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--on-surface)' }}>
              {exam.title}
            </h2>
            {subject && (
              <span className="text-sm font-semibold" style={{ color: subject.color }}>{subject.name}</span>
            )}
            {exam.percentage != null && (
              <span className="ml-3 mono text-xs font-bold px-2 py-0.5 rounded-lg"
                style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
                {exam.percentage}%
              </span>
            )}

            {(exam.exam_time || exam.location || exam.notes) && (
              <div className="flex flex-wrap gap-5 mt-6 pt-5"
                style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {exam.exam_time && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--color-outline)' }}>schedule</span>
                    <div>
                      <span className="mono text-[9px] uppercase tracking-widest block leading-none mb-0.5" style={{ color: 'var(--color-outline)' }}>{t('activities.time')}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{formatTime(exam.exam_time, use12h)}</span>
                    </div>
                  </div>
                )}
                {exam.location && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--color-outline)' }}>location_on</span>
                    <div>
                      <span className="mono text-[9px] uppercase tracking-widest block leading-none mb-0.5" style={{ color: 'var(--color-outline)' }}>{t('activities.location')}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{exam.location}</span>
                    </div>
                  </div>
                )}
                {exam.notes && (
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[15px] mt-3.5" style={{ color: 'var(--color-outline)' }}>sticky_note_2</span>
                    <div>
                      <span className="mono text-[9px] uppercase tracking-widest block leading-none mb-0.5" style={{ color: 'var(--color-outline)' }}>{t('activities.notes')}</span>
                      <span className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{exam.notes}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2.5 mt-6">
              <button onClick={() => { setEditingExam(exam); setModalOpen(true) }}
                className="btn-secondary flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[15px]">edit</span>
                {t('common.edit')}
              </button>
              <button onClick={() => setDeleteConfirm(exam.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
                <span className="material-symbols-outlined text-[15px]">delete</span>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Regular card
    const urgency = days < 0 ? 'var(--color-outline)' : days < 3 ? 'var(--danger)' : days < 7 ? 'var(--warning)' : 'var(--color-primary)'
    return (
      <div className="rounded-2xl p-5 flex flex-col gap-3 group transition-all duration-200 hover:-translate-y-0.5"
        style={{
          backgroundColor: 'var(--s-low)',
          border: '1px solid var(--border-subtle)',
          borderLeft: `3px solid ${typeColor}`,
        }}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${typeColor}15` }}>
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: typeColor, fontVariationSettings: "'FILL' 1" }}>
                {typeCfg.icon}
              </span>
            </div>
            <div>
              <span className="mono text-[8px] font-bold uppercase block" style={{ color: typeColor }}>{typeLabel}</span>
              <span className="mono text-[10px] font-bold" style={{ color: urgency }}>
                {days === 0 ? t('activities.today') : days === 1 ? t('activities.tomorrow') : `${days}d`}
              </span>
            </div>
          </div>
          <span className="mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-outline)' }}>
            {date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div>
          <h3 className="text-sm font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>
            {exam.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            {subject && <p className="text-xs font-medium" style={{ color: subject.color }}>{subject.name}</p>}
            {exam.percentage != null && (
              <span className="mono text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${typeColor}15`, color: typeColor }}>
                {exam.percentage}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}>
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
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { setEditingExam(exam); setModalOpen(true) }}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined text-[14px]">edit</span>
            </button>
            <button onClick={() => setDeleteConfirm(exam.id)}
              className="p-1.5 rounded-lg hover:bg-red-400/10 transition-colors"
              style={{ color: 'var(--danger)' }}>
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-5">
        <div>
          <span className="mono text-[10px] tracking-[0.2em] uppercase font-medium block mb-2"
            style={{ color: 'var(--color-primary)' }}>{language === 'es' ? 'Actividades Académicas' : 'Academic Activities'}</span>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {t('activities.title')}
          </h1>
          {!loading && upcoming.length > 0 && (
            <p className="text-sm mt-1.5" style={{ color: 'var(--on-surface-variant)' }}>
              {upcoming.length} {language === 'es' ? `próxima${upcoming.length !== 1 ? 's' : ''}` : `upcoming`}
              {past.length > 0 && ` · ${past.length} ${language === 'es' ? `completada${past.length !== 1 ? 's' : ''}` : 'past'}`}
            </p>
          )}
        </div>
        <button onClick={() => { setEditingExam(null); setModalOpen(true) }} className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('activities.add')}
        </button>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32" />)}
        </div>
      )}

      {!loading && upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-24">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full blur-[40px] opacity-20"
              style={{ backgroundColor: 'var(--color-primary)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
              <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-primary)' }}>event_upcoming</span>
            </div>
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>{t('activities.noActivities')}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-outline)' }}>
            {language === 'es' ? 'Registra tu primera actividad para empezar a prepararte' : 'Add your first activity to get started'}
          </p>
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('activities.add')}
          </button>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {/* Featured */}
          {featured && <ActivityCard exam={featured} isFeatured />}

          {/* Only one + no past */}
          {featured && upcoming.length === 1 && past.length === 0 && (
            <div className="rounded-2xl p-5 flex items-center gap-4"
              style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                  {language === 'es' ? 'Sin más actividades programadas' : 'No more activities scheduled'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>
                  {language === 'es' ? 'Concentra tu preparación en la próxima actividad.' : 'Focus on the upcoming one.'}
                </p>
              </div>
            </div>
          )}

          {/* No upcoming + has past */}
          {!featured && past.length > 0 && (
            <div className="rounded-2xl p-5 flex items-center gap-4"
              style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                  event_available
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                  {language === 'es' ? 'Sin actividades próximas' : 'No upcoming activities'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>
                  {language === 'es' ? '¡Todas tus actividades registradas ya pasaron!' : 'All your registered activities are done!'}
                </p>
              </div>
            </div>
          )}

          {/* Rest of upcoming */}
          {upcoming.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upcoming.slice(1).map(e => <ActivityCard key={e.id} exam={e} />)}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="mono text-[10px] uppercase tracking-widest cursor-pointer mb-4 flex items-center gap-2 select-none"
                style={{ color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[13px]">history</span>
                {t('activities.past')} ({past.length})
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 opacity-55">
                {past.slice(0, 6).map(e => <ActivityCard key={e.id} exam={e} />)}
              </div>
            </details>
          )}
        </div>
      )}

      {modalOpen && (
        <ActivityForm exam={editingExam} subjects={subjects} onClose={() => setModalOpen(false)} onSaved={fetchData} />
      )}

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm" role="dialog">
            <h2 className="font-bold mb-2" style={{ color: 'var(--on-surface)' }}>{t('subjects.confirmDelete')}</h2>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
