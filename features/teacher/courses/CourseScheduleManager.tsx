'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'

interface Schedule {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

interface CourseScheduleManagerProps {
  courseId: string
  courseName: string
  courseColor: string
  initialSchedules: Schedule[]
}

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const

export function CourseScheduleManager({
  courseId,
  courseName,
  courseColor,
  initialSchedules,
}: CourseScheduleManagerProps) {
  const { t } = useTranslation()
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [day, setDay] = useState<number>(1)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:30')
  const [room, setRoom] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!startTime || !endTime || startTime >= endTime) {
      setError(t('teacher.schedules.invalidTime'))
      return
    }
    setAdding(true)
    setError('')
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_of_week: day, start_time: startTime, end_time: endTime, room: room.trim() || null }),
      })
      const data = await res.json() as { schedule?: Schedule; error?: string }
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      if (data.schedule) {
        setSchedules(prev => [...prev, data.schedule!].sort((a, b) =>
          a.day_of_week !== b.day_of_week
            ? a.day_of_week - b.day_of_week
            : a.start_time.localeCompare(b.start_time)
        ))
      }
      setRoom('')
    } catch {
      setError(t('teacher.schedules.errorSaving'))
    } finally {
      setAdding(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/sync-schedules`, { method: 'POST' })
      const data = await res.json() as { synced?: number; error?: string }
      if (res.ok) {
        setSyncMsg(t('teacher.schedules.syncDone').replace('{n}', String(data.synced ?? 0)))
      } else {
        setSyncMsg(data.error ?? 'Error')
      }
    } catch {
      setSyncMsg(t('teacher.schedules.errorSaving'))
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  const handleDelete = async (scheduleId: string) => {
    setDeleting(scheduleId)
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/schedules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      })
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId))
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto reveal-stagger">
      <Link
        href={`/teacher/courses/${courseId}`}
        className="kicker inline-flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity"
      >
        <span className="material-symbols-outlined text-[14px]">arrow_back</span>
        {courseName}
      </Link>

      <header className="screen-head">
        <div className="screen-head__left">
          <span className="kicker" style={{ color: courseColor }}>Curso · {schedules.length} {schedules.length === 1 ? 'franja' : 'franjas'}</span>
          <h1 className="screen-head__title">
            <span className="serif">{t('teacher.schedules.title').toLowerCase()}</span>
          </h1>
          <p className="screen-head__sub">
            {t('teacher.schedules.propagatedNote')}
          </p>
        </div>
        <div className="screen-head__actions">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-secondary"
            title={t('teacher.schedules.syncTitle')}
          >
            <span className="material-symbols-outlined">
              {syncing ? 'hourglass_empty' : 'sync'}
            </span>
            {syncing ? t('common.loading') : t('teacher.schedules.sync')}
          </button>
        </div>
      </header>

      {syncMsg && (
        <div className="card mb-4" style={{
          background: 'color-mix(in srgb, var(--success) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--success) 30%, var(--border-subtle))',
          color: 'var(--success)',
        }}>
          <p className="text-xs font-medium">{syncMsg}</p>
        </div>
      )}

      {/* Existing schedules */}
      {schedules.length === 0 ? (
        <div className="card p-10 text-center mb-4">
          <span className="material-symbols-outlined text-4xl mb-2 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            calendar_month
          </span>
          <p className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.schedules.noSchedules')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.schedules.noSchedulesDesc')}
          </p>
        </div>
      ) : (
        <div className="card mb-4" style={{ padding: 6 }}>
          {schedules.map((s) => (
            <div key={s.id} className="row" style={{ ['--accent-color' as string]: courseColor }}>
              <div className="row__time flex items-center justify-center">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${courseColor} 14%, transparent)` }}>
                  <span className="material-symbols-outlined text-[16px]"
                    style={{ color: courseColor, fontVariationSettings: "'FILL' 1" }}>
                    schedule
                  </span>
                </div>
              </div>
              <div className="row__main">
                <div className="row__title" style={{ color: courseColor }}>
                  {t(`subjects.days.${s.day_of_week}`)}
                </div>
                <div className="row__meta font-mono tabular">
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  {s.room && <span style={{ color: 'var(--color-outline)' }}> · {s.room}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deleting === s.id}
                className="btn btn-icon btn-ghost"
                aria-label={t('common.delete')}
              >
                <span className="material-symbols-outlined">
                  {deleting === s.id ? 'hourglass_empty' : 'delete'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="card p-5 space-y-4">
        <div>
          <span className="kicker">Nueva franja</span>
          <h2 className="text-[18px] font-bold mt-0.5" style={{ color: 'var(--on-surface)', letterSpacing: '-0.015em' }}>
            <span className="serif">{t('teacher.schedules.addSchedule').toLowerCase()}</span>
          </h2>
        </div>

        <div>
          <label className="label">Día</label>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="input w-full"
          >
            {DAYS.map((d) => (
              <option key={d} value={d}>{t(`subjects.days.${d}`)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{t('subjects.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input tabular"
            />
          </div>
          <div>
            <label className="label">{t('subjects.endTime')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input tabular"
            />
          </div>
          <div>
            <label className="label">{t('subjects.scheduleRoom')}</label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="input"
              placeholder="Salón 301"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn btn-primary w-full"
        >
          <span className="material-symbols-outlined">
            {adding ? 'hourglass_empty' : 'add'}
          </span>
          {adding ? t('common.loading') : t('teacher.schedules.addSchedule')}
        </button>
      </div>
    </div>
  )
}
