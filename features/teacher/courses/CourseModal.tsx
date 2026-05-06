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
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="kicker" style={{ color }}>Nuevo</span>
            <h2 className="text-[22px] font-bold mt-1" style={{ color: 'var(--on-surface)', letterSpacing: '-0.02em' }}>
              <span className="serif">{t('teacher.courses.add').toLowerCase()}</span>
            </h2>
          </div>
          <button onClick={onClose} className="btn btn-icon btn-ghost" aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
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
              {SUBJECT_COLORS.map((c) => {
                const active = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                    style={{
                      backgroundColor: c,
                      boxShadow: active ? `0 0 0 2px var(--s-base), 0 0 0 4px ${c}` : 'none',
                    }}
                    aria-label={`Color ${c}`}
                    aria-pressed={active}
                  >
                    {active && (
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'white', fontVariationSettings: "'FILL' 1" }}>
                        check
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-1"
              style={{ background: color, color: 'white', borderColor: color }}>
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
