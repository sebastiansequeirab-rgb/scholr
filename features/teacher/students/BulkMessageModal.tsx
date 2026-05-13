'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { sendBulkMessageAction } from '@/app/(teacher)/teacher/students/actions'

interface Props {
  open: boolean
  courseId: string | null
  recipientIds: string[]
  recipientCount: number
  onClose: () => void
}

export function BulkMessageModal({ open, courseId, recipientIds, recipientCount, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => {
    if (open) { setSubject(''); setBody('') }
  }, [open])

  if (!open) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await sendBulkMessageAction({ courseId, studentIds: recipientIds, subject: subject.trim(), body: body.trim() })
      if (r.ok) {
        toast.success(`Enviado a ${r.sent ?? recipientCount} estudiante${(r.sent ?? recipientCount) !== 1 ? 's' : ''}`)
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
          <h3>Enviar mensaje</h3>
          <button type="button" className="t-btn-line" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={submit} className="t-modal__body">
          <div className="t-field">
            <label>Destinatarios</label>
            <div style={{ fontSize: 14, color: 'var(--on-surface)' }}>
              {recipientCount} estudiante{recipientCount !== 1 ? 's' : ''} · verán el mensaje en su portal
            </div>
          </div>
          <div className="t-field">
            <label htmlFor="bulk-subject">Asunto</label>
            <input id="bulk-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required placeholder="Recordatorio: examen del jueves" />
          </div>
          <div className="t-field">
            <label htmlFor="bulk-body">Mensaje</label>
            <textarea id="bulk-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} rows={9} required />
          </div>
          <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="t-btn-line">{t('teacher.common.cancel')}</button>
            <button type="submit" disabled={pending || recipientCount === 0} className="t-btn-new">
              <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'send'}</span>
              {pending ? t('teacher.common.loading') : t('teacher.common.send')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
