'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { createExamAction } from '@/app/(teacher)/teacher/grades/actions'

interface Props {
  open: boolean
  courseId: string
  courseName: string
  defaultPosition?: number
  onClose: () => void
}

export function AddExamModal({ open, courseId, courseName, defaultPosition = 0, onClose }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [percentage, setPercentage] = useState(20)
  const [examDate, setExamDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [pending, start] = useTransition()

  useEffect(() => {
    if (open) {
      setTitle('')
      setPercentage(20)
      setExamDate(new Date().toISOString().slice(0, 10))
    }
  }, [open])

  if (!open) return null

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    start(async () => {
      const r = await createExamAction({ courseId, title: title.trim(), percentage, examDate, position: defaultPosition })
      if (r.ok) { toast.success('Componente añadido'); onClose(); router.refresh() }
      else toast.error(r.error ?? t('teacher.common.error'))
    })
  }

  return (
    <div className="t-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="t-modal" role="dialog" aria-modal="true">
        <header className="t-modal__head">
          <h3>Nuevo componente · <span style={{ color: 'var(--color-outline)', fontStyle: 'normal', fontFamily: 'var(--font-sans)', fontSize: 15 }}>{courseName}</span></h3>
          <button type="button" className="t-btn-line" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <form onSubmit={onSubmit} className="t-modal__body">
          <div className="t-field">
            <label htmlFor="exam-title">Nombre</label>
            <input id="exam-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} placeholder="Parcial 1" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
            <div className="t-field">
              <label htmlFor="exam-pct">Peso (%)</label>
              <input id="exam-pct" type="number" min={0} max={100} step={1} value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} required />
            </div>
            <div className="t-field">
              <label htmlFor="exam-date">Fecha</label>
              <input id="exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            </div>
          </div>
          <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="t-btn-line">{t('teacher.common.cancel')}</button>
            <button type="submit" disabled={pending} className="t-btn-new">
              <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'add'}</span>
              {pending ? t('teacher.common.loading') : t('teacher.common.save')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
