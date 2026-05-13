'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/hooks/useTranslation'
import { regenerateAccessCodeAction } from '@/app/(teacher)/teacher/courses/actions'

export function CourseCodeBlock({ courseId, code: initial }: { courseId: string; code: string | null }) {
  const { t } = useTranslation()
  const [code, setCode] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('teacher.common.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('teacher.common.error'))
    }
  }

  const regenerate = () => {
    if (!confirm(`¿Regenerar el código? Los estudiantes con el código viejo no podrán inscribirse.`)) return
    start(async () => {
      const r = await regenerateAccessCodeAction(courseId)
      if (r.ok && r.code) { setCode(r.code); toast.success('Código regenerado') }
      else toast.error(r.error ?? t('teacher.common.error'))
    })
  }

  return (
    <div className="t-code-block">
      <div>
        <div className="t-code-block__label">{t('teacher.courses.accessCode')}</div>
        <div className="t-code-block__value">{code ?? '—'}</div>
      </div>
      <div className="t-code-block__actions">
        <button type="button" className="t-btn-line" onClick={copy} disabled={!code}>
          <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
          {copied ? t('teacher.common.copied') : t('teacher.common.copy')}
        </button>
        <button type="button" className="t-btn-line" onClick={regenerate} disabled={pending} aria-label={t('teacher.common.regenerate')} title={t('teacher.common.regenerate')}>
          <span className="material-symbols-outlined">{pending ? 'hourglass_empty' : 'refresh'}</span>
        </button>
      </div>
    </div>
  )
}
