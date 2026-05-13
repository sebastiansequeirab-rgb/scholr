'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { SideDrawer } from '@/components/ui/SideDrawer'
import type { Subject, Schedule } from '@/types'

type AgendaItem = {
  id: string
  subject: Subject
  schedule: Schedule
  startHHMM: string
  endHHMM: string
}

function currentTimeStr(): string {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:00`
}

function subjectCode(name: string): string {
  return name.slice(0, 6).toUpperCase()
}

export function AgendaList({
  schedules,
  subjects,
}: {
  schedules: Schedule[]
  subjects: Subject[]
}) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState<string>(() => currentTimeStr())

  useEffect(() => {
    const id = setInterval(() => setNow(currentTimeStr()), 60_000)
    return () => clearInterval(id)
  }, [])

  const items: AgendaItem[] = useMemo(() => {
    return schedules
      .map(s => {
        const subject = subjects.find(sub => sub.id === s.subject_id)
        if (!subject) return null
        return {
          id: s.id,
          subject,
          schedule: s,
          startHHMM: s.start_time.slice(0, 5),
          endHHMM: s.end_time.slice(0, 5),
        }
      })
      .filter((x): x is AgendaItem => x !== null)
  }, [schedules, subjects])

  const active = items.find(i => i.id === openId) ?? null

  const statusFor = (i: AgendaItem): 'live' | 'done' | 'upcoming' => {
    if (now >= i.schedule.start_time && now <= i.schedule.end_time) return 'live'
    if (now > i.schedule.end_time) return 'done'
    return 'upcoming'
  }

  const minsLeft = (i: AgendaItem): number => {
    const [eh, em] = i.endHHMM.split(':').map(Number)
    const [nh, nm] = now.split(':').map(Number)
    return Math.max(0, (eh * 60 + em) - (nh * 60 + nm))
  }

  return (
    <>
      <div className="flex flex-col">
        {items.slice(0, 5).map(i => {
          const status = statusFor(i)
          const subjCode = subjectCode(i.subject.name)
          const room = i.schedule.room || i.subject.room || ''
          const prof = i.subject.professor || ''
          const meta = [subjCode, room, prof].filter(Boolean).join(' · ')

          return (
            <button
              type="button"
              key={i.id}
              className="agenda-item"
              style={{ ['--accent-color' as never]: i.subject.color }}
              onClick={() => setOpenId(i.id)}
              aria-label={i.subject.name}
            >
              <div className="agenda-item__time">
                <strong>{i.startHHMM}</strong>
                {i.endHHMM}
              </div>
              <div className="agenda-item__bar" />
              <div className="agenda-item__body">
                <div className="agenda-item__title">{i.subject.name}</div>
                {meta && <div className="agenda-item__meta">{meta}</div>}
                {status === 'done' && (
                  <div className="agenda-item__status agenda-item__status--done">
                    <span className="material-symbols-outlined">check_circle</span>
                    {t('dashboard.completed') || 'Completada'}
                  </div>
                )}
                {status === 'live' && (
                  <div className="agenda-item__status agenda-item__status--live">
                    <span className="live-pulse" />
                    {t('dashboard.liveNow') || 'EN VIVO'} ·{' '}
                    {(t('dashboard.liveMinsLeft') || 'faltan {n} min').replace('{n}', String(minsLeft(i)))}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <SideDrawer
        open={active !== null}
        onClose={() => setOpenId(null)}
        kicker={active ? subjectCode(active.subject.name) : t('homeDrawer.agendaKicker')}
        title={active?.subject.name ?? ''}
      >
        {active && (() => {
          const status = statusFor(active)
          const room = active.schedule.room || active.subject.room || '—'
          const prof = active.subject.professor || '—'

          return (
            <>
              <div className="home-drawer__meta">
                <dt>{t('homeDrawer.schedule')}</dt>
                <dd>{active.startHHMM} – {active.endHHMM}</dd>
                <dt>{t('homeDrawer.room')}</dt>
                <dd>{room}</dd>
                <dt>{t('homeDrawer.professor')}</dt>
                <dd>{prof}</dd>
                <dt>{t('homeDrawer.status')}</dt>
                <dd>
                  {status === 'live' && (
                    <span className="home-drawer__badge home-drawer__badge--live">
                      <span className="live-pulse" />
                      {t('homeDrawer.live')} · {t('homeDrawer.minsLeft').replace('{n}', String(minsLeft(active)))}
                    </span>
                  )}
                  {status === 'done' && (
                    <span className="home-drawer__badge home-drawer__badge--done">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                      {t('homeDrawer.completed')}
                    </span>
                  )}
                  {status === 'upcoming' && (
                    <span className="home-drawer__badge home-drawer__badge--normal">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                      {t('homeDrawer.upcoming')}
                    </span>
                  )}
                </dd>
              </div>

              <div className="home-drawer__actions">
                <Link href="/calendar?view=day" className="home-drawer__btn home-drawer__btn--primary">
                  <span className="material-symbols-outlined">calendar_today</span>
                  {t('homeDrawer.viewInCalendar')}
                </Link>
              </div>
            </>
          )
        })()}
      </SideDrawer>
    </>
  )
}
