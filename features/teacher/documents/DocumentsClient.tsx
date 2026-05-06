'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { formatFileSize } from '@/features/teacher/courses/utils'
import type { Document } from '@/types'

interface DocumentsClientProps {
  courseId: string
  courseName: string
  teacherId: string
  initialDocuments: Document[]
}

const FILE_ICONS: Record<string, string> = {
  'application/pdf': 'picture_as_pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'application/msword': 'description',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
  'application/vnd.ms-powerpoint': 'slideshow',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slideshow',
  'application/vnd.ms-excel': 'table_chart',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'table_chart',
  'text/plain': 'article',
}

export function DocumentsClient({ courseId, courseName, teacherId, initialDocuments }: DocumentsClientProps) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError('')

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = `${teacherId}/${courseId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('course-documents')
      .upload(filePath, file, { contentType: file.type })

    if (uploadError) {
      setUploadError(uploadError.message)
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const { data: urlData } = supabase.storage
      .from('course-documents')
      .getPublicUrl(filePath)

    // Insert document metadata
    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        subject_id: courseId,
        uploaded_by: teacherId,
        title: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        size_bytes: file.size,
      })
      .select()
      .single()

    if (dbError) {
      setUploadError(dbError.message)
    } else if (doc) {
      setDocuments((prev) => [doc as Document, ...prev])
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (doc: Document) => {
    const supabase = createClient()
    // Extract storage path from URL
    const url = new URL(doc.file_url)
    const pathParts = url.pathname.split('/course-documents/')
    if (pathParts[1]) {
      await supabase.storage.from('course-documents').remove([pathParts[1]])
    }
    await supabase.from('documents').delete().eq('id', doc.id).eq('uploaded_by', teacherId)
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    setDeleteId(null)
  }

  const handleDownload = async (doc: Document) => {
    const supabase = createClient()
    const url = new URL(doc.file_url)
    const pathParts = url.pathname.split('/course-documents/')
    if (!pathParts[1]) return
    const { data } = await supabase.storage.from('course-documents').createSignedUrl(pathParts[1], 60)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const deleteDoc = documents.find((d) => d.id === deleteId)

  const totalSize = documents.reduce((acc, d) => acc + (d.size_bytes ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto reveal-stagger">
      <Link href={`/teacher/courses/${courseId}`} className="kicker inline-flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity">
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {courseName}
      </Link>

      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Curso · {documents.length} {documents.length === 1 ? 'archivo' : 'archivos'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{t('teacher.documents.title').toLowerCase()}</span>
          </h1>
          <p className="screen-head__sub">
            {documents.length === 0
              ? 'Material disponible para los alumnos del curso.'
              : <><span className="font-mono tabular">{formatFileSize(totalSize)}</span> en total</>}
          </p>
        </div>
        <div className="screen-head__actions">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary"
          >
            <span className="material-symbols-outlined">
              {uploading ? 'hourglass_empty' : 'upload'}
            </span>
            {uploading ? t('teacher.documents.uploading') : t('teacher.documents.upload')}
          </button>
        </div>
      </header>

      {uploadError && (
        <div className="card mb-3" style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border-subtle))' }}>
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {uploadError}
          </p>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-4xl mb-2 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            folder_open
          </span>
          <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.documents.noDocuments')}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary mt-4 inline-flex"
          >
            <span className="material-symbols-outlined">upload</span>
            {t('teacher.documents.upload')}
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {documents.map((doc) => {
            const icon = FILE_ICONS[doc.file_type ?? ''] ?? 'insert_drive_file'
            return (
              <div key={doc.id} className="row" style={{ ['--accent-color' as string]: 'var(--color-primary)' }}>
                <div className="row__time flex items-center justify-center">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                    <span className="material-symbols-outlined text-[16px]"
                      style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                      {icon}
                    </span>
                  </div>
                </div>
                <div className="row__main">
                  <div className="row__title truncate">{doc.title}</div>
                  <div className="row__meta">
                    <span className="font-mono tabular">{doc.size_bytes != null ? formatFileSize(doc.size_bytes) : '—'}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="row__right flex items-center gap-1">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="btn btn-icon btn-ghost"
                    style={{ color: 'var(--color-primary)' }}
                    title={t('teacher.documents.download')}
                  >
                    <span className="material-symbols-outlined">download</span>
                  </button>
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="btn btn-icon btn-ghost"
                    title={t('teacher.documents.delete')}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && deleteDoc && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <span className="kicker" style={{ color: 'var(--danger)' }}>Confirmación</span>
            <h2 className="text-[20px] font-bold mt-1 mb-3" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              <span className="serif">{t('teacher.documents.deleteTitle').replace('?', '').toLowerCase()}</span>
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--on-surface-variant)' }}>
              <strong style={{ color: 'var(--on-surface)' }}>{deleteDoc.title}</strong> {t('teacher.documents.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteDoc)} className="btn btn-danger flex-1">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
