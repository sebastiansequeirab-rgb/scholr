'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { CourseFilterChips, type FilterCourse } from '../shared/CourseFilterChips'
import { UploadDropzone } from './UploadDropzone'
import { DocumentRow, type DocumentItem } from './DocumentRow'

interface Props {
  documents: DocumentItem[]
  courseList: FilterCourse[]
}

export function DocumentsGlobal({ documents, courseList }: Props) {
  const { t } = useTranslation()
  const sp = useSearchParams()
  const selected = sp.get('course') || ''

  const visible = useMemo(() => selected ? documents.filter(d => d.course_id === selected) : documents, [documents, selected])

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.documents.title').toLowerCase()}</h1>
        </div>
      </header>

      <CourseFilterChips courses={courseList} />

      <div style={{ marginTop: 18 }}>
        <UploadDropzone courses={courseList} defaultCourseId={selected || null} />
      </div>

      {visible.length === 0 ? (
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">folder_open</span></div>
          <div className="t-empty__title">{t('teacher.documents.noDocuments')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12, marginTop: 18 }}>
          {visible.map(d => <DocumentRow key={d.id} doc={d} />)}
        </div>
      )}
    </div>
  )
}
