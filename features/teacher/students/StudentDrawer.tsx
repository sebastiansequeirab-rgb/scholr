'use client'

import { useEffect } from 'react'
import { getInitials } from '@/lib/utils'
import { gradeClass, accentClass } from '@/lib/accent'
import { useTranslation } from '@/hooks/useTranslation'

export type DrawerStudent = {
  id: string
  full_name: string
  avatar_url: string | null
  course_id: string
  course_name: string
  course_accent: string | null
  average: number | null
  grades: { exam_title: string; percentage: number | null; grade: number | null }[]
  submissions: { id: string; status: string; submitted_at: string }[]
}

export function StudentDrawer({ student, onClose }: { student: DrawerStudent | null; onClose: () => void }) {
  const { t, language } = useTranslation()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!student) return null

  return (
    <>
      <div className="t-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className={`t-drawer ${accentClass(student.course_accent)}`} role="dialog" aria-modal="true" aria-labelledby="student-drawer-name">
        <header className="t-drawer__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--accent-bg, color-mix(in srgb, var(--color-primary) 12%, transparent))', color: 'var(--accent-color, var(--color-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
              {student.avatar_url ? <img src={student.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: 999, objectFit: 'cover' }} /> : getInitials(student.full_name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div id="student-drawer-name" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--on-surface)' }}>{student.full_name}</div>
              <div className="t-tag" style={{ marginTop: 2 }}>{student.course_name}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="t-btn-line" aria-label={t('teacher.common.cancel')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="t-drawer__body">
          <section style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            <div className="t-kpi" style={{ flex: 1 }}>
              <span className="t-kpi__label">Promedio</span>
              <span className={`t-kpi__value ${student.average != null ? gradeClass(student.average) : ''}`}>
                {student.average != null ? student.average.toFixed(1) : '—'}
              </span>
            </div>
            <div className="t-kpi" style={{ flex: 1 }}>
              <span className="t-kpi__label">Entregas</span>
              <span className="t-kpi__value">{student.submissions.length}</span>
            </div>
          </section>

          <section style={{ marginBottom: 18 }}>
            <span className="t-section-head__kicker">Calificaciones</span>
            {student.grades.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 6 }}>Sin componentes evaluados todavía.</div>
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0' }}>
                {student.grades.map((g, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                    <div>
                      <div style={{ fontSize: 14 }}>{g.exam_title}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{g.percentage ?? 0}%</div>
                    </div>
                    <div className={g.grade != null ? gradeClass(g.grade) : 'grade-pending'} style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600 }}>
                      {g.grade != null ? g.grade.toFixed(1) : '—'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={{ marginBottom: 18 }}>
            <span className="t-section-head__kicker">Entregas</span>
            {student.submissions.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 6 }}>Sin entregas registradas.</div>
            ) : (
              <ul className="t-list-divider" style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0' }}>
                {student.submissions.map(s => (
                  <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0' }}>
                    <div style={{ fontSize: 13.5 }}>
                      <span className="t-tag" style={{ background: s.status === 'pending_review' ? 'color-mix(in srgb, var(--warning) 14%, transparent)' : 'var(--accent-bg)', color: s.status === 'pending_review' ? 'var(--warning)' : 'var(--accent-color)' }}>{s.status}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                      {new Date(s.submitted_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <span className="t-section-head__kicker">Asistencia</span>
            <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 6 }}>
              Próximamente.
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}
