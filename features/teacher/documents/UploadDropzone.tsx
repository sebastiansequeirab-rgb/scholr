'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { uploadDocumentAction } from '@/app/(teacher)/teacher/documents/actions'

interface Props {
  courses: { id: string; name: string }[]
  defaultCourseId?: string | null
}

export function UploadDropzone({ courses, defaultCourseId }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const [hover, setHover] = useState(false)
  const [courseId, setCourseId] = useState<string>(defaultCourseId ?? courses[0]?.id ?? '')
  const [pending, start] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = (files: FileList | File[]) => {
    if (!courseId) { toast.error('Selecciona un curso'); return }
    const list = Array.from(files)
    if (list.length === 0) return
    start(async () => {
      let success = 0, failed = 0
      for (const f of list) {
        const fd = new FormData()
        fd.set('courseId', courseId)
        fd.set('file', f)
        const r = await uploadDocumentAction(fd)
        if (r.ok) success++; else { failed++; toast.error(`${f.name}: ${r.error ?? 'error'}`) }
      }
      if (success > 0) toast.success(`${success} archivo${success !== 1 ? 's' : ''} subido${success !== 1 ? 's' : ''}`)
      if (failed === 0) router.refresh()
      if (success > 0) router.refresh()
    })
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setHover(true) }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => { e.preventDefault(); setHover(false); if (e.dataTransfer?.files) submit(e.dataTransfer.files) }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '28px 24px',
        border: `1.5px dashed ${hover ? 'var(--color-primary)' : 'var(--border-default)'}`,
        borderRadius: 14,
        background: hover ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : 'transparent',
        transition: 'background 140ms, border-color 140ms',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-outline)' }}>cloud_upload</span>
      <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--on-surface-variant)' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--on-surface)' }}>Arrastra archivos aquí</div>
        <div>O selecciona uno desde tu computadora — máx 25 MB</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{
          background: 'var(--s-low)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '8px 12px',
          color: 'var(--on-surface)',
          fontSize: 13,
        }}>
          {courses.length === 0 ? <option value="">Sin cursos</option> : courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="button" className="t-btn-new" onClick={() => inputRef.current?.click()} disabled={pending || !courseId}>
          <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'upload_file'}</span>
          {pending ? t('teacher.common.uploading') : t('teacher.documents.upload')}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files) submit(e.target.files); e.target.value = '' }}
        />
      </div>
    </div>
  )
}
