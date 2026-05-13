'use client'

import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { accentClass } from '@/lib/accent'
import { LiveBadge } from './LiveBadge'
import { dayLabel, type UpcomingClass } from '@/features/teacher/lib/courseStats'
import type { Profile } from '@/types'

type CourseCard = {
  id: string
  name: string
  icon: string | null
  accent: string | null
  access_code: string | null
  semester: string | null
  students: number
  average: number | null
  pending_review: number
}

type RecentAnnouncement = {
  id: string
  subject_id: string
  course_name: string
  course_accent: string | null
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  created_at: string
}

interface Props {
  profile: Profile
  courses: CourseCard[]
  upcomingClasses: UpcomingClass[]
  recentAnnouncements: RecentAnnouncement[]
  totalStudents: number
  pendingReview: number
  overallAverage: number | null
  classesToday: number
}

export function TeacherDashboard({
  profile,
  courses,
  upcomingClasses,
  recentAnnouncements,
  totalStudents,
  pendingReview,
  overallAverage,
  classesToday,
}: Props) {
  const { t, language } = useTranslation()
  const firstName = (profile.full_name || '').split(' ')[0] || 'Profe'

  const summary = t('teacher.dashboard.summary')
    .replace('{classes}', String(classesToday))
    .replace('{reviews}', String(pendingReview))

  return (
    <div className="t-screen">
      <section className="t-hero">
        <div className="t-hero__top">
          <span className="t-hero__kicker">Skolar · {t('teacher.common.kicker')}</span>
          <LiveBadge />
        </div>
        <h1 className="t-hero__title">
          {t('teacher.dashboard.greeting')}<em>{firstName}</em>.
        </h1>
        <p className="t-hero__sub">{summary}</p>
      </section>

      <section
        className="t-kpis"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}
        aria-label="KPIs"
      >
        <div className="t-kpi">
          <span className="t-kpi__label">{t('teacher.dashboard.totalCourses')}</span>
          <span className="t-kpi__value">{courses.length}</span>
        </div>
        <div className="t-kpi">
          <span className="t-kpi__label">{t('teacher.dashboard.totalStudents')}</span>
          <span className="t-kpi__value">{totalStudents}</span>
        </div>
        <div className="t-kpi t-kpi--accent">
          <span className="t-kpi__label">{t('teacher.dashboard.pendingReview')}</span>
          <span className="t-kpi__value">{pendingReview}</span>
        </div>
        <div className="t-kpi">
          <span className="t-kpi__label">{t('teacher.dashboard.overallAverage')}</span>
          <span className="t-kpi__value">{overallAverage != null ? overallAverage.toFixed(1) : '—'}</span>
        </div>
      </section>

      <section aria-labelledby="my-courses-heading">
        <header className="t-section-head">
          <div className="t-section-head__left">
            <span className="t-section-head__kicker">{t('teacher.common.kicker')}</span>
            <h2 className="t-section-head__title" id="my-courses-heading">{t('teacher.dashboard.myCourses')}</h2>
          </div>
          <Link href="/teacher/courses" className="t-section-head__link">
            {t('teacher.common.seeAll')}
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </header>

        {courses.length === 0 ? (
          <EmptyCourses />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => (
              <Link key={c.id} href={`/teacher/courses/${c.id}`} className={`t-course-row ${accentClass(c.accent)}`}>
                <div className="t-course-row__icon">
                  <span className="material-symbols-outlined">{c.icon || 'menu_book'}</span>
                </div>
                <div>
                  <div className="t-course-row__name">{c.name}</div>
                  <div className="t-course-row__meta">
                    <span>{c.students} {t('teacher.courses.students').toLowerCase()}</span>
                    {c.access_code && <span> · <code>{c.access_code}</code></span>}
                    {c.pending_review > 0 && <span> · {c.pending_review} {t('teacher.dashboard.pendingReview').toLowerCase()}</span>}
                  </div>
                </div>
                <div className="t-course-row__avg">{c.average != null ? c.average.toFixed(1) : '—'}</div>
                <span className="material-symbols-outlined t-course-row__chevron">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="t-grid-2" style={{ marginTop: 24 }}>
        <div>
          <header className="t-section-head" style={{ marginTop: 0 }}>
            <div className="t-section-head__left">
              <span className="t-section-head__kicker">Próximas</span>
              <h2 className="t-section-head__title">{t('teacher.dashboard.upcomingClasses')}</h2>
            </div>
          </header>
          <div className="t-card" style={{ padding: 8 }}>
            {upcomingClasses.length === 0 ? (
              <EmptyMini icon="event_busy" label={t('teacher.dashboard.noClasses')} />
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcomingClasses.map((s) => (
                  <li key={`${s.id}-${s.occurs_on}`} className={accentClass(s.course_accent)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 6px' }}>
                    <div style={{ width: 6, height: 36, borderRadius: 3, background: 'var(--accent-color, var(--color-primary))', flexShrink: 0 }} aria-hidden="true" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--on-surface)' }}>{s.course_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-outline)', marginTop: 2 }}>
                        {dayLabel(s.day_of_week, language as 'es' | 'en', true)} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                        {s.room ? ` · ${s.room}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <header className="t-section-head" style={{ marginTop: 0 }}>
            <div className="t-section-head__left">
              <span className="t-section-head__kicker">Recientes</span>
              <h2 className="t-section-head__title">{t('teacher.dashboard.recentAnnouncements')}</h2>
            </div>
            <Link href="/teacher/announcements" className="t-section-head__link">
              {t('teacher.common.seeAll')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </header>
          <div className="t-card" style={{ padding: 8 }}>
            {recentAnnouncements.length === 0 ? (
              <EmptyMini icon="campaign" label={t('teacher.dashboard.noAnnouncements')} />
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentAnnouncements.map((a) => (
                  <li key={a.id} className={accentClass(a.course_accent)} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 6px', borderLeft: '3px solid var(--accent-color, var(--color-primary))', paddingLeft: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="t-tag">{a.course_name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                        {new Date(a.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--on-surface)' }}>{a.title}</div>
                    {a.content && (
                      <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {a.content}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function EmptyCourses() {
  const { t } = useTranslation()
  return (
    <div className="t-empty">
      <div className="t-empty__icon"><span className="material-symbols-outlined">menu_book</span></div>
      <div className="t-empty__title">{t('teacher.dashboard.noCourses')}</div>
      <div className="t-empty__sub">{t('teacher.dashboard.createFirst')}</div>
      <Link href="/teacher/courses?new=1" className="t-btn-new">
        <span className="material-symbols-outlined">add</span>
        {t('teacher.common.newCourse')}
      </Link>
    </div>
  )
}

function EmptyMini({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-outline)' }}>{icon}</span>
      <div style={{ marginTop: 6, fontSize: 13.5 }}>{label}</div>
    </div>
  )
}
