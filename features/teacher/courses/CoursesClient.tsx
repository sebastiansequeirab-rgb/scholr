'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { CourseModal } from './CourseModal'

interface Course {
  id: string
  name: string
  color: string
  icon: string | null
  access_code: string | null
  student_count: number
}

interface CoursesClientProps {
  initialCourses: Course[]
  teacherId: string
}

export function CoursesClient({ initialCourses, teacherId }: CoursesClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyCode = (code: string, courseId: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(courseId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSaved = () => {
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto reveal-stagger">
      {/* Header */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Skolar · {t('teacher.dashboard.title')}</span>
          <h1 className="screen-head__title">
            <span className="serif">{t('teacher.courses.title').toLowerCase()}</span>
          </h1>
        </div>
        <div className="screen-head__actions">
          <button onClick={() => setModalOpen(true)} className="btn btn-primary">
            <span className="material-symbols-outlined">add</span>
            {t('teacher.courses.add')}
          </button>
        </div>
      </header>

      {/* Courses grid */}
      {initialCourses.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-4xl mb-2 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            menu_book
          </span>
          <span className="kicker">Comienza aquí</span>
          <p className="text-base font-bold mt-1" style={{ color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
            <span className="serif">{t('teacher.dashboard.noCourses').toLowerCase()}</span>
          </p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--color-outline)' }}>
            {t('teacher.dashboard.createFirst')}
          </p>
          <button onClick={() => setModalOpen(true)} className="btn btn-primary mx-auto inline-flex">
            <span className="material-symbols-outlined">add</span>
            {t('teacher.courses.add')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialCourses.map((course) => {
            const copied = copiedId === course.id
            return (
              <div key={course.id} className="card overflow-hidden" style={{ padding: 0, position: 'relative' }}>
                <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: course.color }} />
                <div className="p-5 space-y-4">
                  {/* Course header */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${course.color} 14%, transparent)`,
                        borderRadius: 'var(--radius-lg)',
                      }}>
                      <span className="material-symbols-outlined text-[18px]"
                        style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                        {course.icon || 'menu_book'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="kicker" style={{ color: course.color }}>Curso</span>
                      <p className="font-bold text-[17px] mt-0.5 truncate" style={{ color: 'var(--on-surface)', letterSpacing: '-0.015em' }}>
                        <span className="serif">{course.name}</span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                        <span className="font-mono tabular">{course.student_count}</span> {t('teacher.courses.students').toLowerCase()}
                      </p>
                    </div>
                  </div>

                  {/* Access code */}
                  {course.access_code && (
                    <div className="p-3 flex items-center justify-between gap-2"
                      style={{
                        backgroundColor: 'var(--s-low)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius)',
                      }}>
                      <div>
                        <span className="kicker">{t('teacher.courses.accessCode')}</span>
                        <p className="text-lg font-black font-mono tabular tracking-wider mt-0.5" style={{ color: course.color }}>
                          {course.access_code}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCopyCode(course.access_code!, course.id)}
                        className="btn btn-secondary text-xs"
                        style={copied ? {
                          background: 'color-mix(in srgb, var(--success) 14%, transparent)',
                          color: 'var(--success)',
                          borderColor: 'color-mix(in srgb, var(--success) 30%, transparent)',
                        } : undefined}
                      >
                        <span className="material-symbols-outlined">
                          {copied ? 'check' : 'content_copy'}
                        </span>
                        {copied ? t('teacher.courses.codeCopied') : t('teacher.courses.copyCode')}
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="btn btn-primary flex-1 text-xs"
                      style={{ background: course.color, color: 'white', borderColor: course.color }}
                    >
                      <span className="material-symbols-outlined">open_in_new</span>
                      {t('teacher.courses.overview')}
                    </Link>
                    <Link
                      href={`/teacher/courses/${course.id}/grades`}
                      className="btn btn-secondary flex-1 text-xs"
                    >
                      <span className="material-symbols-outlined">grade</span>
                      {t('teacher.grades.title')}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        teacherId={teacherId}
      />
    </div>
  )
}
