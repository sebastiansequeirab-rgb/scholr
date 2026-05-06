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
    <div className="max-w-4xl mx-auto space-y-6 reveal-stagger">
      {/* Header */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Skolar · {t('teacher.dashboard.title')}</span>
          <h1 className="screen-head__title">
            {t('dashboard.greeting')}, <span className="serif">{profile.full_name?.split(' ')[0]}</span>
          </h1>
        </div>
      </header>

      {/* Stats — KPI ribbon */}
      <div className="grid grid-cols-2 gap-3">
        <div className="kpi">
          <span className="kpi__sub">{t('teacher.dashboard.totalCourses')}</span>
          <p className="kpi__num tabular" style={{ color: 'var(--color-primary)' }}>
            {courses.length}
          </p>
          <span className="kpi__hint">
            {courses.length === 1 ? 'curso activo' : 'cursos activos'}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__sub">{t('teacher.dashboard.totalStudents')}</span>
          <p className="kpi__num tabular" style={{ color: 'var(--color-primary)' }}>
            {totalStudents}
          </p>
          <span className="kpi__hint">
            inscritos en total
          </span>
        </div>
      </div>

      {/* Courses list */}
      <div>
        <header className="section-head">
          <div className="section-head__left">
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>menu_book</span>
            <span className="section-head__title">{t('teacher.courses.title')}</span>
            {courses.length > 0 && (
              <span className="section-head__count tabular">{courses.length}</span>
            )}
          </div>
          <Link href="/teacher/courses" className="section-head__link">
            {t('common.seeAll')}
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </header>

        {courses.length === 0 ? (
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
            <Link href="/teacher/courses" className="btn btn-primary inline-flex">
              <span className="material-symbols-outlined">add</span>
              {t('teacher.courses.add')}
            </Link>
          </div>
        ) : (
          <div className="card" style={{ padding: 6 }}>
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/teacher/courses/${course.id}`}
                className="row"
                style={{ ['--accent-color' as string]: course.color }}
              >
                <div className="row__time flex items-center justify-center">
                  <div className="w-9 h-9 flex items-center justify-center"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${course.color} 14%, transparent)`,
                      borderRadius: 'var(--radius-lg)',
                    }}>
                    <span className="material-symbols-outlined text-[18px]"
                      style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                      {course.icon || 'menu_book'}
                    </span>
                  </div>
                </div>
                <div className="row__main">
                  <div className="row__title">{course.name}</div>
                  <div className="row__meta">
                    <span className="font-mono tabular">{course.student_count}</span>
                    <span>{t('teacher.courses.students').toLowerCase()}</span>
                    {course.access_code && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular" style={{ color: course.color }}>
                          {course.access_code}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="row__right">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--color-outline)' }}>
                    chevron_right
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
