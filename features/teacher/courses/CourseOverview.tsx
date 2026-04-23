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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/teacher/courses" className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {t('teacher.courses.title')}
      </Link>

      {/* Course header card */}
      <div className="card p-6" style={{ borderLeft: `4px solid ${course.color}` }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: course.color + '22' }}>
            <span className="material-symbols-outlined text-[28px]"
              style={{ color: course.color, fontVariationSettings: "'FILL' 1" }}>
              {course.icon || 'menu_book'}
            </span>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
              {course.name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
              {students.length} {t('teacher.courses.students').toLowerCase()}
            </p>
          </div>
        </div>

        {/* Access code */}
        {course.access_code && (
          <div className="mt-5 rounded-xl p-4 flex items-center justify-between gap-3"
            style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                style={{ color: 'var(--color-outline)' }}>
                {t('teacher.courses.accessCode')} — {t('teacher.courses.shareCode')}
              </p>
              <p className="text-2xl font-black font-mono tracking-wider" style={{ color: 'var(--color-primary)' }}>
                {course.access_code}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: copied
                  ? 'color-mix(in srgb, #10b981 15%, transparent)'
                  : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                color: copied ? '#10b981' : 'var(--color-primary)',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? t('teacher.courses.codeCopied') : t('teacher.courses.copyCode')}
            </button>
          </div>
        )}
      </div>

      {/* Quick action tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tabs.map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-all duration-150 active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-[22px]"
              style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
              {icon}
            </span>
            <span className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>
              {label}
            </span>
            <span className="material-symbols-outlined text-[16px] ml-auto" style={{ color: 'var(--color-outline)' }}>
              chevron_right
            </span>
          </Link>
        ))}
      </div>

      {/* Students preview */}
      <div>
        <h2 className="text-base font-bold mb-3" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.students.title')}
        </h2>
        {students.length === 0 ? (
          <div className="card p-8 text-center">
            <span className="material-symbols-outlined text-4xl mb-2 block"
              style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
              group
            </span>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              {t('teacher.students.noStudents')}
            </p>
          </div>
        ) : (
          <div className="card divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[11px] font-bold"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                    color: 'var(--color-primary)',
                  }}>
                  {student.avatar_url
                    ? <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                    : getInitials(student.full_name)
                  }
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>
                  {student.full_name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
