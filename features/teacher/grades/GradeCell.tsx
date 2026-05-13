'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { gradeClass } from '@/lib/accent'
import { updateGradeAction } from '@/app/(teacher)/teacher/grades/actions'

interface Props {
  examId: string
  studentId: string
  initialGrade: number | null
}

export function GradeCell({ examId, studentId, initialGrade }: Props) {
  const [value, setValue] = useState<string>(initialGrade == null ? '' : String(initialGrade))
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string>(initialGrade == null ? '' : String(initialGrade))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const persist = (raw: string) => {
    const trimmed = raw.trim()
    const num = trimmed === '' ? null : Number(trimmed.replace(',', '.'))
    if (num != null && (Number.isNaN(num) || num < 0 || num > 20)) {
      toast.error('La nota debe estar entre 0 y 20')
      setValue(lastSaved)
      return
    }
    setSaving(true)
    updateGradeAction({ examId, studentId, grade: num })
      .then((r) => {
        setSaving(false)
        if (r.ok) { setLastSaved(raw); return }
        toast.error(r.error ?? 'Error al guardar')
        setValue(lastSaved)
      })
      .catch(() => {
        setSaving(false)
        toast.error('Error de red')
        setValue(lastSaved)
      })
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(next), 600)
  }

  const onBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (value !== lastSaved) persist(value)
  }

  const num = value === '' ? null : Number(value.replace(',', '.'))
  const validNum = num != null && !Number.isNaN(num) ? num : null

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder="—"
      aria-label={`Nota`}
      className={`t-grade-input ${validNum != null ? gradeClass(validNum) : ''} ${saving ? 'opacity-60' : ''}`}
    />
  )
}
