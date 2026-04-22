'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { SUBJECT_COLORS } from '@/types'
import { IconPicker } from '@/features/subjects/components/IconPicker'
import type { Subject, Schedule } from '@/types'
import { getSubjectIcon } from '@/features/subjects/utils'

interface SubjectModalProps {
  subject?: Subject | null
  onClose: () => void
  onSaved: () => void
}

export function SubjectModal({ subject, onClose, onSaved }: SubjectModalProps) {
  const { t } = useTranslation()
  const isEditing = !!subject

  const [name, setName] = useState(subject?.name || '')
  const [professor, setProfessor] = useState(subject?.professor || '')
  const [room, setRoom] = useState(subject?.room || '')
  const [credits, setCredits] = useState(subject?.credits?.toString() || '')
  const [color, setColor] = useState(subject?.color || SUBJECT_COLORS[0])
  const [icon, setIcon] = useState<string | null>(subject?.icon || null)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const previewIcon = icon || getSubjectIcon(name || 'menu_book')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError(t('auth.errors.required')); return }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      user_id: user.id,
      name: name.trim(),
      professor: professor.trim() || null,
      room: room.trim() || null,
      credits: credits ? parseInt(credits) : null,
      color,
      icon: icon || null,
    }

    const { error: dbError } = isEditing
      ? await supabase.from('subjects').update(payload).eq('id', subject!.id)
      : await supabase.from('subjects').insert(payload)

    if (dbError) { setError(dbError.message); setLoading(false); return }
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--on-surface)' }}>
          {isEditing ? t('subjects.edit') : t('subjects.add')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon + Name row */}
          <div className="flex items-end gap-3">
            {/* Icon selector */}
            <div className="relative flex-shrink-0">
              <label className="label block mb-1">{t('subjects.icon') || 'Ícono'}</label>
              <button
                type="button"
                onClick={() => setIconPickerOpen(!iconPickerOpen)}
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:brightness-125 hover:scale-105"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, border: `1.5px solid color-mix(in srgb, ${color} 30%, transparent)` }}
                title="Cambiar ícono"
              >
                <span className="material-symbols-outlined text-2xl" style={{ color }}>
                  {previewIcon}
                </span>
              </button>
              {iconPickerOpen && (
                <IconPicker
                  currentIcon={previewIcon}
                  subjectColor={color}
                  onSelect={(ic) => { setIcon(ic); setIconPickerOpen(false) }}
                  onClose={() => setIconPickerOpen(false)}
                />
              )}
            </div>

            {/* Name */}
            <div className="flex-1">
              <label htmlFor="subjectName" className="label">{t('subjects.name')} *</label>
              <input
                id="subjectName"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
              />
            </div>
          </div>

          {/* Professor */}
          <div>
            <label htmlFor="professor" className="label">{t('subjects.professor')}</label>
            <input
              id="professor"
              className="input"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Room */}
            <div>
              <label htmlFor="room" className="label">{t('subjects.room')}</label>
              <input
                id="room"
                className="input"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
            </div>

            {/* Credits */}
            <div>
              <label htmlFor="credits" className="label">{t('subjects.credits')}</label>
              <input
                id="credits"
                type="number"
                min="1"
                max="10"
                className="input"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <span className="label">{t('subjects.color')}</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {t('subjects.cancel')}
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? t('common.loading') : t('subjects.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Schedule Manager ─── */
interface ScheduleManagerProps {
  subject: Subject
  schedules: Schedule[]
  onUpdated: () => void
}

const DAYS = [1, 2, 3, 4, 5, 6, 0]

export function ScheduleManager({ subject, schedules, onUpdated }: ScheduleManagerProps) {
  const { t } = useTranslation()
  const [day, setDay] = useState<number>(1)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:30')
  const [slotRoom, setSlotRoom] = useState('')
  const [conflict, setConflict] = useState(false)
  const [loadingAdd, setLoadingAdd] = useState(false)

  const checkConflict = (newDay: number, newStart: string, newEnd: string) => {
    return schedules.some(
      (s) =>
        s.day_of_week === newDay &&
        s.subject_id !== subject.id &&
        newStart < s.end_time &&
        newEnd > s.start_time
    )
  }

  const handleAdd = async () => {
    if (!startTime || !endTime || startTime >= endTime) return
    if (checkConflict(day, startTime, endTime)) {
      setConflict(true)
      return
    }
    setConflict(false)
    setLoadingAdd(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('schedules').insert({
      user_id: user.id,
      subject_id: subject.id,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      room: slotRoom.trim() || null,
    })
    setSlotRoom('')
    setLoadingAdd(false)
    onUpdated()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('schedules').delete().eq('id', id)
    onUpdated()
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-muted)' }}>
        {t('subjects.schedules')}
      </h3>

      {/* Existing schedules */}
      <div className="space-y-2">
        {schedules.map((s) => (
          <div key={s.id} className="flex items-center justify-between text-sm rounded-xl px-3 py-2.5"
            style={{ backgroundColor: 'var(--s-base)' }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
              <span className="font-semibold text-xs" style={{ color: subject.color }}>{t(`subjects.days.${s.day_of_week}`)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="mono text-xs" style={{ color: 'var(--on-surface)' }}>{s.start_time} – {s.end_time}</span>
              {s.room && (
                <span className="mono text-[10px]" style={{ color: 'var(--color-outline)' }}>{s.room}</span>
              )}
            </div>
            <button onClick={() => handleDelete(s.id)} className="p-1 rounded-lg hover:bg-red-400/10 text-red-400 transition-colors" aria-label="Delete schedule">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        ))}
      </div>

      {/* Add new — row 1: day */}
      <div className="space-y-2">
        <select
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="input w-full"
          aria-label={t('subjects.days.1')}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>{t(`subjects.days.${d}`)}</option>
          ))}
        </select>

        {/* row 2: start | end | room */}
        <div className="grid grid-cols-3 gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input"
            aria-label={t('subjects.startTime')}
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="input"
            aria-label={t('subjects.endTime')}
          />
          <input
            type="text"
            value={slotRoom}
            onChange={(e) => setSlotRoom(e.target.value)}
            className="input"
            placeholder={t('subjects.scheduleRoom') || 'Salón'}
            aria-label="Salón"
          />
        </div>
      </div>

      {conflict && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
          ⚠️ {t('subjects.conflict')}
        </p>
      )}

      <button
        onClick={handleAdd}
        disabled={loadingAdd}
        className="btn-secondary w-full text-sm"
      >
        + {t('subjects.addSchedule')}
      </button>
    </div>
  )
}
