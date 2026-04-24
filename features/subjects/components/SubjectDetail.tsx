'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { Subject, Exam, Document } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { formatFileSize } from '@/features/teacher/courses/utils'
import { SubjectChat } from './SubjectChat'

type DetailTab = 'progress' | 'chat' | 'documents'

const PASS_SCORE = 10
const MAX_SCORE  = 20

function ProgressRing({ earned, potential, max }: { earned: number; potential: number; max: number }) {
  const size = 140
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const passAngle = (PASS_SCORE / max) * circ

  const earnedDash  = Math.min((earned  / max) * circ, circ)
  const potDash     = Math.min((potential / max) * circ, circ)
  const isPassing   = earned >= PASS_SCORE

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--s-high)" strokeWidth={stroke} />
        {/* Potential (ungraded max) */}
        {potential > 0 && (
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="var(--color-primary)" strokeWidth={stroke}
            strokeDasharray={`${potDash} ${circ}`}
            strokeLinecap="round"
            style={{ opacity: 0.2 }} />
        )}
        {/* Earned */}
        {earned > 0 && (
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={isPassing ? 'var(--success)' : 'var(--color-primary)'}
            strokeWidth={stroke}
            strokeDasharray={`${earnedDash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        )}
        {/* Pass threshold tick */}
        <line
          x1={size/2 + r * Math.cos((passAngle / circ) * 2 * Math.PI - Math.PI/2 - Math.PI/2)}
          y1={size/2 + r * Math.sin((passAngle / circ) * 2 * Math.PI - Math.PI/2 - Math.PI/2)}
          x2={size/2 + (r - stroke) * Math.cos((passAngle / circ) * 2 * Math.PI - Math.PI/2 - Math.PI/2)}
          y2={size/2 + (r - stroke) * Math.sin((passAngle / circ) * 2 * Math.PI - Math.PI/2 - Math.PI/2)}
          stroke="var(--warning)" strokeWidth={2} />
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none" style={{ color: isPassing ? 'var(--success)' : 'var(--on-surface)' }}>
          {earned.toFixed(1)}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-outline)' }}>/ {max}</span>
      </div>
    </div>
  )
}

export function SubjectDetail({
  subject,
  onClose,
  initialTab = 'progress',
}: {
  subject: Subject
  onClose: () => void
  initialTab?: DetailTab
}) {
  const { language } = useTranslation()
  const [activeTab,       setActiveTab]       = useState<DetailTab>(initialTab)
  const [exams,           setExams]           = useState<Exam[]>([])
  const [noteCount,       setNoteCount]       = useState<number>(0)
  const [documents,       setDocuments]       = useState<Document[]>([])
  const [teacherGrades,   setTeacherGrades]   = useState<Record<string, number | null>>({})
  const [loading,         setLoading]         = useState(true)

  const fetchExams = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('exams')
        .select('*')
        .eq('subject_id', subject.id)
        .neq('activity_type', 'study_session')
        .order('exam_date', { ascending: true }),
      supabase
        .from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subject.id),
    ])
    setExams(data || [])
    setNoteCount(count ?? 0)

    // Fetch teacher grades (exam_grades) for teacher-assigned exams in this subject
    if (user && subject.teacher_id) {
      const examIds = (data || [])
        .filter(e => e.assigned_by != null)
        .map(e => e.id as string)
      if (examIds.length > 0) {
        const { data: grades } = await supabase
          .from('exam_grades')
          .select('exam_id, grade')
          .eq('student_id', user.id)
          .in('exam_id', examIds)
        const gradeMap: Record<string, number | null> = {}
        for (const g of (grades || [])) {
          const eg = g as { exam_id: string; grade: number | null }
          gradeMap[eg.exam_id] = eg.grade
        }
        setTeacherGrades(gradeMap)
      }
    }

    // Fetch documents if this is a teacher-created course
    if (subject.teacher_id) {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('subject_id', subject.id)
        .order('created_at', { ascending: false })
      setDocuments((docs ?? []) as Document[])
    }

    setLoading(false)
  }, [subject.id, subject.teacher_id])

  useEffect(() => { fetchExams() }, [fetchExams])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Resolve effective grade: teacher exams use exam_grades; own exams use exam.grade
  const effectiveGrade = (e: Exam): number | null =>
    e.assigned_by ? (teacherGrades[e.id] ?? null) : e.grade

  const gradedExams    = exams.filter(e => effectiveGrade(e) !== null && e.percentage != null)
  const submittedExams = exams.filter(e => e.submission_status === 'submitted' && effectiveGrade(e) == null)
  const ungradedExams  = exams.filter(e => effectiveGrade(e) == null && e.percentage != null)
  const noWeightExams  = exams.filter(e => e.percentage == null)

  const earned    = gradedExams.reduce((sum, e) => sum + (effectiveGrade(e)! * e.percentage! / 100), 0)
  const potential = ungradedExams.reduce((sum, e) => sum + (e.percentage! / 100 * MAX_SCORE), 0)
  const totalWeight = gradedExams.reduce((sum, e) => sum + e.percentage!, 0)
  const remaining = Math.max(0, PASS_SCORE - earned)
  const isPassing = earned >= PASS_SCORE

  const iconFor = (subject: Subject) => subject.icon || 'menu_book'

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={subject.name}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* ── Header strip ── */}
        <div className="relative flex items-center gap-4 p-6"
          style={{
            background: `linear-gradient(135deg, ${subject.color}22 0%, ${subject.color}08 100%)`,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${subject.color}20` }}>
            <span className="material-symbols-outlined text-2xl" style={{ color: subject.color }}>
              {iconFor(subject)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="mono text-[9px] tracking-[0.2em] uppercase mb-0.5"
              style={{ color: subject.color }}>
              Skolar Sanctuary
            </p>
            <h2 className="text-xl font-extrabold tracking-tight truncate" style={{ color: 'var(--on-surface)' }}>
              {subject.name}
            </h2>
            {subject.professor && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[12px]">person</span>
                {subject.professor}
              </p>
            )}
            {noteCount > 0 && (
              <Link
                href={`/notes?subject=${subject.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:opacity-80"
                style={{
                  backgroundColor: `${subject.color}18`,
                  color:           subject.color,
                  border:          `1px solid ${subject.color}30`,
                }}
              >
                <span className="material-symbols-outlined text-[11px]">edit_note</span>
                {noteCount} {language === 'es' ? `nota${noteCount !== 1 ? 's' : ''}` : `note${noteCount !== 1 ? 's' : ''}`}
              </Link>
            )}
          </div>
          <button onClick={onClose}
            className="p-2 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
            style={{ color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--s-low)' }}>
          {([
            { id: 'progress',  icon: 'trending_up',  label_es: 'Progreso',   label_en: 'Progress',  show: true                     },
            { id: 'documents', icon: 'folder_open',  label_es: 'Archivos',   label_en: 'Files',     show: !!subject.teacher_id     },
            { id: 'chat',      icon: 'auto_awesome',  label_es: 'Chat IA',    label_en: 'AI Chat',   show: true                     },
          ] as const).filter(tab => tab.show).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: activeTab === tab.id ? `${subject.color}15` : 'transparent',
                color:           activeTab === tab.id ? subject.color : 'var(--color-outline)',
              }}>
              <span className="material-symbols-outlined text-[14px]"
                style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}>
                {tab.icon}
              </span>
              {language === 'es' ? tab.label_es : tab.label_en}
            </button>
          ))}
        </div>

        {/* ── Documents tab ── */}
        {activeTab === 'documents' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-4xl mb-3 block"
                  style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
                  folder_open
                </span>
                <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  {language === 'es' ? 'Sin archivos disponibles' : 'No files available'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
                      <span className="material-symbols-outlined text-[16px]"
                        style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                        insert_drive_file
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--on-surface)' }}>
                        {doc.title}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--on-surface-variant)' }}>
                        {doc.size_bytes != null ? formatFileSize(doc.size_bytes) : '—'}
                      </p>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-[var(--s-base)] transition-all flex-shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chat tab ── */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <SubjectChat subject={subject} />
          </div>
        )}

        {/* ── Progress tab ── */}
        {activeTab === 'progress' && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : (
            <>
              {/* ── Score overview ── */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <ProgressRing earned={earned} potential={potential} max={MAX_SCORE} />

                <div className="flex-1 space-y-3">
                  {/* Main score */}
                  <div className="rounded-2xl p-4"
                    style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-3xl font-black leading-none"
                        style={{ color: isPassing ? 'var(--success)' : 'var(--color-primary)' }}>
                        {earned.toFixed(2)}
                      </span>
                      <span className="text-base font-bold mb-0.5" style={{ color: 'var(--color-outline)' }}>
                        / {MAX_SCORE}
                      </span>
                      {isPassing && (
                        <span className="ml-auto flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
                          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          {language === 'es' ? 'Aprobado' : 'Passing'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
                      {isPassing
                        ? (language === 'es' ? `+${(earned - PASS_SCORE).toFixed(2)} pts sobre la nota mínima` : `+${(earned - PASS_SCORE).toFixed(2)} pts above pass mark`)
                        : (language === 'es' ? `Faltan ${remaining.toFixed(2)} pts para aprobar` : `${remaining.toFixed(2)} pts needed to pass`)}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: language === 'es' ? 'Calificadas' : 'Graded',    value: gradedExams.length,    color: 'var(--success)'       },
                      { label: language === 'es' ? 'Entregadas'  : 'Submitted', value: submittedExams.length, color: 'var(--warning)'       },
                      { label: language === 'es' ? 'Pendientes'  : 'Pending',   value: ungradedExams.length - submittedExams.length, color: 'var(--color-outline)' },
                      { label: language === 'es' ? 'Peso eval.'  : 'Weight',    value: `${totalWeight}%`,     color: 'var(--color-primary)' },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-xl p-2 text-center"
                        style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-base font-black leading-none" style={{ color: stat.color }}>{stat.value}</p>
                        <p className="text-[8px] mt-0.5 font-semibold uppercase tracking-wide" style={{ color: 'var(--color-outline)' }}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="h-2.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--s-high)' }}>
                      {/* Potential */}
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(((earned + potential) / MAX_SCORE) * 100, 100)}%`,
                          background: `color-mix(in srgb, var(--color-primary) 30%, transparent)`,
                        }} />
                    </div>
                    <div className="h-2.5 rounded-full -mt-2.5 overflow-hidden">
                      {/* Earned */}
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min((earned / MAX_SCORE) * 100, 100)}%`,
                          background: isPassing
                            ? 'linear-gradient(90deg, var(--success), color-mix(in srgb, var(--success) 70%, var(--color-primary)))'
                            : 'linear-gradient(90deg, var(--color-primary-container), var(--color-primary))',
                        }} />
                    </div>
                    {/* Pass marker */}
                    <div className="relative h-0">
                      <div className="absolute top-[-12px] w-0.5 h-3 rounded-full"
                        style={{
                          left: `${(PASS_SCORE / MAX_SCORE) * 100}%`,
                          backgroundColor: 'var(--warning)',
                        }} />
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] font-semibold"
                      style={{ color: 'var(--color-outline)' }}>
                      <span>0</span>
                      <span style={{ color: 'var(--warning)' }}>
                        {language === 'es' ? `mín. ${PASS_SCORE}` : `min. ${PASS_SCORE}`}
                      </span>
                      <span>{MAX_SCORE}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Evaluations breakdown ── */}
              {exams.length > 0 ? (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest mb-3"
                    style={{ color: 'var(--color-outline)' }}>
                    {language === 'es' ? 'Desglose de evaluaciones' : 'Evaluation breakdown'}
                  </h3>

                  {/* Header row */}
                  <div className="grid gap-2 mb-1 px-3"
                    style={{ gridTemplateColumns: '1fr 56px 64px 72px' }}>
                    {['', language === 'es' ? 'Peso' : 'Weight', language === 'es' ? 'Nota' : 'Grade', language === 'es' ? 'Aporte' : 'Contrib.'].map((h, i) => (
                      <span key={i} className="text-[9px] font-bold uppercase tracking-wide text-right first:text-left"
                        style={{ color: 'var(--color-outline)' }}>{h}</span>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {exams.map(exam => {
                      const cfg        = ACTIVITY_TYPES[exam.activity_type]
                      const grade      = effectiveGrade(exam)
                      const isTeacher  = exam.assigned_by != null
                      const hasGrade   = grade !== null && exam.percentage != null
                      const contrib    = hasGrade ? (grade! * exam.percentage! / 100) : null
                      const maxContrib = exam.percentage != null ? (exam.percentage / 100 * MAX_SCORE) : null

                      return (
                        <div key={exam.id}
                          className="grid items-center gap-2 px-3 py-2.5 rounded-xl"
                          style={{
                            gridTemplateColumns: '1fr 56px 64px 72px',
                            backgroundColor: 'var(--s-base)',
                            border: `1px solid ${isTeacher ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--border-subtle)'}`,
                            opacity: hasGrade ? 1 : 0.7,
                          }}>
                          {/* Name + type */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[14px] flex-shrink-0"
                              style={{ color: cfg.color, fontVariationSettings: "'FILL' 1" }}>
                              {cfg.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                                  {exam.title}
                                </p>
                                {isTeacher && (
                                  <span className="material-symbols-outlined text-[11px] flex-shrink-0"
                                    style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}
                                    title={language === 'es' ? 'Asignada por el profesor' : 'Assigned by teacher'}>
                                    lock
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px]" style={{ color: 'var(--color-outline)' }}>
                                {new Date(exam.exam_date + 'T12:00:00').toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          {/* Weight */}
                          <span className="text-xs font-bold text-right mono"
                            style={{ color: 'var(--color-primary)' }}>
                            {exam.percentage != null ? `${exam.percentage}%` : '—'}
                          </span>

                          {/* Grade */}
                          <span className="text-xs font-bold text-right mono"
                            style={{ color: hasGrade ? 'var(--on-surface)' : 'var(--color-outline)' }}>
                            {hasGrade ? `${grade!.toFixed(1)}/20` : (language === 'es' ? 'Pend.' : 'Pend.')}
                          </span>

                          {/* Contribution */}
                          <div className="text-right">
                            {contrib != null ? (
                              <span className="text-xs font-black mono"
                                style={{ color: contrib > 0 ? 'var(--success)' : 'var(--color-outline)' }}>
                                +{contrib.toFixed(2)}
                              </span>
                            ) : maxContrib != null ? (
                              <span className="text-[10px] mono" style={{ color: 'var(--color-outline)' }}>
                                ≤{maxContrib.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs" style={{ color: 'var(--color-outline)' }}>—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Unweighted activities */}
                  {noWeightExams.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[9px] uppercase tracking-widest font-bold mb-2"
                        style={{ color: 'var(--color-outline)' }}>
                        {language === 'es' ? 'Sin porcentaje asignado' : 'No weight assigned'}
                      </p>
                      <div className="space-y-1">
                        {noWeightExams.map(exam => {
                          const cfg = ACTIVITY_TYPES[exam.activity_type]
                          return (
                            <div key={exam.id}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl"
                              style={{ backgroundColor: 'var(--s-base)', opacity: 0.5, border: '1px solid var(--border-subtle)' }}>
                              <span className="material-symbols-outlined text-[13px]"
                                style={{ color: cfg.color }}>{cfg.icon}</span>
                              <span className="text-xs truncate" style={{ color: 'var(--on-surface)' }}>{exam.title}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-3xl block mb-2"
                    style={{ color: 'var(--color-outline)' }}>assignment</span>
                  <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                    {language === 'es' ? 'Sin evaluaciones registradas' : 'No evaluations recorded'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-outline)' }}>
                    {language === 'es'
                      ? 'Agrega actividades en la sección Actividades para ver tu progreso.'
                      : 'Add activities in the Activities section to track your progress.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
