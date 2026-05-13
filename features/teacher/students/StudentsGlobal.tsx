'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass, gradeClass } from '@/lib/accent'
import { getInitials } from '@/lib/utils'
import { CourseFilterChips, type FilterCourse } from '../shared/CourseFilterChips'
import { StudentDrawer, type DrawerStudent } from './StudentDrawer'
import { BulkMessageModal } from './BulkMessageModal'

export type StudentRow = {
  enrollment_id: string
  student_id: string
  full_name: string
  avatar_url: string | null
  course_id: string
  course_name: string
  course_accent: string | null
  average: number | null
  grades: { exam_title: string; percentage: number | null; grade: number | null }[]
  submissions: { id: string; status: string; submitted_at: string }[]
}

interface Props {
  students: StudentRow[]
  courseList: FilterCourse[]
}

export function StudentsGlobal({ students, courseList }: Props) {
  const { t } = useTranslation()
  const sp = useSearchParams()
  const selected = sp.get('course') || ''
  const [drawer, setDrawer] = useState<DrawerStudent | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const visible = useMemo(() => selected ? students.filter(s => s.course_id === selected) : students, [students, selected])
  const uniqueStudentIds = useMemo(() => Array.from(new Set(visible.map(s => s.student_id))), [visible])

  const openDrawer = (s: StudentRow) => {
    setDrawer({
      id: s.student_id,
      full_name: s.full_name,
      avatar_url: s.avatar_url,
      course_id: s.course_id,
      course_name: s.course_name,
      course_accent: s.course_accent,
      average: s.average,
      grades: s.grades,
      submissions: s.submissions,
    })
  }

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.students.title').toLowerCase()}</h1>
        </div>
        <button type="button" className="t-btn-new" onClick={() => setBulkOpen(true)} disabled={visible.length === 0}>
          <span className="material-symbols-outlined">forum</span>
          Enviar mensaje
        </button>
      </header>

      <CourseFilterChips courses={courseList} />

      {visible.length === 0 ? (
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">group</span></div>
          <div className="t-empty__title">{t('teacher.students.noStudents')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          {visible.map((s) => (
            <button
              key={s.enrollment_id}
              type="button"
              onClick={() => openDrawer(s)}
              className={`t-course-row ${accentClass(s.course_accent)}`}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="t-course-row__icon" aria-hidden>
                {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 8, objectFit: 'cover' }} /> : <span style={{ fontSize: 11, fontWeight: 600 }}>{getInitials(s.full_name)}</span>}
              </div>
              <div>
                <div className="t-course-row__name" style={{ fontFamily: 'var(--font-sans)', fontStyle: 'normal', fontWeight: 600, fontSize: 15 }}>{s.full_name}</div>
                <div className="t-course-row__meta">
                  <span className="t-tag">{s.course_name}</span>
                </div>
              </div>
              <div className={`t-course-row__avg ${s.average != null ? gradeClass(s.average) : ''}`}>{s.average != null ? s.average.toFixed(1) : '—'}</div>
              <span className="material-symbols-outlined t-course-row__chevron">chevron_right</span>
            </button>
          ))}
        </div>
      )}

      <StudentDrawer student={drawer} onClose={() => setDrawer(null)} />
      <BulkMessageModal
        open={bulkOpen}
        courseId={selected || null}
        recipientIds={uniqueStudentIds}
        recipientCount={uniqueStudentIds.length}
        onClose={() => setBulkOpen(false)}
      />
    </div>
  )
}
