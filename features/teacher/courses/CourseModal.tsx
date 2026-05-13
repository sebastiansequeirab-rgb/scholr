'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { COURSE_ACCENTS, type CourseAccent, type Course } from '@/types'
import { accentClass } from '@/lib/accent'
import { COURSE_ICONS } from './courseIcons'
import { createCourseAction, updateCourseAction, type CourseFormState } from '@/app/(teacher)/teacher/courses/actions'

interface CourseModalProps {
  open: boolean
  onClose: () => void
  course?: Course | null
}

const initialState: CourseFormState = {}

export function CourseModal({ open, onClose, course }: CourseModalProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const editing = !!course
  const [name, setName] = useState('')
  const [semester, setSemester] = useState('')
  const [credits, setCredits] = useState(0)
  const [accent, setAccent] = useState<CourseAccent>('blue')
  const [icon, setIcon] = useState<string>('menu_book')
  const [state, setState] = useState<CourseFormState>(initialState)
  const [pending, start] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setName(course?.name ?? '')
    setSemester(course?.semester ?? '')
    setCredits(course?.credits ?? 0)
    setAccent((course?.accent as CourseAccent) ?? 'blue')
    setIcon(course?.icon ?? 'menu_book')
    setState(initialState)
    setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus(), 50)
  }, [open, course])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      const result = editing
        ? await updateCourseAction(course!.id, state, fd)
        : await createCourseAction(state, fd)
      setState(result)
      if (result.ok) {
        toast.success(editing ? t('teacher.common.saved') : `${t('teacher.common.newCourse')} ✓`)
        if (!editing && result.id) {
          onClose()
          router.push(`/teacher/courses/${result.id}`)
        } else {
          onClose()
          router.refresh()
        }
      } else {
        toast.error(result.error ?? t('teacher.common.error'))
      }
    })
  }

  const title = editing ? t('teacher.courses.edit') : t('teacher.courses.add')

  return (
    <div className="t-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={dialogRef} className={`t-modal ${accentClass(accent)}`} role="dialog" aria-modal="true" aria-labelledby="course-modal-title">
        <header className="t-modal__head">
          <h3 id="course-modal-title">{title}</h3>
          <button type="button" onClick={onClose} className="t-btn-line" aria-label={t('teacher.common.cancel')}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <form onSubmit={onSubmit} className="t-modal__body">
          <div className="t-field">
            <label htmlFor="course-name">{t('teacher.courses.name')}</label>
            <input id="course-name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="Cálculo I" />
            {state.fieldErrors?.name && <span className="t-field__error">{state.fieldErrors.name}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <div className="t-field">
              <label htmlFor="course-semester">Semestre</label>
              <input id="course-semester" name="semester" type="text" value={semester} onChange={(e) => setSemester(e.target.value)} maxLength={40} placeholder="2026-1" />
            </div>
            <div className="t-field">
              <label htmlFor="course-credits">Créditos</label>
              <input id="course-credits" name="credits" type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} min={0} max={20} />
            </div>
          </div>

          <div className="t-field">
            <label>Color de acento</label>
            <div className="t-swatches" role="radiogroup" aria-label="Color de acento">
              {COURSE_ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`t-swatch acc-${a} ${accent === a ? 'is-active' : ''}`}
                  onClick={() => setAccent(a)}
                  role="radio"
                  aria-checked={accent === a}
                  aria-label={a}
                />
              ))}
            </div>
            <input type="hidden" name="accent" value={accent} />
          </div>

          <div className="t-field">
            <label>Icono</label>
            <div className="t-icon-picker" role="radiogroup" aria-label="Icono">
              {COURSE_ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`t-icon-picker__btn ${icon === i ? 'is-active' : ''}`}
                  onClick={() => setIcon(i)}
                  role="radio"
                  aria-checked={icon === i}
                  aria-label={i}
                >
                  <span className="material-symbols-outlined">{i}</span>
                </button>
              ))}
            </div>
            <input type="hidden" name="icon" value={icon} />
          </div>

          {state.error && !state.fieldErrors && <p className="t-field__error">{state.error}</p>}

          <footer style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="t-btn-line">{t('teacher.common.cancel')}</button>
            <button type="submit" disabled={pending} className="t-btn-new">
              <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'check'}</span>
              {pending ? t('teacher.common.loading') : t('teacher.common.save')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
