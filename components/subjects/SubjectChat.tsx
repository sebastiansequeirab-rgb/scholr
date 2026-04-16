'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { Subject } from '@/types'
import type { AppContext } from '@/lib/ai/types'

interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_STORED    = 100
const HISTORY_LIMIT = 8
const LOAD_LIMIT    = 20
const SUMMARIZE_EVERY = 10

export function SubjectChat({ subject }: { subject: Subject }) {
  const { language } = useTranslation()
  const [messages,       setMessages]       = useState<LocalMessage[]>([])
  const [input,          setInput]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [summary,        setSummary]        = useState<string | null>(null)
  const [summaryOpen,    setSummaryOpen]    = useState(false)
  const newMsgCountRef = useRef(0)
  const bottomRef      = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  // ── Load history + context summary ────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('subject_ai_messages')
        .select('role, content')
        .eq('subject_id', subject.id)
        .order('created_at', { ascending: true })
        .limit(LOAD_LIMIT),
      supabase
        .from('subject_ai_contexts')
        .select('summary')
        .eq('subject_id', subject.id)
        .maybeSingle(),
    ]).then(([msgsRes, ctxRes]) => {
      setMessages((msgsRes.data ?? []) as LocalMessage[])
      setSummary(ctxRes.data?.summary ?? null)
      setLoadingHistory(false)
    })
  }, [subject.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: LocalMessage = { role: 'user', content: text }
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
        setMessages(prev => [...prev, { role: 'assistant', content: language === 'es' ? 'Sesión expirada.' : 'Session expired.' }])
        return
      }

      const app_context: AppContext = {
        current_page:      'subjects',
        active_subject_id: subject.id,
        language:          language as 'es' | 'en',
      }

      const allMsgs   = [...messages, userMsg]
      const historyForApi = allMsgs.slice(-HISTORY_LIMIT).slice(0, -1)

      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      text,
          history:      historyForApi,
          app_context,
          access_token: session.access_token,
        }),
      })

      if (res.status === 429) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es' ? 'Demasiadas solicitudes. Espera un momento.' : 'Too many requests. Please wait.',
        }])
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error ?? (language === 'es' ? 'Error al procesar.' : 'Error processing.'),
        }])
        return
      }

      const data = await res.json()
      const assistantMsg: LocalMessage = { role: 'assistant', content: data.reply ?? '...' }
      setMessages(prev => [...prev, assistantMsg])

      // ── Persist to DB ────────────────────────────────────────────────────
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('subject_ai_messages').insert([
          { user_id: user.id, subject_id: subject.id, role: 'user',      content: text          },
          { user_id: user.id, subject_id: subject.id, role: 'assistant', content: data.reply    },
        ])

        // Cleanup if over max stored
        const { data: allStored } = await supabase
          .from('subject_ai_messages')
          .select('id, created_at')
          .eq('subject_id', subject.id)
          .order('created_at', { ascending: true })
        if (allStored && allStored.length > MAX_STORED) {
          const toDelete = allStored.slice(0, allStored.length - MAX_STORED).map(m => m.id)
          await supabase.from('subject_ai_messages').delete().in('id', toDelete)
        }

        // Rolling summary every N new messages
        newMsgCountRef.current += 2
        if (newMsgCountRef.current % SUMMARIZE_EVERY === 0) {
          fetch('/api/ai/summarize-context', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ subject_id: subject.id, access_token: session.access_token }),
          })
            .then(r => r.json())
            .then(d => { if (d.summary) setSummary(d.summary) })
            .catch(() => {})
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: language === 'es' ? 'Error de conexión.' : 'Connection error.',
      }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, subject.id, language])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: '100%' }}>

      {/* Context summary (collapsible) */}
      {summary && (
        <div className="px-6 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setSummaryOpen(o => !o)}
            className="w-full flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
            style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)', border: '1px solid var(--border-subtle)' }}
          >
            <span className="material-symbols-outlined text-[14px]"
              style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
              psychology
            </span>
            <span className="flex-1 text-left">
              {language === 'es' ? 'Contexto acumulado' : 'Accumulated context'}
            </span>
            <span className="material-symbols-outlined text-[14px] transition-transform"
              style={{ transform: summaryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>
          {summaryOpen && (
            <div className="mt-2 px-3 py-3 rounded-xl text-xs leading-relaxed animate-slide-up"
              style={{
                backgroundColor: 'var(--s-base)',
                color:           'var(--color-outline)',
                border:          '1px solid var(--border-subtle)',
              }}>
              {summary}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {loadingHistory ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center pt-8 pb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: `${subject.color}18` }}>
              <span className="material-symbols-outlined text-2xl"
                style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? `Asistente de ${subject.name}` : `${subject.name} Assistant`}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-outline)' }}>
              {language === 'es'
                ? 'Pregunta sobre evaluaciones, pide resúmenes o practica para exámenes.'
                : 'Ask about evaluations, request summaries, or practice for exams.'}
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${subject.color}18` }}>
                  <span className="material-symbols-outlined text-[12px]"
                    style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                </div>
              )}
              <div className="max-w-[80%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  backgroundColor: msg.role === 'user' ? subject.color : 'var(--s-base)',
                  color:           msg.role === 'user' ? 'white' : 'var(--on-surface)',
                  borderBottomRightRadius: msg.role === 'user'      ? '4px' : undefined,
                  borderBottomLeftRadius:  msg.role === 'assistant' ? '4px' : undefined,
                  border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : undefined,
                }}>
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${subject.color}18` }}>
              <span className="material-symbols-outlined text-[12px]"
                style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <div className="rounded-2xl rounded-bl-[4px] px-3 py-2.5"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: 'var(--color-outline)', animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={language === 'es'
              ? `Pregunta sobre ${subject.name}...`
              : `Ask about ${subject.name}...`}
            className="input flex-1 text-sm"
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-3"
            style={{ opacity: (!input.trim() || loading) ? 0.5 : 1 }}>
            <span className="material-symbols-outlined text-[17px]">send</span>
          </button>
        </form>
      </div>
    </div>
  )
}
