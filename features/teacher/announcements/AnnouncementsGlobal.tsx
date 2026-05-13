'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass } from '@/lib/accent'
import { CourseFilterChips, type FilterCourse } from '../shared/CourseFilterChips'
import { AnnouncementModal, type AnnouncementDraft } from './AnnouncementModal'
import { deleteAnnouncementAction } from '@/app/(teacher)/teacher/announcements/actions'

export type AnnouncementItem = {
  id: string
  course_id: string
  course_name: string
  course_accent: string | null
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  created_at: string
}

interface Props {
  announcements: AnnouncementItem[]
  courseList: FilterCourse[]
}

export function AnnouncementsGlobal({ announcements, courseList }: Props) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const sp = useSearchParams()
  const selected = sp.get('course') || ''
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementDraft | null>(null)

  const visible = useMemo(() => selected ? announcements.filter(a => a.course_id === selected) : announcements, [announcements, selected])

  const onDelete = async (id: string) => {
    if (!confirm(t('teacher.announcements.deleteIrreversible'))) return
    const r = await deleteAnnouncementAction(id)
    if (r.ok) { toast.success('Eliminado'); router.refresh() }
    else toast.error(r.error ?? t('teacher.common.error'))
  }

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.announcements.title').toLowerCase()}</h1>
        </div>
        <button type="button" className="t-btn-new" onClick={() => { setEditing(null); setOpen(true) }} disabled={courseList.length === 0}>
          <span className="material-symbols-outlined">add</span>
          {t('teacher.announcements.add')}
        </button>
      </header>

      <CourseFilterChips courses={courseList} />

      {visible.length === 0 ? (
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">campaign</span></div>
          <div className="t-empty__title">{t('teacher.announcements.noAnnouncements')}</div>
          {courseList.length > 0 && (
            <button type="button" className="t-btn-new" onClick={() => { setEditing(null); setOpen(true) }}>
              <span className="material-symbols-outlined">add</span>
              {t('teacher.announcements.add')}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
          {visible.map((a) => (
            <article key={a.id} className={`t-card t-card--accent ${accentClass(a.course_accent)}`}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="t-tag">{a.course_name}</span>
                  {a.priority === 'urgent' && <span className="t-tag" style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}>{t('teacher.announcements.urgent')}</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-outline)' }}>
                    {new Date(a.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="t-btn-line" style={{ padding: '6px 10px' }} onClick={() => { setEditing({ id: a.id, courseId: a.course_id, title: a.title, content: a.content ?? '', priority: a.priority }); setOpen(true) }} aria-label={t('teacher.announcements.edit')}>
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button type="button" className="t-btn-line" style={{ padding: '6px 10px', color: 'var(--danger)' }} onClick={() => onDelete(a.id)} aria-label={t('teacher.announcements.delete')}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </header>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--on-surface)', marginTop: 8 }}>{a.title}</h2>
              {a.content && (
                <div style={{ fontSize: 14, color: 'var(--on-surface-variant)', marginTop: 6, lineHeight: 1.55 }} className="t-md">
                  <ReactMarkdown>{a.content}</ReactMarkdown>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <AnnouncementModal
        open={open}
        initial={editing}
        courses={courseList}
        defaultCourseId={selected || null}
        onClose={() => { setOpen(false); setEditing(null) }}
      />
    </div>
  )
}
