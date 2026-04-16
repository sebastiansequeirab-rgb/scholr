'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { SubjectModal, ScheduleManager } from '@/components/subjects/SubjectModal'
import { IconPicker } from '@/components/subjects/IconPicker'
import { SubjectDetail } from '@/components/subjects/SubjectDetail'
import type { Subject, Schedule } from '@/types'
import { getSubjectIcon } from '@/lib/subjects/utils'

export default function SubjectsPage() {
  const { t } = useTranslation()
  const [subjects,         setSubjects]         = useState<Subject[]>([])
  const [schedules,        setSchedules]        = useState<Schedule[]>([])
  const [examProgress,     setExamProgress]     = useState<Record<string, { earned: number; graded: number; total: number }>>({})
  const [loading,          setLoading]          = useState(true)
  const [modalOpen,        setModalOpen]        = useState(false)
  const [editingSubject,   setEditingSubject]   = useState<Subject | null>(null)
  const [expandedSubject,  setExpandedSubject]  = useState<string | null>(null)
  const [deleteConfirm,    setDeleteConfirm]    = useState<string | null>(null)
  const [iconPickerOpen,   setIconPickerOpen]   = useState<string | null>(null)
  const [kebabOpen,        setKebabOpen]        = useState<string | null>(null)
  const [detailSubject,    setDetailSubject]    = useState<Subject | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: subs }, { data: scheds }, { data: examData }] = await Promise.all([
      supabase.from('subjects').select('*').order('created_at', { ascending: true }),
      supabase.from('schedules').select('*'),
      supabase.from('exams').select('id,subject_id,percentage,grade,activity_type').neq('activity_type', 'study_session'),
    ])
    setSubjects(subs || [])
    setSchedules(scheds || [])
    // build progress map per subject
    const progressMap: Record<string, { earned: number; graded: number; total: number }> = {}
    for (const e of (examData || [])) {
      if (!e.subject_id || e.percentage == null) continue
      if (!progressMap[e.subject_id]) progressMap[e.subject_id] = { earned: 0, graded: 0, total: 0 }
      progressMap[e.subject_id].total++
      if (e.grade != null) {
        progressMap[e.subject_id].earned += (e.grade * e.percentage) / 100
        progressMap[e.subject_id].graded++
      }
    }
    setExamProgress(progressMap)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="mono text-[10px] tracking-[0.18em] uppercase mb-1 font-medium"
            style={{ color: 'var(--color-primary)' }}>Scholar Sanctuary</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {t('subjects.title')}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>
            {subjects.length} {subjects.length === 1 ? 'materia activa' : 'materias activas'}
          </p>
        </div>
        <button
          onClick={() => { setEditingSubject(null); setModalOpen(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
          }}
          id="add-subject-btn"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nueva
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="skeleton h-40" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && subjects.length === 0 && (
        <div className="text-center py-24">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full blur-[40px] opacity-20"
              style={{ backgroundColor: 'var(--color-primary)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-default)' }}>
              <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-primary)' }}>menu_book</span>
            </div>
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>{t('subjects.noSubjects')}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-outline)' }}>Agrega tu primera materia para empezar</p>
          <button onClick={() => { setEditingSubject(null); setModalOpen(true) }} className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            {t('subjects.add')}
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && subjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((subject) => {
            const subjectSchedules = schedulesBySubject(subject.id)
            return (
              <div key={subject.id}
                className="group relative rounded-2xl p-4 flex flex-col transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                style={{
                  backgroundColor: `color-mix(in srgb, ${subject.color} 6%, var(--s-low))`,
                  border: '1px solid var(--border-subtle)',
                  borderTop: `2px solid color-mix(in srgb, ${subject.color} 30%, transparent)`,
                }}
                onClick={() => setDetailSubject(subject)}>

                {/* Hover gradient */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${subject.color} 10%, transparent), transparent)` }} />

                <div className="relative z-10 flex flex-col h-full">
                  {/* Icon + Name row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setIconPickerOpen(iconPickerOpen === subject.id ? null : subject.id) }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:brightness-125 hover:scale-105"
                        style={{ backgroundColor: `color-mix(in srgb, ${subject.color} 12%, transparent)` }}
                        title="Cambiar ícono"
                      >
                        <span className="material-symbols-outlined text-[20px]" style={{ color: subject.color }}>
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
                      <h2 className="text-base font-bold leading-tight transition-colors text-[var(--on-surface)] group-hover:text-[var(--color-primary)] truncate">
                        {subject.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {subject.professor && (
                          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
                            <span className="material-symbols-outlined text-[11px]">person</span>
                            <span className="truncate max-w-[120px]">{subject.professor}</span>
                          </p>
                        )}
                        {subject.room && (
                          <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
                            <span className="material-symbols-outlined text-[11px]">meeting_room</span>
                            <span className="font-mono">{subject.room}</span>
                          </p>
                        )}
                        {subject.credits && (
                          <span className="mono text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)', border: '1px solid var(--border-subtle)' }}>
                            {subject.credits}cr
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Kebab menu */}
                    <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setKebabOpen(kebabOpen === subject.id ? null : subject.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-full transition-all hover:bg-black/10 dark:hover:bg-white/10"
                        style={{ color: 'var(--color-outline)' }}
                      >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                      {kebabOpen === subject.id && (
                        <div className="absolute right-0 top-8 z-20 rounded-xl overflow-hidden shadow-lg"
                          style={{ backgroundColor: 'var(--s-high)', border: '1px solid var(--border-default)', minWidth: '140px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSubject(subject); setModalOpen(true); setKebabOpen(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all hover:bg-white/5"
                            style={{ color: 'var(--on-surface)' }}
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Editar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedSubject(expandedSubject === subject.id ? null : subject.id); setKebabOpen(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all hover:bg-white/5"
                            style={{ color: 'var(--on-surface)' }}
                          >
                            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                            Horarios
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(subject.id); setKebabOpen(null) }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-all hover:bg-red-400/10"
                            style={{ color: 'var(--danger)' }}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule pills */}
                  {subjectSchedules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {subjectSchedules.slice(0, 2).map(s => (
                        <span key={s.id}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${subject.color} 12%, transparent)`,
                            color: subject.color,
                          }}>
                          <span className="material-symbols-outlined text-[11px]">schedule</span>
                          {t(`subjects.days.${s.day_of_week}`).slice(0, 3)} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ''}
                        </span>
                      ))}
                      {subjectSchedules.length > 2 && (
                        <span className="mono text-[10px] self-center" style={{ color: 'var(--color-outline)' }}>
                          +{subjectSchedules.length - 2} más
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress preview */}
                  {(() => {
                    const prog = examProgress[subject.id]
                    const isPassing = prog && prog.earned >= 10
                    const pct = prog ? Math.min((prog.earned / 20) * 100, 100) : 0
                    return (
                      <div className="mt-auto mb-3 flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--s-high)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isPassing ? 'var(--success)' : subject.color,
                            }} />
                        </div>
                        <span className="mono text-[9px] font-bold flex-shrink-0"
                          style={{ color: isPassing ? 'var(--success)' : prog ? 'var(--color-outline)' : 'var(--border-strong)' }}>
                          {prog ? `${prog.earned.toFixed(1)}/20` : '—'}
                        </span>
                        <span className="material-symbols-outlined text-[13px] flex-shrink-0"
                          style={{ color: 'var(--color-outline)', opacity: 0.5 }}>
                          chevron_right
                        </span>
                      </div>
                    )
                  })()}


                  {/* Expanded schedule manager */}
                  {expandedSubject === subject.id && (
                    <div className="mt-4 pt-4 animate-slide-up" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <ScheduleManager
                        subject={subject}
                        schedules={schedulesBySubject(subject.id)}
                        onUpdated={fetchData}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add card */}
          <button
            onClick={() => { setEditingSubject(null); setModalOpen(true) }}
            className="group relative rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[220px] transition-all duration-300 border-2 border-dashed hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
            style={{ borderColor: 'var(--border-default)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center transition-all group-hover:scale-110 group-hover:bg-[var(--color-primary)]/10"
              style={{ backgroundColor: 'var(--s-base)' }}>
              <span className="material-symbols-outlined text-3xl transition-colors group-hover:text-[var(--color-primary)]"
                style={{ color: 'var(--color-outline)' }}>add</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>Nueva materia</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>Agrega a tu curriculum</p>
            </div>
          </button>
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
            <h2 className="font-bold text-base mb-2" style={{ color: 'var(--on-surface)' }}>{t('subjects.confirmDelete')}</h2>
            <p className="text-sm mb-5" style={{ color: 'var(--color-outline)' }}>{t('subjects.confirmDeleteDesc')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">{t('subjects.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Detail — academic progress */}
      {detailSubject && (
        <SubjectDetail
          subject={detailSubject}
          onClose={() => setDetailSubject(null)}
        />
      )}
    </div>
  )
}
