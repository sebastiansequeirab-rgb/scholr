'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSubmissionAction } from '@/app/(app)/evaluaciones/submission-actions'

export type SubmissionState = {
  exists: boolean
  status: 'pending_review' | 'graded' | 'returned' | 'draft' | null
  submitted_at: string | null
}

interface Props {
  examId: string
  examTitle: string
  initial: SubmissionState
}

export function SubmissionInline({ examId, examTitle, initial }: Props) {
  const router = useRouter()
  const [state, setState] = useState(initial)
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [pending, start] = useTransition()

  useEffect(() => { setState(initial) }, [initial.exists, initial.status, initial.submitted_at])

  if (state.exists) {
    const label = state.status === 'graded' ? 'Calificado' : state.status === 'returned' ? 'Devuelto' : 'Entregado'
    const color = state.status === 'graded' ? 'var(--success)' : state.status === 'returned' ? 'var(--warning)' : 'var(--color-primary)'
    return (
      <span className="t-tag" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <span className="material-symbols-outlined" style={{ fontSize: 12, marginRight: 4 }}>check_circle</span>
        {label}
      </span>
    )
  }

  const submit = () => {
    start(async () => {
      const r = await createSubmissionAction({ examId, content: content.trim() })
      if (r.ok) {
        toast.success('Entregado')
        setState({ exists: true, status: 'pending_review', submitted_at: new Date().toISOString() })
        setOpen(false)
        router.refresh()
      } else {
        toast.error(r.error ?? 'No se pudo enviar')
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="t-btn-line" style={{ padding: '4px 10px', fontSize: 11.5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>
        Entregar
      </button>
      {open && (
        <div className="t-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="t-modal" role="dialog" aria-modal="true">
            <header className="t-modal__head">
              <h3>Entregar: <span style={{ fontFamily: 'var(--font-sans)', fontStyle: 'normal', fontSize: 15, color: 'var(--on-surface-variant)' }}>{examTitle}</span></h3>
              <button type="button" className="t-btn-line" onClick={() => setOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="t-modal__body">
              <div className="t-field">
                <label htmlFor="sub-content">Comentario (opcional)</label>
                <textarea id="sub-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Notas para el profesor…" />
              </div>
              <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setOpen(false)} className="t-btn-line">Cancelar</button>
                <button type="button" onClick={submit} disabled={pending} className="t-btn-new">
                  <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'send'}</span>
                  {pending ? 'Enviando…' : 'Entregar'}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
