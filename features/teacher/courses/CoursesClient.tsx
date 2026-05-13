'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { CourseModal } from './CourseModal'
import { accentClass } from '@/lib/accent'
import type { Course } from '@/types'

type CourseListItem = Course & {
  student_count: number
  average: number | null
  pass_rate: number | null
  pending_review: number
}

interface Props {
  initialCourses: CourseListItem[]
}

export function CoursesClient({ initialCourses }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const sp = useSearchParams()
  const [modalOpen, setModalOpen] = useState(sp.get('new') === '1')
  const [editing, setEditing] = useState<Course | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (sp.get('new') === '1' && !modalOpen) setModalOpen(true)
  }, [sp, modalOpen])

  const copyCode = async (code: string, id: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(id); toast.success(t('teacher.common.copied'))
      setTimeout(() => setCopied(null), 2000) } catch {
      toast.error(t('teacher.common.error'))
    }
  }

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.courses.title').toLowerCase()}</h1>
        </div>
        <button type="button" className="t-btn-new" onClick={() => { setEditing(null); setModalOpen(true) }}>
          <span className="material-symbols-outlined">add</span>
          {t('teacher.common.newCourse')}
        </button>
      </header>

      {initialCourses.length === 0 ? (
        <div className="t-empty">
          <div className="t-empty__icon"><span className="material-symbols-outlined">menu_book</span></div>
          <div className="t-empty__title">{t('teacher.dashboard.noCourses')}</div>
          <div className="t-empty__sub">{t('teacher.dashboard.createFirst')}</div>
          <button type="button" className="t-btn-new" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <span className="material-symbols-outlined">add</span>
            {t('teacher.common.newCourse')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
          {initialCourses.map((course) => (
            <Link key={course.id} href={`/teacher/courses/${course.id}`} className={`t-course-card ${accentClass(course.accent)}`}>
              <div className="t-course-card__head">
                <div className="t-course-card__icon">
                  <span className="material-symbols-outlined">{course.icon || 'menu_book'}</span>
                </div>
                <div className="t-course-card__title">
                  <span className="t-course-card__kicker">Curso{course.semester ? ` · ${course.semester}` : ''}</span>
                  <span className="t-course-card__name">{course.name}</span>
                </div>
              </div>

              <div className="t-course-card__meta">
                {course.student_count} {t('teacher.courses.students').toLowerCase()}
                {(course.credits ?? 0) > 0 && <> · {course.credits} créditos</>}
              </div>

              {course.access_code && (
                <div className="t-course-card__code">
                  <div>
                    <span className="t-code-block__label">{t('teacher.courses.accessCode')}</span>
                    <div className="t-course-card__code-value">{course.access_code}</div>
                  </div>
                  <button
                    type="button"
                    className="t-btn-line"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyCode(course.access_code!, course.id) }}
                  >
                    <span className="material-symbols-outlined">{copied === course.id ? 'check' : 'content_copy'}</span>
                    {copied === course.id ? t('teacher.common.copied') : t('teacher.common.copy')}
                  </button>
                </div>
              )}

              <div className="t-stat-strip" style={{ borderRadius: 10 }}>
                <div className="t-stat-strip__cell">
                  <span className="t-stat-strip__label">Promedio</span>
                  <span className="t-stat-strip__value">{course.average != null ? course.average.toFixed(1) : '—'}</span>
                </div>
                <div className="t-stat-strip__cell">
                  <span className="t-stat-strip__label">Aprobación</span>
                  <span className="t-stat-strip__value">{course.pass_rate != null ? `${Math.round(course.pass_rate)}%` : '—'}</span>
                </div>
                <div className="t-stat-strip__cell">
                  <span className="t-stat-strip__label">Por revisar</span>
                  <span className="t-stat-strip__value">{course.pending_review}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CourseModal
        open={modalOpen}
        course={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          if (sp.get('new') === '1') {
            const params = new URLSearchParams(sp.toString())
            params.delete('new')
            router.replace(`/teacher/courses${params.toString() ? `?${params.toString()}` : ''}`)
          }
        }}
      />
    </div>
  )
}
