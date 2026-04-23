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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/teacher/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {courseName}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.documents.title')}
        </h1>
        <div>
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
            className="btn-primary flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {uploading ? 'hourglass_empty' : 'upload'}
            </span>
            {uploading ? t('teacher.documents.uploading') : t('teacher.documents.upload')}
          </button>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">
          {uploadError}
        </p>
      )}

      {documents.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            folder_open
          </span>
          <p className="font-semibold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.documents.noDocuments')}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">upload</span>
            {t('teacher.documents.upload')}
          </button>
        </div>
      ) : (
        <div className="card divide-y">
          {documents.map((doc) => {
            const icon = FILE_ICONS[doc.file_type ?? ''] ?? 'insert_drive_file'
            return (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                  <span className="material-symbols-outlined text-[18px]"
                    style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: 'var(--on-surface)' }}>
                    {doc.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                    {doc.size_bytes != null ? formatFileSize(doc.size_bytes) : '—'}
                    {' · '}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 rounded-lg hover:bg-[var(--s-low)] transition-all"
                    style={{ color: 'var(--color-primary)' }}
                    title={t('teacher.documents.download')}
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="p-2 rounded-lg hover:text-red-400 transition-colors"
                    style={{ color: 'var(--color-outline)' }}
                    title={t('teacher.documents.delete')}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && deleteDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
            <h2 className="font-bold" style={{ color: 'var(--on-surface)' }}>{t('teacher.documents.deleteTitle')}</h2>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
              <strong>{deleteDoc.title}</strong> {t('teacher.documents.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteDoc)} className="btn-danger flex-1">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
