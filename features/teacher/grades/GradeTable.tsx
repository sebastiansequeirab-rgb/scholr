'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { ACTIVITY_TYPES } from '@/types'

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
  exams: Exam[]
  students: Student[]
  initialGrades: Record<string, Record<string, number | null>>
}

export function GradeTable({ courseId, courseName, courseColor, exams, students, initialGrades }: GradeTableProps) {
  const { t } = useTranslation()
  const [grades, setGrades] = useState<Record<string, Record<string, number | null>>>(initialGrades)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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
    debounceRefs.current[key] = setTimeout(() => {
      void saveGrade(examId, studentId, parsed)
    }, 800)
  }

  if (exams.length === 0 || students.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href={`/teacher/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: 'var(--color-outline)' }}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {courseName}
        </Link>
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.grades.title')}
        </h1>
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            grade
          </span>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            {exams.length === 0 ? t('teacher.grades.noExams') : t('teacher.grades.noStudents')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-full space-y-6">
      <Link href={`/teacher/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {courseName}
      </Link>

      <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
        {t('teacher.grades.title')}
      </h1>

      {/* Scrollable grade table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--s-low)' }}>
                {/* Student column header */}
                <th className="sticky left-0 z-10 text-left px-4 py-3 font-semibold min-w-[160px]"
                  style={{ backgroundColor: 'var(--s-low)', color: 'var(--on-surface)', borderRight: '1px solid var(--border-subtle)' }}>
                  {t('teacher.grades.student')}
                </th>
                {/* Exam column headers */}
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
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student, rowIdx) => (
                <tr
                  key={student.id}
                  style={{
                    backgroundColor: rowIdx % 2 === 0 ? 'var(--s-base)' : 'var(--s-low)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
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
                    const isSaved = saved[key]
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
        Las notas se guardan automáticamente al ingresar cada valor.
      </p>
    </div>
  )
}
