'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { accentClass } from '@/lib/accent'
import { useTranslation } from '@/hooks/useTranslation'

export type FilterCourse = { id: string; name: string; accent: string | null }

interface Props {
  courses: FilterCourse[]
  /** Optional max chips before "+N" collapse. Default 6 */
  collapseAfter?: number
}

export function CourseFilterChips({ courses, collapseAfter = 6 }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const selected = sp.get('course') || ''

  const setCourse = useCallback((id: string) => {
    const params = new URLSearchParams(sp.toString())
    if (id) params.set('course', id); else params.delete('course')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [router, pathname, sp])

  const visible = useMemo(() => courses.slice(0, collapseAfter), [courses, collapseAfter])
  const hidden  = courses.length > collapseAfter

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setCourse('')}
        className={`t-chip ${selected === '' ? 'is-active acc-blue' : ''}`}
      >
        <span className="t-chip__dot" />
        {t('teacher.common.allCourses')}
      </button>
      {visible.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCourse(c.id)}
          className={`t-chip ${accentClass(c.accent)} ${selected === c.id ? 'is-active' : ''}`}
        >
          <span className="t-chip__dot" />
          {c.name}
        </button>
      ))}
      {hidden && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-outline)', letterSpacing: '0.14em' }}>
          +{courses.length - collapseAfter}
        </span>
      )}
    </div>
  )
}
