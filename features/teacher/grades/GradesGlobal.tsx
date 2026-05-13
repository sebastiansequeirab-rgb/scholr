'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass, gradeClass } from '@/lib/accent'
import { CourseFilterChips, type FilterCourse } from '../shared/CourseFilterChips'
import { GradeCell } from './GradeCell'
import { AddExamModal } from './AddExamModal'
import { exportGradesCsvAction, deleteExamAction } from '@/app/(teacher)/teacher/grades/actions'
import { useRouter, useSearchParams } from 'next/navigation'

type Student = { id: string; full_name: string; avatar_url: string | null }
type Exam = { id: string; title: string; percentage: number | null; position: number }
type Grade = { exam_id: string; student_id: string; grade: number | null }
type CourseBlock = {
  id: string
  name: string
  semester: string | null
  accent: string | null
  exams: Exam[]
  students: Student[]
  grades: Grade[]
}

export function GradesGlobal({ courses, courseList }: { courses: CourseBlock[]; courseList: FilterCourse[] }) {
  const { t } = useTranslation()
  const router = useRouter()
  const sp = useSearchParams()
  const selected = sp.get('course') || ''
  const [pendingExport, startExport] = useTransition()
  const [addExamFor, setAddExamFor] = useState<{ id: string; name: string; position: number } | null>(null)

  const visible = useMemo(() => selected ? courses.filter(c => c.id === selected) : courses, [courses, selected])

  const onExportCsv = () => {
    startExport(async () => {
      const r = await exportGradesCsvAction(selected || null)
      if (!r.ok || !r.csv) { toast.error(r.error ?? t('teacher.common.error')); return }
      const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = r.filename ?? 'skolar-grades.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exportado')
    })
  }

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.grades.title').toLowerCase()}</h1>
        </div>
        <button type="button" className="t-btn-line" onClick={onExportCsv} disabled={pendingExport}>
          <span className="material-symbols-outlined">{pendingExport ? 'hourglass_empty' : 'download'}</span>
          {t('teacher.common.exportCsv')}
        </button>
      </header>

      <CourseFilterChips courses={courseList} />

      {visible.length === 0 ? (
        <div className="t-empty" style={{ marginTop: 20 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">grade</span></div>
          <div className="t-empty__title">Sin cursos para mostrar</div>
        </div>
      ) : (
        visible.map((c) => <CourseBlockView key={c.id} block={c} onAddExam={() => setAddExamFor({ id: c.id, name: c.name, position: c.exams.length })} onDeleteExam={async (examId) => {
          if (!confirm('¿Eliminar este componente y todas sus notas?')) return
          const r = await deleteExamAction(examId)
          if (r.ok) { toast.success('Eliminado'); router.refresh() }
          else toast.error(r.error ?? t('teacher.common.error'))
        }} />)
      )}

      <AddExamModal
        open={!!addExamFor}
        courseId={addExamFor?.id ?? ''}
        courseName={addExamFor?.name ?? ''}
        defaultPosition={addExamFor?.position ?? 0}
        onClose={() => setAddExamFor(null)}
      />
    </div>
  )
}

function CourseBlockView({ block, onAddExam, onDeleteExam }: { block: CourseBlock; onAddExam: () => void; onDeleteExam: (examId: string) => void }) {
  const { t } = useTranslation()
  const totalWeight = block.exams.reduce((s, e) => s + (e.percentage ?? 0), 0)

  // grade lookup
  const gradeFor = (examId: string, studentId: string): number | null => {
    const g = block.grades.find(x => x.exam_id === examId && x.student_id === studentId)
    return g?.grade ?? null
  }

  const studentAverage = (studentId: string): number | null => {
    let earned = 0, gradedWeight = 0
    for (const ex of block.exams) {
      const g = gradeFor(ex.id, studentId)
      const pct = ex.percentage ?? 0
      if (g != null && pct > 0) { earned += g * (pct / 100); gradedWeight += pct }
    }
    return gradedWeight === 0 ? null : earned / (gradedWeight / 100)
  }

  return (
    <section className={`${accentClass(block.accent)}`} style={{ marginTop: 28 }}>
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{block.semester ?? 'Curso'}</span>
          <h2 className="t-section-head__title">{block.name}</h2>
        </div>
        <button type="button" className="t-btn-line" onClick={onAddExam}>
          <span className="material-symbols-outlined">add</span>
          Componente
        </button>
      </header>

      <div className="t-card" style={{ padding: 0, overflowX: 'auto' }}>
        {block.exams.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
            <div style={{ fontSize: 13.5 }}>{t('teacher.grades.noExams')}</div>
            <div style={{ fontSize: 12, color: 'var(--color-outline)', marginTop: 4 }}>{t('teacher.grades.noExamsHint')}</div>
          </div>
        ) : block.students.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--on-surface-variant)' }}>
            <div style={{ fontSize: 13.5 }}>{t('teacher.grades.noStudents')}</div>
          </div>
        ) : (
          <table className="t-grade-table" role="grid">
            <thead>
              <tr>
                <th>{t('teacher.grades.student')}</th>
                {block.exams.map((e) => (
                  <th key={e.id} title={e.title}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                      <span>{e.title}</span>
                      <span style={{ color: 'var(--accent-color, var(--color-primary))', fontSize: 9 }}>{e.percentage ?? 0}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteExam(e.id)}
                      aria-label="Eliminar componente"
                      style={{ background: 'transparent', border: 0, color: 'var(--color-outline)', cursor: 'pointer', fontSize: 12, marginTop: 2 }}
                      title="Eliminar componente"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                    </button>
                  </th>
                ))}
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {block.students.map((s) => {
                const avg = studentAverage(s.id)
                return (
                  <tr key={s.id}>
                    <td>{s.full_name}</td>
                    {block.exams.map((e) => (
                      <td key={e.id}>
                        <GradeCell examId={e.id} studentId={s.id} initialGrade={gradeFor(e.id, s.id)} />
                      </td>
                    ))}
                    <td className={`t-grade-table__avg ${avg != null ? gradeClass(avg) : 'grade-pending'}`}>
                      {avg != null ? avg.toFixed(1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {totalWeight !== 100 && block.exams.length > 0 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--warning)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            ⚠ Los pesos suman {totalWeight}% — ajusta para sumar 100%
          </div>
        )}
      </div>
    </section>
  )
}
