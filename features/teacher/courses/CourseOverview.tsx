'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'

interface Student {
  id: string
  full_name: string
  avatar_url: string | null
}

interface CourseOverviewProps {
  course: {
    id: string
    name: string
    color: string
    icon: string | null
    access_code: string | null
  }
  students: Student[]
}

export function CourseOverview({ course, students }: CourseOverviewProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopyCode = () => {
    if (!course.access_code) return
    navigator.clipboard.writeText(course.access_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = [
    { href: `/teacher/courses/${course.id}/schedules`,     icon: 'calendar_month',       label: t('teacher.schedules.title')     },
    { href: `/teacher/courses/${course.id}/grades`,        icon: 'grade',                label: t('teacher.grades.title')        },
    { href: `/teacher/courses/${course.id}/announcements`, icon: 'campaign',             label: t('teacher.announcements.title') },
    { href: `/teacher/courses/${course.id}/documents`,     icon: 'folder_open',          label: t('teacher.documents.title')     },
    { href: `/teacher/courses/${course.id}/students`,      icon: 'group',                label: t('teacher.students.title')      },
  ]

  return (
    <div className="max-w-3xl mx-auto reveal-stagger">
      <Link href="/teacher/courses" className="kicker inline-flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity">
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {t('teacher.courses.title')}
      </Link>

      {/* Course header */}
      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker" style={{ color: course.color }}>Curso · {students.length} {students.length === 1 ? 'estudiante' : 'estudiantes'}</span>
          <h1 className="screen-head__title flex items-center gap-3">
            <span className="inline-flex w-10 h-10 items-center justify-center"
              style={{
                backgroundColor: `color-mix(in srgb, ${course.color} 14%, transparent)`,
                borderRadius: 'var(--radius-lg)',
              }}>
              <span className="material-symbols-outlined text-[20px]"
                style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                {course.icon || 'menu_book'}
              </span>
            </span>
            <span className="serif">{course.name}</span>
          </h1>
        </div>
      </header>

      {/* Access code card */}
      {course.access_code && (
        <div className="card overflow-hidden mb-4" style={{ padding: 0, position: 'relative' }}>
          <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: course.color }} />
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <span className="kicker">{t('teacher.courses.accessCode')} · {t('teacher.courses.shareCode')}</span>
              <p className="text-[28px] font-black font-mono tabular tracking-wider mt-1 leading-none"
                style={{ color: course.color }}>
                {course.access_code}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="btn btn-secondary"
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
        </div>
      )}

      {/* Quick action tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {tabs.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className="card p-4 flex items-center gap-3 hover:bg-[var(--s-base)] transition-all duration-150 active:scale-[0.99]"
          >
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: `color-mix(in srgb, ${course.color} 12%, transparent)`,
                borderRadius: 'var(--radius)',
              }}>
              <span className="material-symbols-outlined text-[18px]"
                style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
                {icon}
              </span>
            </div>
            <span className="flex-1 font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>
              {label}
            </span>
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--color-outline)' }}>
              chevron_right
            </span>
          </Link>
        ))}
      </div>

      {/* Students preview */}
      <div>
        <header className="section-head">
          <div className="section-head__left">
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>group</span>
            <span className="section-head__title">{t('teacher.students.title')}</span>
            {students.length > 0 && (
              <span className="section-head__count tabular">{students.length}</span>
            )}
          </div>
          {students.length > 0 && (
            <Link href={`/teacher/courses/${course.id}/students`} className="section-head__link">
              {t('common.seeAll')}
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          )}
        </header>
        {students.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="material-symbols-outlined text-3xl mb-2 block"
              style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
              group
            </span>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              {t('teacher.students.noStudents')}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 6 }}>
            {students.slice(0, 6).map((student) => (
              <div key={student.id} className="row" style={{ ['--accent-color' as string]: course.color }}>
                <div className="row__time flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${course.color} 18%, transparent)`,
                      color: course.color,
                    }}>
                    {student.avatar_url
                      ? <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                      : getInitials(student.full_name)
                    }
                  </div>
                </div>
                <div className="row__main">
                  <div className="row__title">{student.full_name}</div>
                </div>
                <div className="row__right" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
