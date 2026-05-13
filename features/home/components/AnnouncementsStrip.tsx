'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from '@/hooks/useTranslation'
import { subjectTag } from '@/lib/utils'
import { SideDrawer } from '@/components/ui/SideDrawer'
import { markAnnouncementReadAction } from '@/app/(app)/anuncios/actions'

export type DashAnnouncement = {
  id: string
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  created_at: string
  teacherName: string | null
  subjectName: string | null
  subjectColor: string | null
  read: boolean
}

function relativeTime(iso: string, language: 'es' | 'en'): string {
  const created = new Date(iso)
  const diffMin = Math.floor((Date.now() - created.getTime()) / 60000)
  if (diffMin < 1) return language === 'es' ? 'Ahora' : 'Now'
  if (diffMin < 60) return `${language === 'es' ? 'Hace ' : ''}${diffMin} min`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${language === 'es' ? 'Hace ' : ''}${h} h`
  return `${language === 'es' ? 'Hace ' : ''}${Math.floor(h / 24)} d`
}

function fullTimestamp(iso: string, language: 'es' | 'en'): string {
  return new Date(iso).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function AnnouncementsStrip({ announcements }: { announcements: DashAnnouncement[] }) {
  const { t, language } = useTranslation()
  const lang = language === 'es' ? 'es' : 'en'
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const active = useMemo(
    () => announcements.find(a => a.id === openId) ?? null,
    [openId, announcements],
  )

  const unreadCount = announcements.filter(a => !a.read).length

  const handleOpen = (id: string) => {
    setOpenId(id)
    const a = announcements.find(x => x.id === id)
    if (a && !a.read) {
      startTransition(async () => {
        const r = await markAnnouncementReadAction(id)
        if (r.ok) router.refresh()
      })
    }
  }

  if (announcements.length === 0) return null

  return (
    <>
      <section className="ann-strip">
        <div className="ann-strip__head">
          <div className="ann-strip__title">
            <span className="material-symbols-outlined">campaign</span>
            {t('dashboard.announcementsHeader') || 'Anuncios'}
            <span className="ann-strip__title-count">{announcements.length}</span>
            {unreadCount > 0 && (
              <span className="ann-strip__unread">
                {(t('dashboard.announcementsUnread') || '{n} sin leer').replace('{n}', String(unreadCount))}
              </span>
            )}
          </div>
          <Link href="/anuncios" className="dash-col__more">
            {t('dashboard.viewAll') || 'Ver todo'}
            <span className="material-symbols-outlined">chevron_right</span>
          </Link>
        </div>

        <div className="ann-strip__grid">
          {announcements.map(a => {
            const tag = subjectTag(a.subjectColor ?? undefined)
            const teacherName = a.teacherName || (language === 'es' ? 'Profesor' : 'Teacher')
            const initials = teacherName
              .split(' ')
              .slice(0, 2)
              .map(n => n[0])
              .join('')
              .toUpperCase()
            const subjectColor = a.subjectColor || 'var(--color-primary)'
            const subjCode = (a.subjectName || '').slice(0, 4).toUpperCase()
            const preview = a.content || a.title

            return (
              <button
                key={a.id}
                type="button"
                className={`ann ${tag}`}
                onClick={() => handleOpen(a.id)}
                aria-label={a.title}
              >
                <span
                  className="ann__avatar"
                  style={{ background: `color-mix(in srgb, ${subjectColor} 35%, var(--color-primary))` }}
                >
                  {initials || '·'}
                </span>
                <span className="ann__head">
                  <span className="ann__name">{teacherName}</span>
                  {subjCode && <span className="ann__chip">{subjCode}</span>}
                </span>
                <span className="ann__time">{relativeTime(a.created_at, lang)}</span>
                <span className="ann__text">{preview}</span>
              </button>
            )
          })}
        </div>
      </section>

      <SideDrawer
        open={active !== null}
        onClose={() => setOpenId(null)}
        kicker={active?.subjectName ?? t('homeDrawer.announcementKicker')}
        title={active?.title ?? ''}
      >
        {active && (
          <>
            <div className="home-drawer__meta">
              <dt>{t('homeDrawer.priority')}</dt>
              <dd>
                <span
                  className={`home-drawer__badge home-drawer__badge--${active.priority === 'urgent' ? 'urgent' : 'normal'}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {active.priority === 'urgent' ? 'priority_high' : 'campaign'}
                  </span>
                  {active.priority === 'urgent' ? t('homeDrawer.urgent') : t('homeDrawer.normal')}
                </span>
              </dd>
              <dt>{t('homeDrawer.professor')}</dt>
              <dd>{active.teacherName ?? '—'}</dd>
              <dt>{language === 'es' ? 'Publicado' : 'Posted'}</dt>
              <dd>{fullTimestamp(active.created_at, lang)}</dd>
            </div>

            {active.content && (
              <div className="home-drawer__body-text">
                <ReactMarkdown>{active.content}</ReactMarkdown>
              </div>
            )}

            <div className="home-drawer__actions">
              <Link href="/anuncios" className="home-drawer__btn home-drawer__btn--primary">
                <span className="material-symbols-outlined">campaign</span>
                {t('homeDrawer.viewInAnnouncements')}
              </Link>
            </div>
          </>
        )}
      </SideDrawer>
    </>
  )
}
