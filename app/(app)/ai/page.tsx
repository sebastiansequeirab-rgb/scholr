'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { AIChatHub } from '@/features/ai/components/AIChatHub'

export default function AIPage() {
  const { t, language } = useTranslation()

  const [ctxExtra, setCtxExtra] = useState<{
    subject_count: number
    pending_task_count: number
    next_exam_date: string | null
  } | null>(null)

  const [noteCount, setNoteCount] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_done', false),
      supabase.from('exams').select('exam_date').gte('exam_date', today).order('exam_date').limit(1).maybeSingle(),
      supabase.from('notes').select('id', { count: 'exact', head: true }),
    ]).then(([sRes, tRes, eRes, nRes]) => {
      setCtxExtra({
        subject_count:      sRes.count  ?? 0,
        pending_task_count: tRes.count  ?? 0,
        next_exam_date:     eRes.data?.exam_date ?? null,
      })
      setNoteCount(nRes.count ?? 0)
    })
  }, [])

  const subjectCount = ctxExtra?.subject_count ?? 0
  const noteCountValue = noteCount ?? 0

  const subtitle = t('ai.hero_subtitle')
    .replace('{subjects}', String(subjectCount))
    .replace('{notes}', String(noteCountValue))

  return (
    <div className="reveal-stagger ai-shell-2">

      {/* ─────────── Hero ─────────── */}
      <section className="ai-hero-2 mb-3">
        <div className="ai-hero-2__bg" />
        <div className="ai-hero-2__orb" />
        <div className="ai-hero-2__content">
          <span className="ai-hero-2__badge">
            <span className="material-symbols-outlined">auto_awesome</span>
            {t('ai.hero_eyebrow')}
          </span>
          <h1 className="ai-hero-2__title">
            {language === 'es' ? (
              <>
                Tu <em className="serif">copiloto</em> académico.
                <br />
                Siempre al día con tu carrera.
              </>
            ) : (
              <>
                Your academic <em className="serif">copilot</em>.
                <br />
                Always up to date with your degree.
              </>
            )}
          </h1>
          <p className="ai-hero-2__sub">{subtitle}</p>
          <div className="ai-hero-2__chips">
            <HeroChipFlat
              icon="menu_book"
              text={t('ai.chip_subjects_indexed').replace('{n}', String(subjectCount))}
            />
            <HeroChipFlat
              icon="description"
              text={t('ai.chip_notes').replace('{n}', String(noteCountValue))}
            />
            <HeroChipFlat
              icon="event"
              text={t('ai.chip_live_agenda')}
            />
          </div>
        </div>
      </section>

      {/* ─────────── Chat ─────────── */}
      <AIChatHub language={language as 'es' | 'en'} ctxExtra={ctxExtra} />
    </div>
  )
}

function HeroChipFlat({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      className="inline-flex items-center gap-2"
      style={{
        background:    'var(--s-low)',
        border:        '1px solid var(--border-subtle)',
        padding:       '8px 14px',
        borderRadius:  999,
        fontSize:      13,
        color:         'var(--on-surface)',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}
      >
        {icon}
      </span>
      <span>{text}</span>
    </div>
  )
}
