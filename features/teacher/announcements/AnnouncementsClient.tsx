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

  const urgentCount = announcements.filter(a => a.priority === 'urgent').length

  return (
    <div className="max-w-2xl mx-auto reveal-stagger">
      <Link href={`/teacher/courses/${courseId}`} className="kicker inline-flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity">
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {courseName}
      </Link>

      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker">Curso · {announcements.length} {announcements.length === 1 ? 'anuncio' : 'anuncios'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{t('teacher.announcements.title').toLowerCase()}</span>
          </h1>
          <p className="screen-head__sub">
            {urgentCount > 0
              ? <><span style={{ color: 'var(--danger)' }} className="font-mono tabular">{urgentCount}</span> urgente{urgentCount === 1 ? '' : 's'} pendiente{urgentCount === 1 ? '' : 's'}</>
              : 'Comunicación al curso, ordenada por fecha.'}
          </p>
        </div>
        <div className="screen-head__actions">
          <button onClick={() => { resetForm(); setFormOpen(true) }} className="btn btn-primary">
            <span className="material-symbols-outlined">add</span>
            {t('teacher.announcements.add')}
          </button>
        </div>
      </header>

      {/* Create form modal */}
      {formOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setFormOpen(false); resetForm() } }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="kicker">Nuevo</span>
                <h2 className="text-[22px] font-bold mt-1" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
                  <span className="serif">{t('teacher.announcements.add').toLowerCase()}</span>
                </h2>
              </div>
              <button onClick={() => { setFormOpen(false); resetForm() }} className="btn btn-icon btn-ghost" aria-label="Cerrar">
                <span className="material-symbols-outlined">close</span>
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
                  {(['normal', 'urgent'] as const).map((p) => {
                    const active = priority === p
                    const tint = p === 'urgent' ? 'var(--danger)' : 'var(--color-primary)'
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{
                          backgroundColor: active ? `color-mix(in srgb, ${tint} 14%, transparent)` : 'transparent',
                          color: active ? tint : 'var(--on-surface-variant)',
                          border: `1px solid ${active ? `color-mix(in srgb, ${tint} 35%, transparent)` : 'var(--border-subtle)'}`,
                        }}
                      >
                        {p === 'urgent' ? t('teacher.announcements.urgent') : t('teacher.announcements.normal')}
                      </button>
                    )
                  })}
                </div>
              </div>
              {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setFormOpen(false); resetForm() }} className="btn btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-4xl mb-2 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            campaign
          </span>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.announcements.noAnnouncements')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => {
            const isUrgent = a.priority === 'urgent'
            const accent = isUrgent ? 'var(--danger)' : 'var(--color-primary)'
            return (
              <div key={a.id} className="card" style={{ padding: '12px 12px 12px 14px', position: 'relative' }}>
                <span aria-hidden style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2, background: accent, borderRadius: 2 }} />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}>
                    <span className="material-symbols-outlined text-[16px]"
                      style={{ color: accent, fontVariationSettings: "'FILL' 1" }}>
                      campaign
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>{a.title}</p>
                      {isUrgent && (
                        <span className="badge badge--danger">
                          {t('teacher.announcements.urgent')}
                        </span>
                      )}
                    </div>
                    {a.content && (
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--on-surface-variant)' }}>
                        {a.content}
                      </p>
                    )}
                    <p className="mono text-[10px] mt-1.5" style={{ color: 'var(--color-outline)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteId(a.id)}
                    className="btn btn-icon btn-ghost flex-shrink-0"
                    aria-label={t('teacher.announcements.delete')}
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
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <span className="kicker" style={{ color: 'var(--danger)' }}>Confirmación</span>
            <h2 className="text-[20px] font-bold mt-1 mb-3" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              <span className="serif">{t('teacher.announcements.deleteTitle').replace('?', '').toLowerCase()}</span>
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--on-surface-variant)' }}>{t('teacher.announcements.deleteIrreversible')}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn btn-secondary flex-1">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteId)} className="btn btn-danger flex-1">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
