'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { Announcement } from '@/types'

interface AnnouncementsClientProps {
  courseId: string
  courseName: string
  teacherId: string
  initialAnnouncements: Announcement[]
}

export function AnnouncementsClient({ courseId, courseName, teacherId, initialAnnouncements }: AnnouncementsClientProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const resetForm = () => {
    setTitle(''); setContent(''); setPriority('normal'); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError(t('auth.errors.required')); return }
    setLoading(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('announcements').insert({
      subject_id: courseId,
      teacher_id: teacherId,
      title: title.trim(),
      content: content.trim() || null,
      priority,
    })
    if (dbError) { setError(dbError.message); setLoading(false); return }
    setLoading(false)
    setFormOpen(false)
    resetForm()
    router.refresh()
    // Optimistic refresh from server
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('subject_id', courseId)
      .order('created_at', { ascending: false })
    if (data) setAnnouncements(data as Announcement[])
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id).eq('teacher_id', teacherId)
    setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    setDeleteId(null)
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href={`/teacher/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {courseName}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.announcements.title')}
        </h1>
        <button onClick={() => { resetForm(); setFormOpen(true) }} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('teacher.announcements.add')}
        </button>
      </div>

      {/* Create form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setFormOpen(false); resetForm() } }}
        >
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>
                {t('teacher.announcements.add')}
              </h2>
              <button onClick={() => { setFormOpen(false); resetForm() }} className="p-1 rounded-lg" style={{ color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">{t('teacher.announcements.titleField')}</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input" autoFocus />
              </div>
              <div>
                <label className="label">{t('teacher.announcements.contentField')}</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  className="input resize-none"
                />
              </div>
              <div>
                <label className="label">{t('teacher.announcements.priority')}</label>
                <div className="flex gap-2 mt-1">
                  {(['normal', 'urgent'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        backgroundColor: priority === p
                          ? (p === 'urgent' ? 'color-mix(in srgb, #ef4444 15%, transparent)' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)')
                          : 'var(--s-low)',
                        color: priority === p
                          ? (p === 'urgent' ? '#ef4444' : 'var(--color-primary)')
                          : 'var(--on-surface)',
                        border: `1px solid ${priority === p ? (p === 'urgent' ? '#ef4444' : 'var(--color-primary)') : 'var(--border-subtle)'}`,
                      }}
                    >
                      {p === 'urgent' ? t('teacher.announcements.urgent') : t('teacher.announcements.normal')}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setFormOpen(false); resetForm() }} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            campaign
          </span>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.announcements.noAnnouncements')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="card p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: a.priority === 'urgent' ? '#fef2f2' : 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                }}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{
                    color: a.priority === 'urgent' ? '#ef4444' : 'var(--color-primary)',
                    fontVariationSettings: "'FILL' 1",
                  }}>
                  campaign
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>{a.title}</p>
                  {a.priority === 'urgent' && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                      {t('teacher.announcements.urgent')}
                    </span>
                  )}
                </div>
                {a.content && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--on-surface-variant)' }}>
                    {a.content}
                  </p>
                )}
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-outline)' }}>
                  {formatDate(a.created_at)}
                </p>
              </div>
              <button
                onClick={() => setDeleteId(a.id)}
                className="p-1 rounded-lg flex-shrink-0 hover:text-red-400 transition-colors"
                style={{ color: 'var(--color-outline)' }}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
            <h2 className="font-bold" style={{ color: 'var(--on-surface)' }}>¿Eliminar anuncio?</h2>
            <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger flex-1">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
