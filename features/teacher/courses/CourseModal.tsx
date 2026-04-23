'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { generateAccessCode } from './utils'
import { SUBJECT_COLORS } from '@/types'

interface CourseModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  teacherId: string
}

export function CourseModal({ open, onClose, onSaved, teacherId }: CourseModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SUBJECT_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setName('')
      setColor(SUBJECT_COLORS[0])
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError(t('auth.errors.required')); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const access_code = generateAccessCode(name)

    const { error: dbError } = await supabase.from('subjects').insert({
      name: name.trim(),
      color,
      teacher_id: teacherId,
      access_code,
      user_id: teacherId,
    })

    if (dbError) {
      // Access code collision — retry with new code
      if (dbError.code === '23505') {
        const retryCode = generateAccessCode(name + Math.random())
        const { error: retryError } = await supabase.from('subjects').insert({
          name: name.trim(),
          color,
          teacher_id: teacherId,
          access_code: retryCode,
          user_id: teacherId,
        })
        if (retryError) { setError(retryError.message); setLoading(false); return }
      } else {
        setError(dbError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--on-surface)' }}>
            {t('teacher.courses.add')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('teacher.courses.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Ej. Cálculo I"
              autoFocus
            />
          </div>

          <div>
            <label className="label">{t('subjects.color')}</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `3px solid ${c}` : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
