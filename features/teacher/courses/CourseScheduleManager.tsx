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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href={`/teacher/courses/${courseId}`}
        className="flex items-center gap-1.5 text-sm font-medium hover:underline"
        style={{ color: 'var(--color-outline)' }}
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        {courseName}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.schedules.title')}
        </h1>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-semibold"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
            color: 'var(--color-primary)',
          }}>
          <span className="material-symbols-outlined text-[14px]">info</span>
          {t('teacher.schedules.propagatedNote')}
        </div>
      </div>

      {/* Existing schedules */}
      {schedules.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="material-symbols-outlined text-5xl mb-3 block"
            style={{ color: 'var(--color-outline)', fontVariationSettings: "'FILL' 0" }}>
            calendar_month
          </span>
          <p className="font-semibold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.schedules.noSchedules')}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            {t('teacher.schedules.noSchedulesDesc')}
          </p>
        </div>
      ) : (
        <div className="card divide-y">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${courseColor} 12%, transparent)` }}>
                <span className="material-symbols-outlined text-[18px]"
                  style={{ color: courseColor, fontVariationSettings: "'FILL' 1" }}>
                  schedule
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>
                  {t(`subjects.days.${s.day_of_week}`)}
                </p>
                <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--on-surface-variant)' }}>
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                  {s.room && <span style={{ color: 'var(--color-outline)' }}> · {s.room}</span>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deleting === s.id}
                className="p-2 rounded-lg transition-colors hover:text-red-400"
                style={{ color: 'var(--color-outline)' }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {deleting === s.id ? 'hourglass_empty' : 'delete'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="card p-5 space-y-4">
        <h2 className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
          {t('teacher.schedules.addSchedule')}
        </h2>

        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="input w-full"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>{t(`subjects.days.${d}`)}</option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{t('subjects.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">{t('subjects.endTime')}</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input"
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
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">
            {error}
          </p>
        )}

        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">
            {adding ? 'hourglass_empty' : 'add'}
          </span>
          {adding ? t('common.loading') : t('teacher.schedules.addSchedule')}
        </button>
      </div>
    </div>
  )
}
