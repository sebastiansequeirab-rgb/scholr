'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { ACTIVITY_TYPES } from '@/types'
import type { ActivityType } from '@/types'

interface Exam {
  id: string
  title: string
  activity_type: string
  exam_date: string
  percentage: number | null
  max_grade: number
}

interface Student {
  id: string
  full_name: string
  avatar_url: string | null
}

interface GradeTableProps {
  courseId: string
  courseName: string
  courseColor: string
  teacherId: string
  exams: Exam[]
  students: Student[]
  initialGrades: Record<string, Record<string, number | null>>
}

const EXAM_TYPES: ActivityType[] = ['exam', 'workshop', 'activity', 'task']

export function GradeTable({ courseId, courseName, courseColor, teacherId, exams: initialExams, students, initialGrades }: GradeTableProps) {
  const { t, language } = useTranslation()
  const [exams, setExams] = useState<Exam[]>(initialExams)
  const [grades, setGrades] = useState<Record<string, Record<string, number | null>>>(initialGrades)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ─── Add Activity modal ───────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<ActivityType>('exam')
  const [newDate, setNewDate] = useState('')
  const [newPct, setNewPct] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalLoading, setModalLoading] = useState(false)

  // ─── Delete activity ──────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const openModal = () => {
    setNewTitle(''); setNewType('exam'); setNewDate(''); setNewPct(''); setModalError('')
    setModalOpen(true)
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newDate) { setModalError(t('auth.errors.required')); return }
    const pct = newPct !== '' ? parseFloat(newPct) : null
    if (pct !== null && (pct < 0 || pct > 100)) { setModalError('0 – 100'); return }
    setModalLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('exams')
      .insert({
        user_id:       teacherId,
        subject_id:    courseId,
        assigned_by:   teacherId,
        title:         newTitle.trim(),
        activity_type: newType,
        exam_date:     newDate,
        percentage:    pct,
        max_grade:     20,
      })
      .select('id, title, activity_type, exam_date, percentage, max_grade')
      .single()
    setModalLoading(false)
    if (error) { setModalError(error.message); return }
    if (data) {
      const exam = data as Exam
      setExams(prev => [...prev, exam].sort((a, b) => a.exam_date.localeCompare(b.exam_date)))
    }
    setModalOpen(false)
  }

  const handleDeleteActivity = async (examId: string) => {
    const supabase = createClient()
    // Delete grades first, then the exam
    await supabase.from('exam_grades').delete().eq('exam_id', examId)
    await supabase.from('exams').delete().eq('id', examId)
    setExams(prev => prev.filter(e => e.id !== examId))
    setGrades(prev => {
      const next = { ...prev }
      delete next[examId]
      return next
    })
    setDeleteId(null)
  }

  // ─── Grade saving ─────────────────────────────────────────────────────────
  const saveGrade = useCallback(async (examId: string, studentId: string, grade: number | null) => {
    const key = `${examId}:${studentId}`
    setSaving((prev) => ({ ...prev, [key]: true }))
    const supabase = createClient()
    await supabase
      .from('exam_grades')
      .upsert({ exam_id: examId, student_id: studentId, grade }, { onConflict: 'exam_id,student_id' })
    setSaving((prev) => ({ ...prev, [key]: false }))
    setSaved((prev) => ({ ...prev, [key]: true }))
    setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000)
  }, [])

  const handleChange = (examId: string, studentId: string, value: string) => {
    const parsed = value === '' ? null : Math.min(Math.max(parseFloat(value), 0), 20)
    const key = `${examId}:${studentId}`
    setGrades((prev) => ({
      ...prev,
      [examId]: { ...(prev[examId] ?? {}), [studentId]: parsed },
    }))
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key])
    debounceRefs.current[key] = setTimeout(() => { void saveGrade(examId, studentId, parsed) }, 800)
  }

  // ─── Shared header ────────────────────────────────────────────────────────
  const Header = () => (
    <div className="flex items-center justify-between">
      <div>
        <Link href={`/teacher/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline mb-2"
          style={{ color: 'var(--color-outline)' }}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {courseName}
        </Link>
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.grades.title')}
        </h1>
      </div>
      <button onClick={openModal}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ backgroundColor: courseColor, color: '#fff' }}>
        <span className="material-symbols-outlined text-[18px]">add</span>
        {t('teacher.grades.addActivity')}
      </button>
    </div>
  )

  // ─── Empty states ─────────────────────────────────────────────────────────
  if (students.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Header />
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            group
          </span>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.grades.noStudents')}
          </p>
        </div>
        {modalOpen && <ActivityModal />}
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Header />
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            grade
          </span>
          <p className="text-sm mb-4" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.grades.noExams')}
          </p>
          <p className="text-xs mb-6" style={{ color: 'var(--color-outline)' }}>
            {t('teacher.grades.noExamsHint')}
          </p>
          <button onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mx-auto transition-all"
            style={{ backgroundColor: courseColor, color: '#fff' }}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('teacher.grades.addActivity')}
          </button>
        </div>
        {modalOpen && <ActivityModal />}
      </div>
    )
  }

  // ─── Activity creation modal ──────────────────────────────────────────────
  function ActivityModal() {
    return (
      <div className="modal-overlay" onClick={() => setModalOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.grades.addActivity')}
          </h2>
          <form onSubmit={handleAddActivity} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                {t('teacher.grades.activityTitle')} *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)' }}
                placeholder={t('teacher.grades.activityTitle')}
                autoFocus
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                {t('teacher.grades.activityType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {EXAM_TYPES.map(type => {
                  const cfg = ACTIVITY_TYPES[type]
                  const label = language === 'es' ? cfg.label_es : cfg.label_en
                  return (
                    <button key={type} type="button"
                      onClick={() => setNewType(type)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: newType === type ? cfg.color : 'var(--s-low)',
                        color: newType === type ? '#fff' : 'var(--on-surface-variant)',
                        border: `1px solid ${newType === type ? cfg.color : 'var(--border-subtle)'}`,
                      }}>
                      <span className="material-symbols-outlined text-[13px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {cfg.icon}
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date + Percentage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                  {t('teacher.grades.activityDate')} *
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                  {t('teacher.grades.activityPercentage')}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={newPct}
                  onChange={e => setNewPct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)' }}
                  placeholder={t('teacher.grades.activityPercentagePlaceholder')}
                />
              </div>
            </div>

            {modalError && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>{modalError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--s-low)', color: 'var(--on-surface)' }}>
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={modalLoading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: courseColor, color: '#fff' }}>
                {modalLoading ? '...' : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── Full table ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-full space-y-6">
      <Header />

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--s-low)' }}>
                {/* Student column */}
                <th className="sticky left-0 z-10 text-left px-4 py-3 font-semibold min-w-[160px]"
                  style={{ backgroundColor: 'var(--s-low)', color: 'var(--on-surface)', borderRight: '1px solid var(--border-subtle)' }}>
                  {t('teacher.grades.student')}
                </th>
                {/* Exam columns */}
                {exams.map((exam) => {
                  const actType = ACTIVITY_TYPES[exam.activity_type as keyof typeof ACTIVITY_TYPES]
                  return (
                    <th key={exam.id} className="text-center px-3 py-3 font-semibold min-w-[120px]"
                      style={{ color: 'var(--on-surface)', borderRight: '1px solid var(--border-subtle)' }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px]"
                          style={{ color: actType?.color ?? 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                          {actType?.icon ?? 'assignment'}
                        </span>
                        <span className="text-[11px] leading-tight max-w-[100px] truncate">{exam.title}</span>
                        {exam.percentage != null && (
                          <span className="text-[9px] font-mono" style={{ color: 'var(--color-outline)' }}>
                            {exam.percentage}%
                          </span>
                        )}
                        {/* Delete activity button */}
                        <button
                          onClick={() => setDeleteId(exam.id)}
                          className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={t('teacher.grades.deleteActivity')}
                          style={{ color: 'var(--color-outline)' }}>
                          <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student, rowIdx) => (
                <tr key={student.id}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? 'var(--s-base)' : 'var(--s-low)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                  {/* Student name — sticky */}
                  <td className="sticky left-0 z-10 px-4 py-3"
                    style={{
                      backgroundColor: rowIdx % 2 === 0 ? 'var(--s-base)' : 'var(--s-low)',
                      borderRight: '1px solid var(--border-subtle)',
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                          color: 'var(--color-primary)',
                        }}>
                        {student.avatar_url
                          ? <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                          : getInitials(student.full_name)
                        }
                      </div>
                      <span className="text-[12px] font-medium truncate max-w-[110px]" style={{ color: 'var(--on-surface)' }}>
                        {student.full_name}
                      </span>
                    </div>
                  </td>
                  {/* Grade cells */}
                  {exams.map((exam) => {
                    const key = `${exam.id}:${student.id}`
                    const currentGrade = grades[exam.id]?.[student.id]
                    const isSaving = saving[key]
                    const isSaved  = saved[key]
                    return (
                      <td key={exam.id} className="px-3 py-2 text-center"
                        style={{ borderRight: '1px solid var(--border-subtle)' }}>
                        <div className="relative flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            max={exam.max_grade}
                            step="0.1"
                            value={currentGrade ?? ''}
                            onChange={(e) => handleChange(exam.id, student.id, e.target.value)}
                            className="w-16 text-center text-sm font-mono py-1.5 px-2 rounded-lg outline-none transition-all"
                            style={{
                              backgroundColor: isSaved
                                ? 'color-mix(in srgb, #10b981 12%, transparent)'
                                : 'var(--s-base)',
                              border: `1px solid ${isSaved ? '#10b981' : 'var(--border-subtle)'}`,
                              color: currentGrade !== null && currentGrade !== undefined
                                ? (currentGrade >= 10 ? 'var(--success)' : 'var(--danger)')
                                : 'var(--on-surface)',
                            }}
                            placeholder="—"
                          />
                          {isSaving && (
                            <span className="absolute -right-5 material-symbols-outlined text-[12px] animate-spin"
                              style={{ color: 'var(--color-outline)' }}>
                              progress_activity
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
        {t('teacher.grades.autoSaveNote')}
      </p>

      {modalOpen && <ActivityModal />}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-3" style={{ color: 'var(--on-surface)' }}>
              {t('teacher.grades.deleteActivity')}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>
              {t('teacher.grades.deleteActivityConfirm')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--s-low)', color: 'var(--on-surface)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDeleteActivity(deleteId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--danger)', color: '#fff' }}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
