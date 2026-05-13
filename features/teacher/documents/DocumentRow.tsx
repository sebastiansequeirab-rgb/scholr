'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass } from '@/lib/accent'
import { fileIcon, formatBytes } from '@/lib/mime'
import { deleteDocumentAction, getDocumentSignedUrlAction, renameDocumentAction } from '@/app/(teacher)/teacher/documents/actions'

export type DocumentItem = {
  id: string
  course_id: string
  course_name: string
  course_accent: string | null
  title: string
  file_type: string | null
  size_bytes: number | null
  created_at: string
}

export function DocumentRow({ doc }: { doc: DocumentItem }) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const { icon, label } = fileIcon(doc.file_type, doc.title)
  const [pending, start] = useTransition()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(doc.title)

  const download = () => {
    start(async () => {
      const r = await getDocumentSignedUrlAction(doc.id)
      if (!r.ok || !r.url) { toast.error(r.error ?? t('teacher.common.error')); return }
      window.open(r.url, '_blank', 'noopener')
    })
  }

  const remove = () => {
    if (!confirm(`${t('teacher.documents.deleteTitle')} ${doc.title}`)) return
    start(async () => {
      const r = await deleteDocumentAction(doc.id)
      if (r.ok) { toast.success('Eliminado'); router.refresh() }
      else toast.error(r.error ?? t('teacher.common.error'))
    })
  }

  const rename = () => {
    if (!name.trim()) { toast.error('Nombre vacío'); return }
    start(async () => {
      const r = await renameDocumentAction({ documentId: doc.id, title: name.trim() })
      if (r.ok) { toast.success(t('teacher.common.saved')); setRenaming(false); router.refresh() }
      else toast.error(r.error ?? t('teacher.common.error'))
    })
  }

  return (
    <article className={`t-card t-card--accent ${accentClass(doc.course_accent)}`} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--accent-color, var(--color-primary))' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') { setRenaming(false); setName(doc.title) } }}
            onBlur={() => { if (name !== doc.title) rename(); else setRenaming(false) }}
            style={{
              width: '100%',
              background: 'var(--s-base)',
              border: '1px solid var(--color-primary)',
              borderRadius: 8,
              padding: '4px 8px',
              color: 'var(--on-surface)',
              fontSize: 14,
            }}
          />
        ) : (
          <div style={{ fontSize: 14, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-outline)' }}>
          <span className="t-tag" style={{ background: 'var(--accent-bg, transparent)' }}>{doc.course_name}</span>
          <span>{label} · {formatBytes(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" className="t-btn-line" style={{ padding: '6px 10px' }} onClick={download} disabled={pending} aria-label={t('teacher.documents.download')}>
          <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'download'}</span>
        </button>
        <button type="button" className="t-btn-line" style={{ padding: '6px 10px' }} onClick={() => setRenaming(true)} aria-label="Renombrar">
          <span className="material-symbols-outlined">edit</span>
        </button>
        <button type="button" className="t-btn-line" style={{ padding: '6px 10px', color: 'var(--danger)' }} onClick={remove} aria-label={t('teacher.documents.delete')}>
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>
    </article>
  )
}
