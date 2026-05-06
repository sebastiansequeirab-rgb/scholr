'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { Subject, Exam, Document } from '@/types'
import { ACTIVITY_TYPES } from '@/types'
import { formatFileSize } from '@/features/teacher/courses/utils'
import {
  PASS,
  MAX_SCORE,
  summarize,
  classify,
  projectIfAvg,
  statusLabel,
  statusBg,
  statusFg,
  type GradeItem,
  type GradeStatus,
} from '@/lib/grades'
import { SubjectChat } from './SubjectChat'
import { getSubjectIcon } from '@/features/subjects/utils'

type DetailTab = 'progress' | 'chat' | 'documents'

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
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)
  const [exams, setExams] = useState<Exam[]>([])
  const [noteCount, setNoteCount] = useState<number>(0)
  const [documents, setDocuments] = useState<Document[]>([])
  const [teacherGrades, setTeacherGrades] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)

  // Local edit state (what-if simulator + dirty tracking)
  const [localScores, setLocalScores] = useState<Record<string, number | null>>({})
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({})
  // Per-exam save state for the persistence UI ('idle' | 'saving' | 'saved' | 'error')
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})

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

    if (user && subject.teacher_id) {
      const examIds = (data || []).filter(e => e.assigned_by != null).map(e => e.id as string)
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

  // Initialize local edit state from server data once exams load
  useEffect(() => {
    if (exams.length === 0) return
    const initialScores: Record<string, number | null> = {}
    const initialWeights: Record<string, number> = {}
    for (const e of exams) {
      const serverGrade = e.assigned_by ? (teacherGrades[e.id] ?? null) : (e.grade ?? null)
      initialScores[e.id] = serverGrade
      initialWeights[e.id] = e.percentage ?? 0
    }
    setLocalScores(initialScores)
    setLocalWeights(initialWeights)
  }, [exams, teacherGrades])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Filter to weighted exams (others ignored for the calc)
  const weightedExams = useMemo(() => exams.filter(e => e.percentage != null), [exams])
  const noWeightExams = useMemo(() => exams.filter(e => e.percentage == null), [exams])

  // Build GradeItem[] from local edit state
  const gradeItems: GradeItem[] = useMemo(
    () => weightedExams.map(e => ({
      label:  e.title,
      weight: localWeights[e.id] ?? 0,
      score:  localScores[e.id] ?? null,
      max:    MAX_SCORE,
      when:   e.exam_date,
    })),
    [weightedExams, localScores, localWeights],
  )

  const summary = useMemo(() => summarize(gradeItems), [gradeItems])
  const totalWeight = summary.totalWeight
  const weightOk = Math.abs(totalWeight - 100) < 0.01
  const sub10 = projectIfAvg(gradeItems, 10)
  const sub14 = projectIfAvg(gradeItems, 14)
  const sub18 = projectIfAvg(gradeItems, 18)

  const status = summary.status
  const iconFor = (s: Subject) => s.icon || getSubjectIcon(s.name)

  const updateScore = (id: string, raw: string) => {
    if (raw === '') {
      setLocalScores(prev => ({ ...prev, [id]: null }))
      return
    }
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return
    setLocalScores(prev => ({ ...prev, [id]: Math.max(0, Math.min(MAX_SCORE, n)) }))
  }
  const updateWeight = (id: string, raw: string) => {
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return
    setLocalWeights(prev => ({ ...prev, [id]: Math.max(0, Math.min(100, n)) }))
  }

  // Persist on blur. Student-owned exams (assigned_by IS NULL) save grade + percentage.
  // Teacher-owned exams stay as local what-if (RLS would deny anyway).
  const persistExam = useCallback(async (exam: Exam) => {
    if (exam.assigned_by != null) return // teacher exam — local-only

    const newScore = localScores[exam.id] ?? null
    const newWeight = localWeights[exam.id] ?? 0

    // No-op if nothing changed
    const serverScore = exam.grade ?? null
    const serverWeight = exam.percentage ?? 0
    if (newScore === serverScore && newWeight === serverWeight) return

    setSaveStatus(prev => ({ ...prev, [exam.id]: 'saving' }))
    const supabase = createClient()
    const { error } = await supabase
      .from('exams')
      .update({
        grade: newScore,
        percentage: newWeight,
        submission_status: newScore != null ? 'graded' : (exam.submission_status ?? 'pending'),
      })
      .eq('id', exam.id)

    if (error) {
      console.error('Save grade error:', error)
      setSaveStatus(prev => ({ ...prev, [exam.id]: 'error' }))
      return
    }

    // Reflect new server state locally so future blurs detect "no change"
    setExams(prev => prev.map(e =>
      e.id === exam.id ? { ...e, grade: newScore, percentage: newWeight } : e,
    ))
    setSaveStatus(prev => ({ ...prev, [exam.id]: 'saved' }))
    // Clear the "saved" indicator after a beat
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [exam.id]: 'idle' }))
    }, 1400)
  }, [localScores, localWeights])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-[18px] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={subject.name}
        style={{ background: 'var(--s-base)', border: '1px solid var(--border-default)' }}
      >
        {/* ─────────── Header strip ─────────── */}
        <div
          className="relative flex items-start gap-4 px-6 py-5"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${subject.color} 18%, transparent) 0%, color-mix(in srgb, ${subject.color} 6%, transparent) 100%)`,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${subject.color} 22%, transparent)` }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 22, color: subject.color, fontVariationSettings: "'FILL' 1" }}
            >
              {iconFor(subject)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <span
              className="font-mono"
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: subject.color,
              }}
            >
              {subject.credits ? `${subject.credits} UC · ` : ''}
              {subject.professor || subject.name}
            </span>
            <h2
              className="text-[22px] font-bold leading-tight mt-0.5"
              style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}
            >
              <span className="serif">{subject.name}</span>
            </h2>

            {/* Status row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="badge" style={{ background: statusBg(status), color: statusFg(status) }}>
                {statusLabel(status, language as 'es' | 'en')}
              </span>
              {summary.currentAverage != null && (
                <span className="text-[11.5px]" style={{ color: 'var(--on-surface-variant)' }}>
                  {language === 'es' ? 'Promedio actual' : 'Current avg'}{' '}
                  <strong className="font-mono tabular" style={{ color: 'var(--on-surface)' }}>
                    {summary.currentAverage.toFixed(2)}
                  </strong>
                  <span style={{ color: 'var(--color-outline)' }}> / {MAX_SCORE}</span>
                </span>
              )}
              {noteCount > 0 && (
                <Link
                  href={`/notes?subject=${subject.id}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold transition-opacity hover:opacity-80"
                  style={{ color: subject.color }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit_note</span>
                  {noteCount} {language === 'es' ? `nota${noteCount !== 1 ? 's' : ''}` : `note${noteCount !== 1 ? 's' : ''}`}
                </Link>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-icon btn-ghost flex-shrink-0"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ─────────── Tab bar ─────────── */}
        <div
          className="flex gap-1 px-4 py-2"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--s-low)' }}
        >
          {([
            { id: 'progress',  icon: 'calculate',    label_es: 'Calculadora', label_en: 'Calculator', show: true                  },
            { id: 'documents', icon: 'folder_open',  label_es: 'Archivos',    label_en: 'Files',      show: !!subject.teacher_id  },
            { id: 'chat',      icon: 'auto_awesome', label_es: 'Chat IA',     label_en: 'AI Chat',    show: true                  },
          ] as const).filter(tab => tab.show).map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] transition-all"
                style={{
                  background: active ? `color-mix(in srgb, ${subject.color} 16%, transparent)` : 'transparent',
                  color: active ? subject.color : 'var(--on-surface-variant)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
                {language === 'es' ? tab.label_es : tab.label_en}
              </button>
            )
          })}
        </div>

        {/* ─────────── Documents tab ─────────── */}
        {activeTab === 'documents' && (
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14" />)}</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32, color: 'var(--color-outline)' }}>
                  folder_open
                </span>
                <p className="text-[13px]" style={{ color: 'var(--on-surface-variant)' }}>
                  {language === 'es' ? 'Sin archivos disponibles' : 'No files available'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-[10px]"
                    style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                        insert_drive_file
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                        {doc.title}
                      </p>
                      <p className="font-mono" style={{ fontSize: 10, color: 'var(--on-surface-variant)', letterSpacing: '0.04em' }}>
                        {doc.size_bytes != null ? formatFileSize(doc.size_bytes) : '—'}
                      </p>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-icon btn-ghost"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      <span className="material-symbols-outlined">download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────── Chat tab ─────────── */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <SubjectChat subject={subject} />
          </div>
        )}

        {/* ─────────── Calculator tab ─────────── */}
        {activeTab === 'progress' && (
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14" />)}</div>
            ) : weightedExams.length === 0 ? (
              <EmptyCalc lang={language as 'es' | 'en'} subjectColor={subject.color} />
            ) : (
              <>
                {/* ─── KPI strip ─── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                  <KpiBox
                    label={language === 'es' ? 'Promedio actual' : 'Current average'}
                    value={summary.currentAverage != null ? summary.currentAverage.toFixed(2) : '—'}
                    unit={`/ ${MAX_SCORE}`}
                    hint={language === 'es' ? `${Math.round(summary.doneWeight)}% rendido` : `${Math.round(summary.doneWeight)}% done`}
                    tone={status}
                  />
                  <KpiBox
                    label={language === 'es' ? 'Proyección final' : 'Projected final'}
                    value={summary.projectedFinal != null ? summary.projectedFinal.toFixed(2) : '—'}
                    unit={`/ ${MAX_SCORE}`}
                    hint={language === 'es' ? 'si mantenés ritmo' : 'if you keep pace'}
                  />
                  <KpiBox
                    label={language === 'es' ? 'Para aprobar' : 'To pass'}
                    value={
                      summary.neededToPass == null
                        ? '—'
                        : summary.neededToPass === 0
                          ? '✓'
                          : !Number.isFinite(summary.neededToPass)
                            ? '✕'
                            : summary.neededToPass.toFixed(2)
                    }
                    unit={
                      summary.neededToPass == null || summary.neededToPass === 0 || !Number.isFinite(summary.neededToPass)
                        ? ''
                        : `/ ${MAX_SCORE}`
                    }
                    hint={
                      summary.neededToPass === 0
                        ? (language === 'es' ? 'ya estás aprobando' : 'already passing')
                        : !Number.isFinite(summary.neededToPass ?? 0)
                          ? (language === 'es' ? 'imposible este ciclo' : 'impossible this term')
                          : language === 'es' ? `meta ≥ ${PASS}` : `target ≥ ${PASS}`
                    }
                    tone={
                      summary.neededToPass == null
                        ? 'pending'
                        : summary.neededToPass === 0
                          ? 'pass'
                          : !Number.isFinite(summary.neededToPass)
                            ? 'fail'
                            : summary.neededToPass > 14
                              ? 'risk'
                              : 'pass'
                    }
                  />
                  <KpiBox
                    label={language === 'es' ? 'Estado' : 'Status'}
                    value={statusLabel(status, language as 'es' | 'en')}
                    hint={`${summary.countDone}/${summary.countTotal} ${language === 'es' ? 'evaluaciones' : 'evals'}`}
                    tone={status}
                    isText
                  />
                </div>

                {/* ─── Calculadora editable ─── */}
                <section
                  className="card mb-3"
                  style={{ background: 'var(--s-low)', padding: 14 }}
                >
                  <div className="section-head">
                    <div className="section-head__left">
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                        calculate
                      </span>
                      <span className="section-head__title">
                        <span className="serif">{language === 'es' ? 'calculadora de notas' : 'grade calculator'}</span>
                      </span>
                    </div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: weightOk ? 'var(--color-outline)' : 'var(--warning)',
                        fontWeight: 600,
                      }}
                    >
                      {weightOk ? '' : '⚠ '}
                      {language === 'es' ? 'pesos' : 'weights'} {totalWeight.toFixed(0)}%
                    </span>
                  </div>

                  {/* Header row */}
                  <div
                    className="grid items-center gap-2 px-2 mb-2"
                    style={{ gridTemplateColumns: '1fr 70px 70px 70px' }}
                  >
                    {[
                      language === 'es' ? 'Evaluación' : 'Evaluation',
                      language === 'es' ? 'Peso %' : 'Weight %',
                      language === 'es' ? 'Nota' : 'Grade',
                      language === 'es' ? 'Aporte' : 'Contrib.',
                    ].map((h, i) => (
                      <span
                        key={i}
                        className="font-mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--color-outline)',
                          textAlign: i === 0 ? 'left' : 'right',
                        }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Rows */}
                  <div className="flex flex-col gap-1.5">
                    {weightedExams.map(exam => {
                      const cfg = ACTIVITY_TYPES[exam.activity_type]
                      const score = localScores[exam.id]
                      const weight = localWeights[exam.id] ?? 0
                      const cls = classify(score)
                      const contribution = score != null ? (score / MAX_SCORE) * MAX_SCORE * (weight / 100) : null
                      const isTeacher = exam.assigned_by != null

                      return (
                        <div
                          key={exam.id}
                          className="grid items-center gap-2 px-2 py-2.5 rounded-[8px]"
                          style={{
                            gridTemplateColumns: '1fr 70px 70px 70px',
                            background: 'var(--s-base)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {/* Label */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="material-symbols-outlined flex-shrink-0"
                              style={{ fontSize: 14, color: cfg.color, fontVariationSettings: "'FILL' 1" }}
                            >
                              {cfg.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                                  {exam.title}
                                </p>
                                {isTeacher && (
                                  <span
                                    className="material-symbols-outlined flex-shrink-0"
                                    style={{ fontSize: 11, color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}
                                    title={language === 'es' ? 'Asignada por el profesor' : 'Assigned by teacher'}
                                  >
                                    lock
                                  </span>
                                )}
                              </div>
                              <p
                                className="font-mono"
                                style={{ fontSize: 9.5, color: 'var(--color-outline)', letterSpacing: '0.04em' }}
                              >
                                {new Date(exam.exam_date + 'T12:00:00').toLocaleDateString(
                                  language === 'es' ? 'es-ES' : 'en-US',
                                  { month: 'short', day: 'numeric' },
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Weight input */}
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={weight}
                            disabled={isTeacher}
                            onChange={e => updateWeight(exam.id, e.target.value)}
                            onBlur={() => persistExam(exam)}
                            className="grade-input"
                            style={{ width: '100%', opacity: isTeacher ? 0.55 : 1 }}
                            aria-label="Weight"
                          />

                          {/* Score input (colored by class) */}
                          <input
                            type="number"
                            min={0}
                            max={MAX_SCORE}
                            step={0.1}
                            value={score ?? ''}
                            disabled={isTeacher}
                            onChange={e => updateScore(exam.id, e.target.value)}
                            onBlur={() => persistExam(exam)}
                            placeholder="—"
                            className={`grade-input ${cls === 'pending' ? '' : cls}`}
                            style={{ width: '100%', opacity: isTeacher ? 0.55 : 1 }}
                            aria-label="Score"
                          />

                          {/* Contribution + save status */}
                          <div className="flex items-center justify-end gap-1.5 min-w-0">
                            <SaveBadge status={saveStatus[exam.id] ?? 'idle'} isTeacher={isTeacher} lang={language as 'es' | 'en'} />
                            <span
                              className="font-mono tabular text-right"
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color:
                                  contribution == null
                                    ? 'var(--color-outline)'
                                    : 'var(--success)',
                              }}
                            >
                              {contribution != null ? `+${contribution.toFixed(2)}` : '—'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Footer hint */}
                  <p
                    className="font-mono mt-3"
                    style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--color-outline)', lineHeight: 1.5 }}
                  >
                    {language === 'es'
                      ? 'Editá pesos y notas — los cambios se guardan automáticamente al salir del campo. Las evaluaciones del profesor (con candado) son sólo lectura.'
                      : 'Edit weights and grades — changes save automatically when you leave the field. Teacher-assigned evaluations (with lock icon) are read-only.'}
                  </p>
                </section>

                {/* ─── Scenarios ─── */}
                {summary.pendingWeight > 0 && (
                  <section className="card" style={{ background: 'var(--s-low)', padding: 14 }}>
                    <div className="section-head">
                      <div className="section-head__left">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
                          trending_up
                        </span>
                        <span className="section-head__title">
                          <span className="serif">{language === 'es' ? 'escenarios' : 'scenarios'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {[
                        { avg: 10, projected: sub10, color: 'var(--color-outline)' },
                        { avg: 14, projected: sub14, color: 'var(--success)' },
                        { avg: 18, projected: sub18, color: 'var(--success)' },
                      ].map(({ avg, projected, color }) => {
                        const projectedStr = projected != null ? projected.toFixed(2) : '—'
                        const passes = projected != null && projected >= PASS
                        return (
                          <div
                            key={avg}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px]"
                            style={{ background: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}
                          >
                            <span className="text-[12.5px]" style={{ color: 'var(--on-surface-variant)' }}>
                              {language === 'es' ? 'Si saco' : 'If I score'}{' '}
                              <strong className="font-mono tabular" style={{ color: 'var(--on-surface)' }}>
                                {avg}
                              </strong>{' '}
                              {language === 'es' ? 'en lo que falta:' : 'on remaining:'}
                            </span>
                            <span className="ml-auto font-mono tabular flex items-baseline gap-1" style={{ fontSize: 13, fontWeight: 700, color: passes ? 'var(--success)' : color }}>
                              → {projectedStr}
                              <span style={{ fontSize: 10, color: 'var(--color-outline)', fontWeight: 500 }}>
                                / {MAX_SCORE}
                              </span>
                              {passes && (
                                <span className="material-symbols-outlined ml-1" style={{ fontSize: 13, color: 'var(--success)' }}>
                                  check_circle
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Unweighted activities */}
                {noWeightExams.length > 0 && (
                  <section className="mt-3">
                    <p
                      className="font-mono mb-2"
                      style={{ fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-outline)' }}
                    >
                      {language === 'es' ? 'Sin porcentaje asignado' : 'No weight assigned'}
                    </p>
                    <div className="flex flex-col gap-1">
                      {noWeightExams.map(exam => {
                        const cfg = ACTIVITY_TYPES[exam.activity_type]
                        return (
                          <div
                            key={exam.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px]"
                            style={{ background: 'var(--s-base)', opacity: 0.55, border: '1px solid var(--border-subtle)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13, color: cfg.color }}>{cfg.icon}</span>
                            <span className="text-[12px] truncate" style={{ color: 'var(--on-surface)' }}>{exam.title}</span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function KpiBox({
  label,
  value,
  unit,
  hint,
  tone,
  isText,
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  tone?: GradeStatus
  isText?: boolean
}) {
  const color =
    tone === 'pass'
      ? 'var(--success)'
      : tone === 'risk'
        ? 'var(--warning)'
        : tone === 'fail'
          ? 'var(--danger)'
          : 'var(--on-surface)'

  return (
    <div className="kpi" style={{ padding: '12px 14px' }}>
      <span className="kpi__sub">{label}</span>
      <span
        className="kpi__num font-mono tabular flex items-baseline gap-1"
        style={{ color, fontSize: isText ? 16 : 24 }}
      >
        {value}
        {unit && <span style={{ fontSize: 11, color: 'var(--color-outline)', fontWeight: 500 }}>{unit}</span>}
      </span>
      {hint && <span className="kpi__hint">{hint}</span>}
    </div>
  )
}

function SaveBadge({
  status,
  isTeacher,
  lang,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error'
  isTeacher: boolean
  lang: 'es' | 'en'
}) {
  if (isTeacher) return null
  if (status === 'idle') return null

  const config = {
    saving: {
      icon: 'progress_activity',
      color: 'var(--color-outline)',
      label: lang === 'es' ? 'Guardando' : 'Saving',
      animate: true,
    },
    saved: {
      icon: 'check_circle',
      color: 'var(--success)',
      label: lang === 'es' ? 'Guardado' : 'Saved',
      animate: false,
    },
    error: {
      icon: 'error',
      color: 'var(--danger)',
      label: lang === 'es' ? 'Error' : 'Error',
      animate: false,
    },
  }[status]

  return (
    <span
      title={config.label}
      className={config.animate ? 'animate-spin' : ''}
      style={{ display: 'inline-flex', flexShrink: 0 }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 13, color: config.color, fontVariationSettings: status === 'saved' ? "'FILL' 1" : "'FILL' 0" }}
      >
        {config.icon}
      </span>
    </span>
  )
}

function EmptyCalc({ lang, subjectColor }: { lang: 'es' | 'en'; subjectColor: string }) {
  return (
    <div className="text-center py-10">
      <div
        className="inline-flex w-12 h-12 rounded-[12px] items-center justify-center mb-3"
        style={{ background: `color-mix(in srgb, ${subjectColor} 14%, transparent)` }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: subjectColor }}>
          assignment
        </span>
      </div>
      <p className="text-[14px] font-bold" style={{ color: 'var(--on-surface)' }}>
        {lang === 'es' ? 'Sin evaluaciones registradas' : 'No evaluations recorded'}
      </p>
      <p className="text-[12px] mt-1" style={{ color: 'var(--color-outline)' }}>
        {lang === 'es'
          ? 'Agregá actividades en la sección Evaluaciones para empezar a ver tu progreso.'
          : 'Add activities in the Evaluations section to start tracking your progress.'}
      </p>
    </div>
  )
}
