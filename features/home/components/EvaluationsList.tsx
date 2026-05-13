'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { SideDrawer } from '@/components/ui/SideDrawer'
import type { Subject, Exam } from '@/types'

export function EvaluationsList({
  exams,
  subjects,
  todayStr,
}: {
  exams: Exam[]
  subjects: Subject[]
  todayStr: string
}) {
  const { t, language } = useTranslation()
  const lang = language === 'es' ? 'es' : 'en'
  const [openId, setOpenId] = useState<string | null>(null)

  const active = useMemo(() => exams.find(e => e.id === openId) ?? null, [openId, exams])
  const activeSubject = active ? subjects.find(s => s.id === active.subject_id) ?? null : null

  return (
    <>
      <div className="flex flex-col">
        {exams.slice(0, 4).map(exam => {
          const sub = subjects.find(s => s.id === exam.subject_id)
          const accent = sub?.color || 'var(--color-primary)'
          const subjCode = sub ? sub.name.slice(0, 4).toUpperCase() : '—'
          const date = new Date(exam.exam_date + 'T00:00:00')
          const day = date.getDate()
          const month = date
            .toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', { month: 'short' })
            .replace('.', '')
            .toUpperCase()
          const days = Math.round((date.getTime() - new Date(todayStr).getTime()) / 86400000)
          const countLabel =
            days === 0
              ? lang === 'es' ? 'HOY' : 'TODAY'
              : days === 1
                ? lang === 'es' ? 'MAÑ' : 'TMW'
                : `${days}D`
          const countTone = days < 7 ? 'urgent' : days < 14 ? 'soon' : 'later'
          const typeLabel = exam.activity_type
            ? exam.activity_type.charAt(0).toUpperCase() + exam.activity_type.slice(1)
            : ''
          const pctLabel = exam.percentage ? ` ${exam.percentage}%` : ''

          return (
            <button
              type="button"
              key={exam.id}
              className="next-item"
              style={{
                ['--accent-color' as never]: accent,
                ['--accent-bg-strong' as never]: `color-mix(in srgb, ${accent} 22%, transparent)`,
              }}
              onClick={() => setOpenId(exam.id)}
              aria-label={exam.title}
            >
              <div className="next-item__date">
                <span className="next-item__date-d">{day}</span>
                <span className="next-item__date-m">{month}</span>
              </div>
              <div className="next-item__bar" />
              <div className="next-item__body">
                <div className="next-item__title truncate">{exam.title}</div>
                <div className="next-item__meta">
                  <span className="next-item__chip-mat">{subjCode}</span>
                  {typeLabel && (
                    <span>
                      {typeLabel}
                      {pctLabel}
                    </span>
                  )}
                </div>
              </div>
              <span className={`next-item__count next-item__count--${countTone}`}>{countLabel}</span>
            </button>
          )
        })}
      </div>

      <SideDrawer
        open={active !== null}
        onClose={() => setOpenId(null)}
        kicker={activeSubject ? activeSubject.name.slice(0, 6).toUpperCase() : t('homeDrawer.examKicker')}
        title={active?.title ?? ''}
      >
        {active && (() => {
          const date = new Date(active.exam_date + 'T00:00:00')
          const fullDate = date.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })
          const days = Math.round((date.getTime() - new Date(todayStr).getTime()) / 86400000)
          const countdown =
            days === 0
              ? t('homeDrawer.today')
              : days === 1
                ? t('homeDrawer.tomorrow')
                : days > 0
                  ? t('homeDrawer.daysLeft').replace('{n}', String(days))
                  : `${Math.abs(days)} ${lang === 'es' ? 'días atrás' : 'days ago'}`

          return (
            <>
              <div className="home-drawer__meta">
                <dt>{t('homeDrawer.examDate')}</dt>
                <dd>
                  {fullDate}
                  {active.exam_time && ` · ${active.exam_time.slice(0, 5)}`}
                </dd>
                <dt>{lang === 'es' ? 'Faltan' : 'Countdown'}</dt>
                <dd>{countdown}</dd>
                {activeSubject && (
                  <>
                    <dt>{lang === 'es' ? 'Materia' : 'Subject'}</dt>
                    <dd>{activeSubject.name}</dd>
                  </>
                )}
                {active.activity_type && (
                  <>
                    <dt>{t('homeDrawer.type')}</dt>
                    <dd>{active.activity_type.charAt(0).toUpperCase() + active.activity_type.slice(1)}</dd>
                  </>
                )}
                {active.percentage != null && (
                  <>
                    <dt>{t('homeDrawer.weight')}</dt>
                    <dd>{active.percentage}%</dd>
                  </>
                )}
                <dt>{t('homeDrawer.grade')}</dt>
                <dd>
                  {active.grade != null
                    ? `${active.grade.toFixed(1)} / ${(active.max_grade ?? 20).toFixed(1)}`
                    : t('homeDrawer.noGrade')}
                </dd>
              </div>

              {active.notes && (
                <div className="home-drawer__body-text">
                  <p>{active.notes}</p>
                </div>
              )}

              <div className="home-drawer__actions">
                <Link href="/evaluaciones" className="home-drawer__btn home-drawer__btn--primary">
                  <span className="material-symbols-outlined">edit_calendar</span>
                  {t('homeDrawer.viewInExams')}
                </Link>
              </div>
            </>
          )
        })()}
      </SideDrawer>
    </>
  )
}
