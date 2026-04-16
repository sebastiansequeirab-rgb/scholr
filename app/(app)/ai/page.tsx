'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { ChatMessage, AppContext } from '@/lib/ai/types'
import { ScheduleImportWizard } from '@/components/ai/ScheduleImportWizard'
import { EvaluationImportWizard } from '@/components/ai/EvaluationImportWizard'

const MAX_HISTORY = 8

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AIPage() {
  const { language } = useTranslation()
  const pathname     = usePathname()

  const [messages,  setMessages]  = useState<ChatMessage[]>([{
    role: 'assistant',
    content: language === 'es'
      ? '¡Hola! Soy tu asistente académico. Puedo consultar tus materias, horarios, actividades y tareas. También puedo ayudarte a estudiar: resúmenes, esquemas, fichas, preguntas de práctica. ¿En qué puedo ayudarte?'
      : "Hi! I'm your academic assistant. I can check your subjects, schedule, activities and tasks — and help you study: summaries, outlines, flashcards, practice questions. How can I help?",
  }])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [tab,     setTab]     = useState<'chat' | 'import' | 'evals'>('chat')

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

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Handle ?tab=import from Quick Actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'import') {
      setTab('import')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  /* ─── Send message ─────────────────────────────────────────────────────── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const supabase = createClient()
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        session = refreshed.session
      }
      if (!session) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sesión expirada. Recarga la página.' }])
        return
      }

      const app_context: AppContext = {
        current_page:       pathname?.split('/').filter(Boolean).pop() ?? 'ai',
        language:           language as 'es' | 'en',
        subject_count:      ctxExtra?.subject_count,
        pending_task_count: ctxExtra?.pending_task_count,
        next_exam_date:     ctxExtra?.next_exam_date,
      }

      const history = [...messages, userMsg].slice(-MAX_HISTORY)

      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      text,
          history:      history.slice(0, -1), // exclude current message (sent separately)
          app_context,
          access_token: session.access_token,
        }),
      })

      if (res.status === 429) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es'
            ? 'Demasiadas solicitudes al mismo tiempo. Espera unos segundos e intenta de nuevo.'
            : 'Too many requests. Please wait a moment and try again.',
        }])
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error ?? (language === 'es' ? 'Error al procesar tu solicitud.' : 'Error processing your request.'),
        }])
        return
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Sin respuesta.' }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'es' ? 'Error de conexión. Intenta de nuevo.' : 'Connection error. Try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, pathname, language, ctxExtra])

  const SUGGESTIONS: { label: string; action: string; fill?: boolean }[] = language === 'es'
    ? [
        { label: '¿Qué tengo esta semana?',         action: '¿Qué tengo esta semana?' },
        { label: 'Mis próximos exámenes',            action: 'Resúmeme mis próximos exámenes' },
        { label: '¿Qué tarea es más urgente?',       action: '¿Qué tarea es más urgente?' },
        { label: 'Explicar [tema]',                  action: 'Explícame el tema: ', fill: true },
        { label: 'Preguntas de práctica: [tema]',    action: 'Genera preguntas de práctica sobre: ', fill: true },
        { label: 'Resumen de [tema]',                action: 'Hazme un resumen de: ', fill: true },
        { label: 'Esquema de [tema]',                action: 'Crea un esquema sobre: ', fill: true },
      ]
    : [
        { label: 'What do I have this week?',        action: 'What do I have this week?' },
        { label: 'Upcoming exams',                   action: 'Summarize my upcoming exams' },
        { label: 'Most urgent task?',                action: 'What task is most urgent?' },
        { label: 'Explain [topic]',                  action: 'Explain this topic: ', fill: true },
        { label: 'Practice questions: [topic]',      action: 'Generate practice questions about: ', fill: true },
        { label: 'Summary of [topic]',               action: 'Give me a summary of: ', fill: true },
        { label: 'Outline of [topic]',               action: 'Create an outline for: ', fill: true },
      ]

  const inputRef = useRef<HTMLInputElement>(null)

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
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--s-low)' }}>
          {/* Messages */}
          <div className="h-[440px] overflow-y-auto p-5 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 15%, transparent)' }}>
                    <span className="material-symbols-outlined text-[14px]"
                      style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
                      auto_awesome
                    </span>
                  </div>
                )}
                <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--s-base)',
                    color:           msg.role === 'user' ? 'white' : 'var(--on-surface)',
                    borderBottomRightRadius: msg.role === 'user'      ? '4px' : undefined,
                    borderBottomLeftRadius:  msg.role === 'assistant' ? '4px' : undefined,
                  }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 15%, transparent)' }}>
                  <span className="material-symbols-outlined text-[14px]"
                    style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <div className="rounded-2xl rounded-bl-[4px] px-4 py-3" style={{ backgroundColor: 'var(--s-base)' }}>
                  <div className="flex gap-1 items-center h-5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ backgroundColor: 'var(--color-outline)', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button key={i}
                  onClick={() => {
                    if (s.fill) {
                      setInput(s.action)
                      setTimeout(() => inputRef.current?.focus(), 50)
                    } else {
                      sendMessage(s.action)
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all flex items-center gap-1"
                  style={{ color: 'var(--color-outline)', borderColor: 'var(--border-default)', backgroundColor: 'var(--s-base)' }}>
                  {s.fill && <span className="material-symbols-outlined text-[11px]">edit</span>}
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={language === 'es' ? 'Pregúntame algo sobre tus estudios...' : 'Ask me anything about your studies...'}
                className="input flex-1 text-sm"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4"
                style={{ opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </div>
        </div>
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
