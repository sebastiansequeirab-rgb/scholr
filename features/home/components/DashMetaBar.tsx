'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { SideDrawer } from '@/components/ui/SideDrawer'
import { updateSemesterProgressAction } from '@/app/(app)/dashboard/actions'

/**
 * Sub-header del dashboard con chips contextuales (reloj 24h + semana editable + promedio)
 * y alerta inline a la derecha (entrega cierra en HHh MMm).
 * El editor de semana abre el SideDrawer canónico de la plataforma.
 */
export function DashMetaBar({
  weekIndex,
  weekTotal,
  avg,
  alertDueLabel,
}: {
  weekIndex: number | null
  weekTotal: number | null
  avg: number | null
  alertDueLabel: string | null
}) {
  const { language, t } = useTranslation()
  const router = useRouter()
  const [now, setNow] = useState<Date | null>(null)
  const [editing, setEditing] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(weekIndex ?? 1)
  const [totalWeeks, setTotalWeeks] = useState(weekTotal ?? 16)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { setCurrentWeek(weekIndex ?? 1) }, [weekIndex])
  useEffect(() => { setTotalWeeks(weekTotal ?? 16) }, [weekTotal])

  const onSave = () => {
    startTransition(async () => {
      const r = await updateSemesterProgressAction({ current_week: currentWeek, semester_weeks: totalWeeks })
      if (r.ok) {
        toast.success(language === 'es' ? 'Semana actualizada' : 'Week updated')
        setEditing(false)
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error')
      }
    })
  }

  if (!now) {
    return <div className="dash-meta-bar" style={{ minHeight: 36 }} />
  }

  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  const day = now.getDate()
  const dayName = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })
  const month = now.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' }).replace('.', '')

  return (
    <>
      <div className="dash-meta-bar">
        <div className="dash-meta-bar__chips">
          <span className="dash-meta-chip">
            <span className="material-symbols-outlined">schedule</span>
            <strong>{hh}:{mm}</strong>
            <span>· {dayName} {day} {month}</span>
          </span>
          {weekIndex != null && weekTotal != null && (
            <button
              type="button"
              className="dash-meta-chip dash-meta-chip--btn"
              onClick={() => setEditing(true)}
              aria-haspopup="dialog"
              aria-expanded={editing}
              aria-label={t('homeWeek.editTitle')}
            >
              <span className="material-symbols-outlined">calendar_view_week</span>
              <span>{t('homeWeek.label')}</span>
              <strong>{weekIndex} / {weekTotal}</strong>
              <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.7 }}>edit</span>
            </button>
          )}
          {avg != null && (
            <span className="dash-meta-chip">
              <span className="material-symbols-outlined">leaderboard</span>
              <span>{language === 'es' ? 'Promedio' : 'Average'}</span>
              <strong>{avg.toFixed(1)} / 20</strong>
            </span>
          )}
        </div>
        {alertDueLabel && (
          <span className="dash-alert">
            <span className="material-symbols-outlined">flag</span>
            {alertDueLabel}
          </span>
        )}
      </div>

      <SideDrawer
        open={editing}
        onClose={() => setEditing(false)}
        kicker={t('homeWeek.kicker')}
        title={t('homeWeek.editTitle')}
      >
        <p className="home-drawer__helper">{t('homeWeek.helper')}</p>

        <div className="home-drawer__form">
          <label className="home-drawer__field">
            <span>{t('homeWeek.current')}</span>
            <input
              type="number"
              min={1}
              max={totalWeeks}
              value={currentWeek}
              onChange={e => setCurrentWeek(Math.max(1, parseInt(e.target.value || '1', 10)))}
              autoFocus
            />
          </label>
          <label className="home-drawer__field">
            <span>{t('homeWeek.total')}</span>
            <input
              type="number"
              min={1}
              max={60}
              value={totalWeeks}
              onChange={e => setTotalWeeks(Math.max(1, parseInt(e.target.value || '1', 10)))}
            />
          </label>
        </div>

        <div className="home-drawer__actions">
          <button
            type="button"
            className="home-drawer__btn"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            {t('homeWeek.cancel')}
          </button>
          <button
            type="button"
            className="home-drawer__btn home-drawer__btn--primary"
            onClick={onSave}
            disabled={pending}
          >
            {pending ? '…' : t('homeWeek.save')}
          </button>
        </div>
      </SideDrawer>
    </>
  )
}
