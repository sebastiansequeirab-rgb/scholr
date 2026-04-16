'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import { ScheduleImportWizard } from '@/components/ai/ScheduleImportWizard'
import { EvaluationImportWizard } from '@/components/ai/EvaluationImportWizard'
import { AIChatHub } from '@/components/ai/AIChatHub'

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AIPage() {
  const { language } = useTranslation()

  const [tab, setTab] = useState<'chat' | 'import' | 'evals'>('chat')

  // Lightweight context: subject count, pending tasks, next exam
  const [ctxExtra, setCtxExtra] = useState<{
    subject_count: number
    pending_task_count: number
    next_exam_date: string | null
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('subjects').select('id', { count: 'exact', head: true }),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_done', false),
      supabase.from('exams').select('exam_date').gte('exam_date', today).order('exam_date').limit(1).maybeSingle(),
    ]).then(([sRes, tRes, eRes]) => {
      setCtxExtra({
        subject_count:      sRes.count  ?? 0,
        pending_task_count: tRes.count  ?? 0,
        next_exam_date:     eRes.data?.exam_date ?? null,
      })
    })
  }, [])

  // Handle ?tab=import from Quick Actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'import') {
      setTab('import')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <span className="mono text-[10px] tracking-[0.2em] uppercase font-medium block mb-2"
            style={{ color: 'var(--color-tertiary)' }}>
            {language === 'es' ? 'Asistente Académico' : 'Academic Assistant'}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--on-surface)' }}>
            {language === 'es' ? 'IA Scholr' : 'Scholr AI'}
          </h1>
        </div>
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ backgroundColor: 'var(--s-base)' }}>
          {([
            { id: 'chat',   icon: 'chat',            label_es: 'Chat',          label_en: 'Chat'       },
            { id: 'import', icon: 'calendar_month',  label_es: 'Horario',       label_en: 'Schedule'   },
            { id: 'evals',  icon: 'assignment',      label_es: 'Evaluaciones',  label_en: 'Evaluations'},
          ] as const).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: tab === item.id ? 'var(--s-high)' : 'transparent',
                color: tab === item.id ? 'var(--on-surface)' : 'var(--color-outline)',
              }}>
              <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
              {language === 'es' ? item.label_es : item.label_en}
            </button>
          ))}
        </div>
      </div>

      {/* ─── CHAT TAB ─────────────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <AIChatHub language={language as 'es' | 'en'} ctxExtra={ctxExtra} />
      )}

      {/* ─── IMPORT TAB ───────────────────────────────────────────────────── */}
      {tab === 'import' && (
        <ScheduleImportWizard
          language={language as 'es' | 'en'}
          onDone={() => setTab('chat')}
        />
      )}

      {/* ─── EVALS TAB ────────────────────────────────────────────────────── */}
      {tab === 'evals' && (
        <EvaluationImportWizard
          language={language as 'es' | 'en'}
          onDone={() => setTab('chat')}
        />
      )}
    </div>
  )
}
