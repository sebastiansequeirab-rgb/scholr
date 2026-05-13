'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { createAnnouncementAction, updateAnnouncementAction } from '@/app/(teacher)/teacher/announcements/actions'

export type AnnouncementDraft = {
  id?: string
  courseId: string
  title: string
  content: string
  priority: 'normal' | 'urgent'
}

interface Props {
  open: boolean
  initial?: AnnouncementDraft | null
  courses: { id: string; name: string }[]
  defaultCourseId?: string | null
  onClose: () => void
}

export function AnnouncementModal({ open, initial, courses, defaultCourseId, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [courseId, setCourseId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [pending, start] = useTransition()
  const editing = !!initial?.id

  useEffect(() => {
    if (!open) return
    setCourseId(initial?.courseId ?? defaultCourseId ?? courses[0]?.id ?? '')
    setTitle(initial?.title ?? '')
    setContent(initial?.content ?? '')
    setPriority(initial?.priority ?? 'normal')
  }, [open, initial, defaultCourseId, courses])

  if (!open) return null

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!courseId) { toast.error('Selecciona un curso'); return }
    start(async () => {
      const r = editing
        ? await updateAnnouncementAction(initial!.id!, { title: title.trim(), content: content.trim(), priority })
        : await createAnnouncementAction({ courseId, title: title.trim(), content: content.trim(), priority })
      if (r.ok) {
        toast.success(editing ? t('teacher.common.saved') : 'Anuncio publicado')
        onClose()
        router.refresh()
      } else {
        toast.error(r.error ?? t('teacher.common.error'))
      }
    })
  }

  return (
    <div className="t-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="t-modal" role="dialog" aria-modal="true">
        <header className="t-modal__head">
          <h3>{editing ? t('teacher.announcements.edit') : t('teacher.announcements.add')}</h3>
          <button type="button" className="t-btn-line" onClick={onClose} aria-label={t('teacher.common.cancel')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={onSubmit} className="t-modal__body">
          <div className="t-field">
            <label htmlFor="ann-course">Curso</label>
            <select id="ann-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={editing}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="t-field">
            <label htmlFor="ann-title">{t('teacher.announcements.titleField')}</label>
            <input id="ann-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Suspendida la clase del jueves" />
          </div>
          <div className="t-field">
            <label htmlFor="ann-content">{t('teacher.announcements.contentField')}</label>
            <textarea id="ann-content" value={content} onChange={(e) => setContent(e.target.value)} maxLength={8000} rows={6} />
          </div>
          <div className="t-field">
            <label>{t('teacher.announcements.priority')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={`t-btn-line ${priority === 'normal' ? 'is-active' : ''}`} onClick={() => setPriority('normal')} aria-pressed={priority === 'normal'}>
                {t('teacher.announcements.normal')}
              </button>
              <button type="button" className={`t-btn-line ${priority === 'urgent' ? 'is-active' : ''}`} onClick={() => setPriority('urgent')} aria-pressed={priority === 'urgent'} style={priority === 'urgent' ? { color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)' } : undefined}>
                {t('teacher.announcements.urgent')}
              </button>
            </div>
          </div>
          <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="t-btn-line">{t('teacher.common.cancel')}</button>
            <button type="submit" disabled={pending} className="t-btn-new">
              <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : (editing ? 'check' : 'send')}</span>
              {pending ? t('teacher.common.loading') : (editing ? t('teacher.common.save') : t('teacher.common.send'))}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
