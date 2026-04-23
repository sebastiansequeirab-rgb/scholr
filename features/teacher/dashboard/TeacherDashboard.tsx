'use client'

import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import type { Profile } from '@/types'

interface Course {
  id: string
  name: string
  color: string
  icon: string | null
  access_code: string | null
  student_count: number
}

interface TeacherDashboardProps {
  profile: Profile
  courses: Course[]
  totalStudents: number
}

export function TeacherDashboard({ profile, courses, totalStudents }: TeacherDashboardProps) {
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
          {t('dashboard.greeting')}, {profile.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>
          {t('teacher.dashboard.title')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-[11px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'var(--color-outline)' }}>
            {t('teacher.dashboard.totalCourses')}
          </p>
          <p className="text-4xl font-black" style={{ color: 'var(--color-primary)' }}>
            {courses.length}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] uppercase tracking-widest font-semibold mb-2"
            style={{ color: 'var(--color-outline)' }}>
            {t('teacher.dashboard.totalStudents')}
          </p>
          <p className="text-4xl font-black" style={{ color: 'var(--color-primary)' }}>
            {totalStudents}
          </p>
        </div>
      </div>

      {/* Courses list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.courses.title')}
          </h2>
          <Link
            href="/teacher/courses"
            className="text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            {t('common.seeAll')}
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="card p-10 text-center">
            <span className="material-symbols-outlined text-5xl mb-3 block"
              style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
              menu_book
            </span>
            <p className="font-semibold" style={{ color: 'var(--on-surface)' }}>
              {t('teacher.dashboard.noCourses')}
            </p>
            <p className="text-sm mt-1 mb-4" style={{ color: 'var(--on-surface-variant)' }}>
              {t('teacher.dashboard.createFirst')}
            </p>
            <Link href="/teacher/courses" className="btn-primary inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t('teacher.courses.add')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/teacher/courses/${course.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-all duration-150 active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: course.color + '22' }}>
                  <span className="material-symbols-outlined text-[20px]"
                    style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                    {course.icon || 'menu_book'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--on-surface)' }}>
                    {course.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                    {course.student_count} {t('teacher.courses.students').toLowerCase()}
                    {course.access_code && (
                      <span className="ml-2 font-mono" style={{ color: 'var(--color-primary)' }}>
                        · {course.access_code}
                      </span>
                    )}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--color-outline)' }}>
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
