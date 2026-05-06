'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { SubjectModal, ScheduleManager } from '@/features/subjects/components/SubjectModal'
import { IconPicker } from '@/features/subjects/components/IconPicker'
import { SubjectDetail } from '@/features/subjects/components/SubjectDetail'
import type { Subject, Schedule } from '@/types'
import { getSubjectIcon } from '@/features/subjects/utils'

export default function SubjectsPage() {
  const { t } = useTranslation()
  const [subjects,         setSubjects]         = useState<Subject[]>([])
  const [enrolledSubjects, setEnrolledSubjects] = useState<(Subject & { is_enrolled: true; teacher_name: string | null })[]>([])
  const [schedules,        setSchedules]        = useState<Schedule[]>([])
  const [examProgress,     setExamProgress]     = useState<Record<string, { earned: number; graded: number; total: number }>>({})
  const [loading,          setLoading]          = useState(true)
  const [modalOpen,        setModalOpen]        = useState(false)
  const [joinOpen,         setJoinOpen]         = useState(false)
  const [joinCode,         setJoinCode]         = useState('')
  const [joinLoading,      setJoinLoading]      = useState(false)
  const [joinError,        setJoinError]        = useState('')
  const [editingSubject,   setEditingSubject]   = useState<Subject | null>(null)
  const [expandedSubject,  setExpandedSubject]  = useState<string | null>(null)
  const [deleteConfirm,    setDeleteConfirm]    = useState<string | null>(null)
  const [iconPickerOpen,   setIconPickerOpen]   = useState<string | null>(null)
  const [kebabOpen,        setKebabOpen]        = useState<string | null>(null)
  const [detailSubject,    setDetailSubject]    = useState<Subject | null>(null)
  const [detailTab,        setDetailTab]        = useState<'progress' | 'chat'>('progress')

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: subs }, { data: scheds }, { data: examData }, { data: enrollmentData }, { data: gradeData }] = await Promise.all([
      supabase.from('subjects').select('*').order('created_at', { ascending: true }),
      supabase.from('schedules').select('*'),
      supabase.from('exams').select('id,subject_id,percentage,grade,submission_status,activity_type,assigned_by').neq('activity_type', 'study_session'),
      user ? supabase
        .from('enrollments')
        .select('subject_id, subjects(*, profiles!subjects_teacher_id_fkey(full_name))')
        .eq('student_id', user.id)
        .eq('status', 'active')
        : Promise.resolve({ data: [] }),
      user ? supabase
        .from('exam_grades')
        .select('exam_id, grade')
        .eq('student_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    setSubjects(subs || [])
    setSchedules(scheds || [])

    const rawEnrollments = (enrollmentData || []) as unknown as {
      subject_id: string
      subjects: (Subject & { profiles?: { full_name?: string } | null }) | null
    }[]
    const enrolled = rawEnrollments.map((e) => {
      const s = e.subjects
      if (!s) return null
      const teacherName = s.profiles?.full_name ?? null
      return { ...s, is_enrolled: true as const, teacher_name: teacherName }
    }).filter(Boolean) as (Subject & { is_enrolled: true; teacher_name: string | null })[]
    setEnrolledSubjects(enrolled)

    const teacherGradeMap: Record<string, number | null> = {}
    for (const g of (gradeData || [])) {
      const eg = g as { exam_id: string; grade: number | null }
      teacherGradeMap[eg.exam_id] = eg.grade
    }

    const progressMap: Record<string, { earned: number; graded: number; total: number }> = {}
    for (const e of (examData || [])) {
      if (!e.subject_id || e.percentage == null) continue
      if (!progressMap[e.subject_id]) progressMap[e.subject_id] = { earned: 0, graded: 0, total: 0 }
      progressMap[e.subject_id].total++
      const grade = e.assigned_by ? (teacherGradeMap[e.id] ?? null) : e.grade
      if (grade !== null && grade !== undefined) {
        progressMap[e.subject_id].earned += (grade * (e.percentage ?? 0)) / 100
        progressMap[e.subject_id].graded++
      }
    }
    setExamProgress(progressMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinLoading(true)
    setJoinError('')
    try {
      const res = await fetch('/api/subjects/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setJoinError(data.error || 'Error al unirse')
        return
      }
      setJoinOpen(false)
      setJoinCode('')
      fetchData()
    } catch {
      setJoinError('Error de conexión. Intenta de nuevo.')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('subjects').delete().eq('id', id)
    setDeleteConfirm(null); fetchData()
  }

  const handleIconSelect = async (subjectId: string, icon: string) => {
    const supabase = createClient()
    await supabase.from('subjects').update({ icon }).eq('id', subjectId)
    setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, icon } : s))
    setIconPickerOpen(null)
  }

  const schedulesBySubject = (sid: string) => schedules.filter(s => s.subject_id === sid)

  // Aggregate stats for header
  const totalCredits = subjects.reduce((acc, s) => acc + (s.credits || 0), 0)
  const passingCount = subjects.filter(s => {
    const p = examProgress[s.id]
    return p && p.earned >= 9.5
  }).length

  return (
    <div className="reveal-stagger">

      {/* ─────────── Screen header ─────────── */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">{t('subjects.title')} · 2026</span>
          <h1 className="screen-head__title">
            <span className="serif">mis clases</span>
          </h1>
          <p className="screen-head__sub">
            <span className="font-mono tabular">{subjects.length}</span> {subjects.length === 1 ? 'materia activa' : 'materias activas'}
            {totalCredits > 0 && <> · <span className="font-mono tabular">{totalCredits}</span> créditos</>}
            {passingCount > 0 && <> · <span style={{ color: 'var(--success)' }}>{passingCount} aprobando</span></>}
          </p>
        </div>
        <div className="screen-head__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setJoinCode(''); setJoinError(''); setJoinOpen(true) }}
          >
            <span className="material-symbols-outlined">input</span>
            {t('subjects.joinWithCode')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setEditingSubject(null); setModalOpen(true) }}
            id="add-subject-btn"
          >
            <span className="material-symbols-outlined">add</span>
            Nueva
          </button>
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-44" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && subjects.length === 0 && enrolledSubjects.length === 0 && (
        <div className="card text-center py-16" style={{ background: 'var(--s-low)' }}>
          <div className="inline-flex w-16 h-16 rounded-[14px] items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-primary)' }}>menu_book</span>
          </div>
          <p className="text-[15px] font-bold mb-1" style={{ color: 'var(--on-surface)' }}>{t('subjects.noSubjects')}</p>
          <p className="text-[12.5px] mb-5" style={{ color: 'var(--color-outline)' }}>Agrega tu primera materia para empezar</p>
          <button onClick={() => { setEditingSubject(null); setModalOpen(true) }} className="btn btn-primary">
            <span className="material-symbols-outlined">add_circle</span>
            {t('subjects.add')}
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && subjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {subjects.map((subject) => {
            const subjectSchedules = schedulesBySubject(subject.id)
            const prog = examProgress[subject.id]
            const isPassing = prog && prog.earned >= 9.5
            const isRisk = prog && prog.earned > 0 && prog.earned < 9.5
            const status = !prog || prog.graded === 0 ? 'pending' : isPassing ? 'pass' : isRisk ? 'risk' : 'fail'
            const pct = prog ? Math.min((prog.earned / 20) * 100, 100) : 0
            const completePct = prog && prog.total > 0 ? Math.round((prog.graded / prog.total) * 100) : 0

            const statusBadge = {
              pass:    { label: 'APROBANDO',  color: 'var(--success)',   bg: 'color-mix(in srgb, var(--success) 16%, transparent)' },
              risk:    { label: 'EN RIESGO',  color: 'var(--warning)',   bg: 'color-mix(in srgb, var(--warning) 18%, transparent)' },
              fail:    { label: 'DESAPROBADO',color: 'var(--danger)',    bg: 'color-mix(in srgb, var(--danger) 18%, transparent)' },
              pending: { label: 'SIN NOTAS',  color: 'var(--color-outline)', bg: 'var(--s-base)' },
            }[status]

            return (
              <div
                key={subject.id}
                className="card group relative cursor-pointer transition-all hover:-translate-y-[1px]"
                style={{
                  background: 'var(--s-low)',
                  borderTop: `2px solid color-mix(in srgb, ${subject.color} 70%, transparent)`,
                  paddingTop: 14,
                }}
                onClick={() => { setDetailTab('progress'); setDetailSubject(subject) }}
              >
                {/* Top row: code + status badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: subject.color,
                      background: `color-mix(in srgb, ${subject.color} 15%, transparent)`,
                      padding: '2px 7px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                    }}
                  >
                    {subject.name.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="badge" style={{ background: statusBadge.bg, color: statusBadge.color }}>
                    {statusBadge.label}
                  </span>
                </div>

                {/* Icon + Title */}
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setIconPickerOpen(iconPickerOpen === subject.id ? null : subject.id) }}
                      className="w-9 h-9 rounded-[8px] flex items-center justify-center transition-all hover:brightness-125"
                      style={{ background: `color-mix(in srgb, ${subject.color} 14%, transparent)` }}
                      title="Cambiar ícono"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                        {subject.icon || getSubjectIcon(subject.name)}
                      </span>
                    </button>
                    {iconPickerOpen === subject.id && (
                      <IconPicker
                        currentIcon={subject.icon || getSubjectIcon(subject.name)}
                        subjectColor={subject.color}
                        onSelect={(icon) => handleIconSelect(subject.id, icon)}
                        onClose={() => setIconPickerOpen(null)}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[14px] font-bold leading-tight truncate" style={{ color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                      {subject.name}
                    </h2>
                    {subject.professor && (
                      <p className="text-[11px] mt-0.5 flex items-center gap-1 truncate" style={{ color: 'var(--color-outline)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>person</span>
                        <span className="truncate">{subject.professor}</span>
                      </p>
                    )}
                  </div>

                  {/* Kebab menu */}
                  <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setKebabOpen(kebabOpen === subject.id ? null : subject.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-[6px] transition hover:bg-white/5"
                      style={{ color: 'var(--color-outline)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>more_vert</span>
                    </button>
                    {kebabOpen === subject.id && (
                      <div className="absolute right-0 top-8 z-20 rounded-[10px] overflow-hidden shadow-xl"
                        style={{ background: 'var(--s-high)', border: '1px solid var(--border-default)', minWidth: 150 }}>
                        <KebabAction icon="edit" label="Editar" onClick={(e) => { e.stopPropagation(); setEditingSubject(subject); setModalOpen(true); setKebabOpen(null) }} />
                        <KebabAction icon="calendar_month" label="Horarios" onClick={(e) => { e.stopPropagation(); setExpandedSubject(expandedSubject === subject.id ? null : subject.id); setKebabOpen(null) }} />
                        <KebabAction icon="auto_awesome" label="Chat IA" onClick={(e) => { e.stopPropagation(); setDetailTab('chat'); setDetailSubject(subject); setKebabOpen(null) }} accent="var(--color-tertiary)" />
                        <KebabAction icon="delete" label="Eliminar" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(subject.id); setKebabOpen(null) }} accent="var(--danger)" />
                      </div>
                    )}
                  </div>
                </div>

                {/* KPI metrics box */}
                <div
                  className="grid grid-cols-3 gap-2 mt-3 mb-3 px-3 py-2.5 rounded-[8px]"
                  style={{ background: 'var(--s-bg)', border: '1px solid var(--border-subtle)' }}
                >
                  <Metric label="Promedio" value={prog?.earned ? prog.earned.toFixed(1) : '—'} unit="/20" tone={status} />
                  <Metric label="Créditos" value={String(subject.credits || 0)} />
                  <Metric label="Avance" value={String(completePct) + '%'} />
                </div>

                {/* Progress bar */}
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: status === 'pass' ? 'var(--success)' : status === 'risk' ? 'var(--warning)' : status === 'fail' ? 'var(--danger)' : subject.color,
                    }}
                  />
                </div>

                {/* Schedule pills */}
                {subjectSchedules.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {subjectSchedules.slice(0, 2).map(s => (
                      <span
                        key={s.id}
                        className="font-mono inline-flex items-center gap-1"
                        style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 5,
                          background: `color-mix(in srgb, ${subject.color} 12%, transparent)`,
                          color: subject.color,
                          letterSpacing: '0.02em',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>schedule</span>
                        {t(`subjects.days.${s.day_of_week}`).slice(0, 3)} {s.start_time.slice(0, 5)}
                      </span>
                    ))}
                    {subjectSchedules.length > 2 && (
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-outline)' }}>
                        +{subjectSchedules.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded schedule manager */}
                {expandedSubject === subject.id && (
                  <div className="mt-4 pt-3 animate-slide-up" style={{ borderTop: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
                    <ScheduleManager
                      subject={subject}
                      schedules={schedulesBySubject(subject.id)}
                      onUpdated={fetchData}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Add card */}
          <button
            onClick={() => { setEditingSubject(null); setModalOpen(true) }}
            className="card group flex flex-col items-center justify-center min-h-[200px] transition-all"
            style={{
              background: 'transparent',
              border: '1px dashed var(--border-default)',
            }}
          >
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center transition-all"
              style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-outline)' }}>add</span>
            </div>
            <p className="text-[13px] font-bold mt-3" style={{ color: 'var(--on-surface)' }}>Nueva materia</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-outline)' }}>Agregar al curriculum</p>
          </button>
        </div>
      )}

      {/* Enrolled subjects section */}
      {!loading && enrolledSubjects.length > 0 && (
        <div className="mt-8">
          <div className="section-head">
            <div className="section-head__left">
              <span className="kicker">{t('subjects.enrolledSection')}</span>
            </div>
          </div>
          <h2 className="text-[18px] font-bold tracking-tight mb-3" style={{ color: 'var(--on-surface)', letterSpacing: '-0.018em' }}>
            <span className="serif">{t('subjects.enrolledTitle')}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrolledSubjects.map((subject) => {
              const prog = examProgress[subject.id]
              const isPassing = prog && prog.earned >= 9.5
              const pct = prog ? Math.min((prog.earned / 20) * 100, 100) : 0
              return (
                <div
                  key={subject.id}
                  className="card relative"
                  style={{
                    background: 'var(--s-low)',
                    borderTop: `2px solid color-mix(in srgb, ${subject.color} 70%, transparent)`,
                  }}
                >
                  <span className="badge badge--ai absolute top-3 right-3">{t('subjects.enrolled')}</span>

                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${subject.color} 14%, transparent)` }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                        {subject.icon || getSubjectIcon(subject.name)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pr-16">
                      <p className="text-[14px] font-bold truncate" style={{ color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                        {subject.name}
                      </p>
                      {subject.teacher_name && (
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                          Prof. {subject.teacher_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="progress-bar mt-2">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: isPassing ? 'var(--success)' : prog ? 'var(--color-primary)' : 'var(--border-strong)',
                      }}
                    />
                  </div>
                  <p className="font-mono mt-2" style={{ fontSize: 10, color: isPassing ? 'var(--success)' : 'var(--color-outline)', letterSpacing: '0.04em' }}>
                    {prog ? `${prog.earned.toFixed(1)} / 20` : 'Sin notas aún'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Subject Modal */}
      {modalOpen && (
        <SubjectModal
          subject={editingSubject}
          onClose={() => setModalOpen(false)}
          onSaved={fetchData}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content max-w-sm" role="dialog" aria-modal="true">
            <h2 className="text-[16px] font-bold mb-2" style={{ color: 'var(--on-surface)' }}>{t('subjects.confirmDelete')}</h2>
            <p className="text-[13px] mb-5" style={{ color: 'var(--color-outline)' }}>{t('subjects.confirmDeleteDesc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger flex-1">{t('subjects.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Detail */}
      {detailSubject && (
        <SubjectDetail
          subject={detailSubject}
          onClose={() => setDetailSubject(null)}
          initialTab={detailTab}
        />
      )}

      {/* Join with code modal */}
      {joinOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setJoinOpen(false); setJoinError('') } }}>
          <div className="modal-content max-w-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--on-surface)' }}>
                <span className="serif">{t('subjects.joinTitle')}</span>
              </h2>
              <button onClick={() => setJoinOpen(false)} className="btn btn-icon btn-ghost" aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-[12.5px] mt-1 mb-4" style={{ color: 'var(--on-surface-variant)' }}>
              {t('subjects.joinDesc')}
            </p>
            <form onSubmit={handleJoin} className="flex flex-col gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="MAT-2026-XK3"
                className="input font-mono text-center"
                style={{ letterSpacing: '0.16em', fontSize: 16, height: 48 }}
                autoFocus
                maxLength={12}
              />
              {joinError && (
                <div
                  role="alert"
                  className="text-[12px] rounded-[10px] px-3 py-2.5"
                  style={{
                    background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
                    color: 'var(--danger)',
                    border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)',
                  }}
                >
                  {joinError}
                </div>
              )}
              <button type="submit" disabled={joinLoading || !joinCode.trim()} className="btn btn-primary w-full" style={{ height: 42 }}>
                {joinLoading ? t('common.loading') : t('subjects.joinBtn')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit?: string
  tone?: 'pass' | 'risk' | 'fail' | 'pending'
}) {
  const color = tone === 'pass'
    ? 'var(--success)'
    : tone === 'risk'
      ? 'var(--warning)'
      : tone === 'fail'
        ? 'var(--danger)'
        : 'var(--on-surface)'

  return (
    <div className="flex flex-col">
      <span className="font-mono" style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-outline)' }}>
        {label}
      </span>
      <span className="font-mono mt-0.5 tabular flex items-baseline gap-0.5" style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.01em' }}>
        {value}
        {unit && <span style={{ fontSize: 10, color: 'var(--color-outline)', fontWeight: 500 }}>{unit}</span>}
      </span>
    </div>
  )
}

function KebabAction({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: string
  label: string
  accent?: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-left transition hover:bg-white/5"
      style={{ color: accent || 'var(--on-surface)' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  )
}
