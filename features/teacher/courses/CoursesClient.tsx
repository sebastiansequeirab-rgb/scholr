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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.courses.title')}
        </h1>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('teacher.courses.add')}
        </button>
      </div>

      {/* Courses grid */}
      {initialCourses.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            menu_book
          </span>
          <p className="font-semibold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.dashboard.noCourses')}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.dashboard.createFirst')}
          </p>
          <button onClick={() => setModalOpen(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('teacher.courses.add')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialCourses.map((course) => (
            <div
              key={course.id}
              className="card p-5 space-y-4"
              style={{ borderLeft: `4px solid ${course.color}` }}
            >
              {/* Course header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: course.color + '22' }}>
                  <span className="material-symbols-outlined text-[20px]"
                    style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                    {course.icon || 'menu_book'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: 'var(--on-surface)' }}>
                    {course.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                    {course.student_count} {t('teacher.courses.students').toLowerCase()}
                  </p>
                </div>
              </div>

              {/* Access code */}
              {course.access_code && (
                <div className="rounded-xl p-3 flex items-center justify-between gap-2"
                  style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: 'var(--color-outline)' }}>
                      {t('teacher.courses.accessCode')}
                    </p>
                    <p className="text-lg font-black font-mono tracking-wider" style={{ color: 'var(--color-primary)' }}>
                      {course.access_code}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyCode(course.access_code!, course.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: copiedId === course.id
                        ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                        : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                      color: copiedId === course.id ? 'var(--success)' : 'var(--color-primary)',
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedId === course.id ? 'check' : 'content_copy'}
                    </span>
                    {copiedId === course.id ? t('teacher.courses.codeCopied') : t('teacher.courses.copyCode')}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/teacher/courses/${course.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  {t('teacher.courses.overview')}
                </Link>
                <Link
                  href={`/teacher/courses/${course.id}/grades`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: 'var(--s-low)',
                    color: 'var(--on-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">grade</span>
                  {t('teacher.grades.title')}
                </Link>
              </div>
            </div>
          ))}
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
