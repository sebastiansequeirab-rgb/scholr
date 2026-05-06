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
    <div className="reveal-stagger">

      {/* ─────────── Hero ─────────── */}
      <section
        className="card relative overflow-hidden mb-3"
        style={{
          padding: '24px',
          background:
            'radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--color-tertiary) 24%, transparent), transparent 38%),' +
            'radial-gradient(circle at 8% 90%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 42%),' +
            'var(--s-low)',
          borderColor: 'color-mix(in srgb, var(--color-tertiary) 20%, var(--border-subtle))',
        }}
      >
        {/* Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-mono"
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-tertiary)',
              background: 'color-mix(in srgb, var(--color-tertiary) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-tertiary) 24%, transparent)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Skolar IA · Contexto Académico
          </span>
        </div>

        {/* Title */}
        <h1 className="text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.05]" style={{ color: 'var(--on-surface)', letterSpacing: '-0.025em' }}>
          {language === 'es' ? (
            <>Tu <em className="serif">copiloto</em> académico.</>
          ) : (
            <>Your academic <em className="serif">copilot</em>.</>
          )}
        </h1>
        <p className="text-[14px] mt-3 max-w-[640px]" style={{ color: 'var(--on-surface-variant)', lineHeight: 1.55 }}>
          {language === 'es'
            ? 'Siempre al día con tu carrera. Tengo acceso a tus materias, apuntes, tareas y agenda — preguntame lo que necesites para llegar al examen sin sorpresas.'
            : "Always up to date with your degree. I have access to your subjects, notes, tasks and schedule — ask me anything to walk into your next exam without surprises."}
        </p>

        {/* Context chips */}
        <div className="flex flex-wrap gap-2 mt-5">
          <ContextChip icon="menu_book" value={ctxExtra?.subject_count ?? '·'} label={language === 'es' ? 'materias indexadas' : 'subjects indexed'} />
          <ContextChip icon="description" value={noteCount ?? '·'} label={language === 'es' ? 'apuntes' : 'notes'} />
          <ContextChip icon="event" value={ctxExtra?.next_exam_date ? new Date(ctxExtra.next_exam_date + 'T12:00:00').toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' }) : '—'} label={language === 'es' ? 'próximo examen' : 'next exam'} />
          <ContextChip icon="task_alt" value={ctxExtra?.pending_task_count ?? '·'} label={language === 'es' ? 'tareas pendientes' : 'pending tasks'} />
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

function ContextChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full"
      style={{
        background: 'var(--s-bg)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-tertiary)' }}>{icon}</span>
      <span className="font-mono tabular" style={{ fontSize: 12, color: 'var(--on-surface)', fontWeight: 700 }}>{value}</span>
      <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-outline)' }}>
        {label}
      </span>
    </div>
  )
}
