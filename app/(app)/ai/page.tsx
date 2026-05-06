'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { ScheduleImportWizard } from '@/features/ai/components/ScheduleImportWizard'
import { EvaluationImportWizard } from '@/features/ai/components/EvaluationImportWizard'
import { AIChatHub } from '@/features/ai/components/AIChatHub'

export default function AIPage() {
  const { language } = useTranslation()
  const [tab, setTab] = useState<'chat' | 'import' | 'evals'>('chat')

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'import') {
      setTab('import')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  return (
    <div className="reveal-stagger ai-shell-2">

      {/* ─────────── Hero ─────────── */}
      <section className="ai-hero-2 mb-3">
        <div className="ai-hero-2__bg" />
        <div className="ai-hero-2__orb" />
        <div className="ai-hero-2__content">
          <span className="ai-hero-2__badge">
            <span className="material-symbols-outlined">auto_awesome</span>
            Skolar IA · Contexto Académico
          </span>
          <h1 className="ai-hero-2__title">
            {language === 'es' ? (
              <>Tu <em className="serif">copiloto</em> académico.</>
            ) : (
              <>Your academic <em className="serif">copilot</em>.</>
            )}
          </h1>
          <p className="ai-hero-2__sub">
            {language === 'es'
              ? 'Siempre al día con tu carrera. Tengo acceso a tus materias, apuntes, tareas y agenda — preguntame lo que necesites para llegar al examen sin sorpresas.'
              : "Always up to date with your degree. I have access to your subjects, notes, tasks and schedule — ask me anything to walk into your next exam without surprises."}
          </p>
          <div className="ai-hero-2__chips">
            <HeroChip variant="info"      icon="menu_book"   value={ctxExtra?.subject_count ?? '·'} label={language === 'es' ? 'materias indexadas' : 'subjects indexed'} />
            <HeroChip variant="success"   icon="description" value={noteCount ?? '·'}                label={language === 'es' ? 'apuntes' : 'notes'} />
            <HeroChip variant="warning"   icon="event"       value={ctxExtra?.next_exam_date ? new Date(ctxExtra.next_exam_date + 'T12:00:00').toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' }) : '—'} label={language === 'es' ? 'próximo examen' : 'next exam'} />
            <HeroChip variant="tertiary"  icon="task_alt"    value={ctxExtra?.pending_task_count ?? '·'} label={language === 'es' ? 'tareas pendientes' : 'pending tasks'} />
          </div>
        </div>
      </section>

      {/* ─────────── Tab bar ─────────── */}
      <div
        className="inline-flex gap-1 p-1 rounded-[10px] mb-3"
        style={{ background: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
      >
        {([
          { id: 'chat',   icon: 'chat',           label_es: 'Chat',          label_en: 'Chat'        },
          { id: 'import', icon: 'calendar_month', label_es: 'Importar Horario', label_en: 'Schedule import' },
          { id: 'evals',  icon: 'assignment',     label_es: 'Evaluaciones',  label_en: 'Evaluations' },
        ] as const).map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] transition-all"
              style={{
                background: active ? 'color-mix(in srgb, var(--color-tertiary) 14%, transparent)' : 'transparent',
                color: active ? 'var(--color-tertiary)' : 'var(--on-surface-variant)',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              {language === 'es' ? item.label_es : item.label_en}
            </button>
          )
        })}
      </div>

      {/* ─────────── Tab content ─────────── */}
      {tab === 'chat' && (
        <AIChatHub language={language as 'es' | 'en'} ctxExtra={ctxExtra} />
      )}
      {tab === 'import' && (
        <ScheduleImportWizard language={language as 'es' | 'en'} onDone={() => setTab('chat')} />
      )}
      {tab === 'evals' && (
        <EvaluationImportWizard language={language as 'es' | 'en'} onDone={() => setTab('chat')} />
      )}
    </div>
  )
}

function HeroChip({
  icon,
  value,
  label,
  variant,
}: {
  icon: string
  value: string | number
  label: string
  variant: 'info' | 'success' | 'warning' | 'tertiary'
}) {
  return (
    <div className="ai-hero-2__chip">
      <span className={`ai-hero-2__chip-icon ai-hero-2__chip-icon--${variant}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <strong>{value}</strong>
      <span style={{ opacity: 0.85 }}>{label}</span>
    </div>
  )
}
