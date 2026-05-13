'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { getInitials } from '@/lib/utils'
import { accentClass, gradeClass } from '@/lib/accent'
import { dayLabel } from '@/features/teacher/lib/courseStats'
import { fileIcon, formatBytes } from '@/lib/mime'
import { CourseCodeBlock } from './CourseCodeBlock'
import { CourseModal } from './CourseModal'
import { deleteCourseAction } from '@/app/(teacher)/teacher/courses/actions'
import { toast } from 'sonner'
import type { Course } from '@/types'

export type CourseOverviewStudent = {
  id: string
  full_name: string
  avatar_url: string | null
  average: number | null
}

export type CourseOverviewSchedule = {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

export type CourseOverviewAnnouncement = {
  id: string
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  created_at: string
}

export type CourseOverviewDocument = {
  id: string
  title: string
  file_type: string | null
  size_bytes: number | null
  created_at: string
}

interface Props {
  course: Course
  totals: {
    students: number
    average: number | null
    pass_rate: number | null
    pending_review: number
  }
  schedules: CourseOverviewSchedule[]
  topStudents: CourseOverviewStudent[]
  latestAnnouncement: CourseOverviewAnnouncement | null
  topDocuments: CourseOverviewDocument[]
}

export function CourseOverview({ course, totals, schedules, topStudents, latestAnnouncement, topDocuments }: Props) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const acc = accentClass(course.accent)

  const onDelete = async () => {
    if (!confirm('¿Eliminar este curso? Se borrarán todos sus exámenes, anuncios y documentos asociados.')) return
    const r = await deleteCourseAction(course.id)
    if (r.ok) { toast.success('Curso eliminado'); router.push('/teacher/courses') }
    else toast.error(r.error ?? t('teacher.common.error'))
  }

  return (
    <div className={`t-screen ${acc}`}>
      <Link href="/teacher/courses" className="t-section-head__link" style={{ marginBottom: 14, display: 'inline-flex' }}>
        <span className="material-symbols-outlined">arrow_back</span>
        {t('teacher.courses.title')}
      </Link>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 6, marginBottom: 22 }}>
        <span className="t-hero__kicker">
          CURSO · {totals.students} {totals.students === 1 ? 'estudiante' : 'estudiantes'}
          {course.semester ? ` · ${course.semester}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="t-course-card__icon" style={{ width: 64, height: 64, borderRadius: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>{course.icon || 'menu_book'}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 42, color: 'var(--on-surface)', lineHeight: 1.05, letterSpacing: '-0.015em' }}>
            {course.name}
          </h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="t-btn-line" onClick={() => setEditOpen(true)} aria-label="Editar curso">
              <span className="material-symbols-outlined">edit</span>
              Editar
            </button>
            <button type="button" className="t-btn-line" onClick={onDelete} aria-label="Eliminar curso" style={{ color: 'var(--danger)' }}>
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
      </header>

      <CourseCodeBlock courseId={course.id} code={course.access_code} />

      <section className="t-stat-strip" style={{ marginTop: 22 }} aria-label="Resumen del curso">
        <div className="t-stat-strip__cell">
          <span className="t-stat-strip__label">Promedio</span>
          <span className={`t-stat-strip__value ${totals.average != null ? gradeClass(totals.average) : ''}`}>
            {totals.average != null ? totals.average.toFixed(1) : '—'}
          </span>
        </div>
        <div className="t-stat-strip__cell">
          <span className="t-stat-strip__label">Aprobación</span>
          <span className="t-stat-strip__value">{totals.pass_rate != null ? `${Math.round(totals.pass_rate)}%` : '—'}</span>
        </div>
        <div className="t-stat-strip__cell">
          <span className="t-stat-strip__label">Entregas</span>
          <span className="t-stat-strip__value">{totals.pending_review}</span>
        </div>
        <div className="t-stat-strip__cell">
          <span className="t-stat-strip__label">Asistencia</span>
          <span className="t-stat-strip__value">—</span>
        </div>
      </section>

      <section className="t-grid-2" style={{ marginTop: 28 }}>
        <div>
          <header className="t-section-head" style={{ marginTop: 0 }}>
            <div className="t-section-head__left">
              <span className="t-section-head__kicker">Horarios</span>
              <h2 className="t-section-head__title">Cuándo se reúnen</h2>
            </div>
          </header>
          <div className="t-card" style={{ padding: 8 }}>
            {schedules.length === 0 ? (
              <Empty icon="schedule" label="Sin horarios configurados" />
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {schedules.map((s) => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-outline)' }}>schedule</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'var(--on-surface)' }}>{dayLabel(s.day_of_week, language as 'es' | 'en')}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-outline)', textTransform: 'uppercase', marginTop: 2 }}>
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <header className="t-section-head">
            <div className="t-section-head__left">
              <span className="t-section-head__kicker">Inscritos</span>
              <h2 className="t-section-head__title">{t('teacher.students.title')}</h2>
            </div>
            <Link href={`/teacher/students?course=${course.id}`} className="t-section-head__link">
              {t('teacher.common.seeAll')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </header>
          <div className="t-card" style={{ padding: 8 }}>
            {topStudents.length === 0 ? (
              <Empty icon="group" label={t('teacher.students.noStudents')} />
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {topStudents.map((s) => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--accent-bg, color-mix(in srgb, var(--color-primary) 12%, transparent))', color: 'var(--accent-color, var(--color-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                      {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 999, objectFit: 'cover' }} /> : getInitials(s.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.full_name}
                    </div>
                    <div className={`${gradeClass(s.average)}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
                      {s.average != null ? s.average.toFixed(1) : '—'}
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
              <span className="t-section-head__kicker">Último</span>
              <h2 className="t-section-head__title">Anuncio</h2>
            </div>
            <Link href={`/teacher/announcements?course=${course.id}`} className="t-section-head__link">
              {t('teacher.common.seeAll')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </header>
          <div className="t-card t-card--accent">
            {!latestAnnouncement ? (
              <Empty icon="campaign" label={t('teacher.announcements.noAnnouncements')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  {latestAnnouncement.priority === 'urgent' && <span className="t-tag" style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 14%, transparent)' }}>Urgente</span>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--color-outline)', textTransform: 'uppercase', marginLeft: 'auto' }}>
                    {new Date(latestAnnouncement.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--on-surface)' }}>{latestAnnouncement.title}</div>
                {latestAnnouncement.content && (
                  <div style={{ fontSize: 13.5, color: 'var(--on-surface-variant)', whiteSpace: 'pre-wrap' }}>{latestAnnouncement.content}</div>
                )}
              </div>
            )}
          </div>

          <header className="t-section-head">
            <div className="t-section-head__left">
              <span className="t-section-head__kicker">Material</span>
              <h2 className="t-section-head__title">{t('teacher.documents.title')}</h2>
            </div>
            <Link href={`/teacher/documents?course=${course.id}`} className="t-section-head__link">
              {t('teacher.common.seeAll')}
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </header>
          <div className="t-card" style={{ padding: 8 }}>
            {topDocuments.length === 0 ? (
              <Empty icon="folder_open" label={t('teacher.documents.noDocuments')} />
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {topDocuments.map((d) => {
                  const { icon, label } = fileIcon(d.file_type, d.title)
                  return (
                    <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--accent-color, var(--color-primary))' }}>{icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--color-outline)', textTransform: 'uppercase', marginTop: 2 }}>
                          {label} · {formatBytes(d.size_bytes)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <CourseModal open={editOpen} course={course} onClose={() => setEditOpen(false)} />
    </div>
  )
}

function Empty({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--color-outline)' }}>{icon}</span>
      <div style={{ marginTop: 6, fontSize: 13.5 }}>{label}</div>
    </div>
  )
}
