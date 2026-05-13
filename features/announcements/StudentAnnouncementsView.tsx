'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass } from '@/lib/accent'
import { markAnnouncementReadAction, markAllAnnouncementsReadAction } from '@/app/(app)/anuncios/actions'
import type { CourseAccent } from '@/types'

export type StudentAnnouncementCourse = {
  id: string
  name: string
  accent: CourseAccent | null
}

export type StudentAnnouncementItem = {
  id: string
  courseId: string
  courseName: string
  courseAccent: CourseAccent | null
  teacherName: string | null
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  expiresAt: string | null
  createdAt: string
  read: boolean
}

type Filter = 'all' | 'urgent' | 'unread'

interface Props {
  announcements: StudentAnnouncementItem[]
  courses: StudentAnnouncementCourse[]
}

function formatRelative(iso: string, lang: 'es' | 'en'): string {
  const date = new Date(iso)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return lang === 'es' ? 'Ahora' : 'Now'
  if (diffMin < 60) return `${diffMin}m`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })
}

function formatFull(iso: string, lang: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function StudentAnnouncementsView({ announcements, courses }: Props) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const lang = language === 'es' ? 'es' : 'en'

  const initialCourseFilter = searchParams.get('course') || ''
  const initialFilter = (searchParams.get('filter') as Filter) || 'all'
  const initialId = searchParams.get('id') || announcements[0]?.id || null

  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [courseFilter, setCourseFilter] = useState<string>(initialCourseFilter)
  const [activeId, setActiveId] = useState<string | null>(initialId)

  const visible = useMemo(() => {
    return announcements.filter(a => {
      if (courseFilter && a.courseId !== courseFilter) return false
      if (filter === 'urgent' && a.priority !== 'urgent') return false
      if (filter === 'unread' && a.read) return false
      return true
    })
  }, [announcements, filter, courseFilter])

  // Keep active selection valid
  useEffect(() => {
    if (visible.length === 0) {
      setActiveId(null)
      return
    }
    if (!activeId || !visible.find(a => a.id === activeId)) {
      setActiveId(visible[0].id)
    }
  }, [visible, activeId])

  const active = useMemo(() => visible.find(a => a.id === activeId) ?? null, [visible, activeId])

  // Auto-mark active as read when it changes
  useEffect(() => {
    if (!active || active.read) return
    const id = active.id
    startTransition(async () => {
      const r = await markAnnouncementReadAction(id)
      if (r.ok) router.refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const unreadCount = announcements.filter(a => !a.read).length

  const onMarkAllRead = useCallback(() => {
    const unreadIds = announcements.filter(a => !a.read).map(a => a.id)
    if (unreadIds.length === 0) return
    startTransition(async () => {
      const r = await markAllAnnouncementsReadAction(unreadIds)
      if (r.ok) { toast.success(t('studentAnnouncements.markAllRead')); router.refresh() }
      else toast.error(r.error ?? 'Error')
    })
  }, [announcements, router, t])

  if (announcements.length === 0) {
    return (
      <>
        <header className="t-section-head" style={{ marginTop: 0 }}>
          <div className="t-section-head__left">
            <span className="t-section-head__kicker">{t('studentAnnouncements.kicker')}</span>
            <h1 className="t-section-head__title">{t('studentAnnouncements.title').toLowerCase()}</h1>
          </div>
        </header>
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">campaign</span></div>
          <div className="t-empty__title">{t('studentAnnouncements.empty')}</div>
          <div className="t-empty__sub">{t('studentAnnouncements.emptyDesc')}</div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('studentAnnouncements.kicker')}</span>
          <h1 className="t-section-head__title">{t('studentAnnouncements.title').toLowerCase()}</h1>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="t-btn-line"
            onClick={onMarkAllRead}
            disabled={pending}
            style={{ padding: '8px 14px' }}
          >
            <span className="material-symbols-outlined">done_all</span>
            <span>{t('studentAnnouncements.markAllRead')}</span>
          </button>
        )}
      </header>

      {/* Filter chips */}
      <div className="ann-filters">
        <button
          type="button"
          className={`ann-filter ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('studentAnnouncements.all')}
          <span className="ann-filter__count">{announcements.length}</span>
        </button>
        <button
          type="button"
          className={`ann-filter ${filter === 'unread' ? 'is-active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          {t('studentAnnouncements.unread')}
          {unreadCount > 0 && <span className="ann-filter__count">{unreadCount}</span>}
        </button>
        <button
          type="button"
          className={`ann-filter ${filter === 'urgent' ? 'is-active' : ''}`}
          onClick={() => setFilter('urgent')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--danger)' }}>priority_high</span>
          {t('studentAnnouncements.urgent')}
        </button>

        {courses.length > 1 && (
          <select
            className="ann-filter__select"
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            aria-label={t('studentAnnouncements.filterCourse')}
          >
            <option value="">{t('studentAnnouncements.filterCourseAll')}</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Split view: list + detail */}
      <div className="ann-shell">
        <aside className="ann-shell__list" aria-label="Anuncios">
          {visible.length === 0 ? (
            <div className="ann-shell__empty">
              <span className="material-symbols-outlined">filter_alt_off</span>
              <span>{t('studentAnnouncements.empty')}</span>
            </div>
          ) : (
            visible.map(a => {
              const isActive = a.id === activeId
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={`ann-card ${isActive ? 'is-active' : ''} ${!a.read ? 'is-unread' : ''}`}
                >
                  <div className="ann-card__head">
                    <span className={`ann-card__tag ${accentClass(a.courseAccent)}`}>{a.courseName}</span>
                    {a.priority === 'urgent' && (
                      <span className="ann-card__urgent">
                        <span className="material-symbols-outlined">priority_high</span>
                        {t('studentAnnouncements.urgentBadge')}
                      </span>
                    )}
                    <span className="ann-card__time">{formatRelative(a.createdAt, lang)}</span>
                  </div>
                  <div className="ann-card__title">{a.title}</div>
                  {a.content && (
                    <div className="ann-card__preview">{a.content.replace(/[#*_`>\-]/g, '').slice(0, 140)}</div>
                  )}
                  {!a.read && <span className="ann-card__unread-dot" aria-hidden />}
                </button>
              )
            })
          )}
        </aside>

        <section className="ann-shell__detail" aria-label="Detalle">
          {active ? (
            <article className={`ann-detail ${accentClass(active.courseAccent)}`}>
              <header className="ann-detail__head">
                <div className="ann-detail__chips">
                  <span className={`ann-detail__tag ${accentClass(active.courseAccent)}`}>{active.courseName}</span>
                  {active.priority === 'urgent' && (
                    <span className="ann-detail__urgent">
                      <span className="material-symbols-outlined">priority_high</span>
                      {t('studentAnnouncements.urgentBadge')}
                    </span>
                  )}
                </div>
                <span className="ann-detail__date">{formatFull(active.createdAt, lang)}</span>
              </header>
              <h2 className="ann-detail__title">{active.title}</h2>
              {active.teacherName && (
                <div className="ann-detail__author">
                  <span className="material-symbols-outlined">person</span>
                  <span>{t('studentAnnouncements.publishedBy')} <strong>{active.teacherName}</strong></span>
                </div>
              )}
              {active.content && (
                <div className="ann-detail__body t-md">
                  <ReactMarkdown>{active.content}</ReactMarkdown>
                </div>
              )}
              {active.expiresAt && (
                <footer className="ann-detail__foot">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>{t('studentAnnouncements.expires')}: {formatFull(active.expiresAt, lang)}</span>
                </footer>
              )}
            </article>
          ) : (
            <div className="ann-shell__empty">
              <span className="material-symbols-outlined">campaign</span>
              <div className="ann-shell__empty-title">{t('studentAnnouncements.selectToRead')}</div>
              <div className="ann-shell__empty-sub">{t('studentAnnouncements.selectToReadDesc')}</div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
