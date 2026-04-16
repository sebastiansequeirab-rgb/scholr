'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Subject } from '@/types'
import type { AppContext } from '@/lib/ai/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AISession {
  id: string
  subject_id: string | null
  title: string | null
  created_at: string
  last_message_at: string
}

interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
}

type ChatView = 'projects' | 'sessions' | 'chat'

const GENERAL_ID = '__general__'

// ─── AIChatHub ────────────────────────────────────────────────────────────────

export function AIChatHub({
  language,
  ctxExtra,
}: {
  language: 'es' | 'en'
  ctxExtra: { subject_count: number; pending_task_count: number; next_exam_date: string | null } | null
}) {
  const [view,            setView]            = useState<ChatView>('projects')
  const [subjects,        setSubjects]        = useState<Subject[]>([])
  const [sessions,        setSessions]        = useState<AISession[]>([])
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
  const [activeSubjectName, setActiveSubjectName] = useState('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages,        setMessages]        = useState<LocalMessage[]>([])
  const [input,           setInput]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [loadingData,     setLoadingData]     = useState(true)
  const [deleteConfirm,   setDeleteConfirm]   = useState<string | null>(null)

  const currentSessionIdRef = useRef<string | null>(null)
  const pendingSubjectIdRef = useRef<string | null>(null)
  const bottomRef           = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)

  // ── Load subjects + sessions ───────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('subjects').select('id, name, color, icon, user_id, professor, room, credits, created_at').order('name'),
      supabase.from('ai_sessions').select('id, subject_id, title, created_at, last_message_at')
        .order('last_message_at', { ascending: false }),
    ]).then(([sRes, sessRes]) => {
      setSubjects(sRes.data ?? [])
      setSessions(sessRes.data ?? [])
      setLoadingData(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const openSubject = (subjectId: string | null, name: string) => {
    setActiveSubjectId(subjectId)
    setActiveSubjectName(name)
    setView('sessions')
  }

  const startNewChat = () => {
    currentSessionIdRef.current  = null
    pendingSubjectIdRef.current   = activeSubjectId
    setActiveSessionId(null)
    setMessages([])
    setView('chat')
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const openSession = async (session: AISession) => {
    currentSessionIdRef.current = session.id
    setActiveSessionId(session.id)
    const supabase = createClient()
    const { data } = await supabase
      .from('ai_session_messages')
      .select('role, content')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(60)
    setMessages(data ?? [])
    setView('chat')
  }

  const deleteSession = async (sessionId: string) => {
    await createClient().from('ai_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setDeleteConfirm(null)
  }

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: LocalMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const supabase = createClient()
      let { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        authSession = refreshed.session
      }
      if (!authSession) return

      const rawSubjectId = pendingSubjectIdRef.current ?? activeSubjectId
      const subjectId    = rawSubjectId === GENERAL_ID ? null : rawSubjectId

      // Create session on first message
      let sessionId = currentSessionIdRef.current
      if (!sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: newSess } = await supabase
            .from('ai_sessions')
            .insert({
              user_id:    user.id,
              subject_id: subjectId,
              title:      text.length > 50 ? text.slice(0, 49) + '…' : text,
            })
            .select()
            .single()
          if (newSess) {
            sessionId                     = newSess.id
            currentSessionIdRef.current   = sessionId
            pendingSubjectIdRef.current   = null
            setActiveSessionId(sessionId)
            setSessions(prev => [newSess, ...prev])
          }
        }
      }

      // Build AppContext
      const app_context: AppContext = {
        current_page:       'ai',
        active_subject_id:  subjectId ?? undefined,
        language,
        subject_count:      ctxExtra?.subject_count,
        pending_task_count: ctxExtra?.pending_task_count,
        next_exam_date:     ctxExtra?.next_exam_date,
      }

      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      text,
          history:      messages.slice(-8),
          app_context,
          access_token: authSession.access_token,
        }),
      })

      if (res.status === 429) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: language === 'es'
            ? 'Demasiadas solicitudes. Espera un momento.'
            : 'Too many requests. Please wait.',
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
      const assistantContent = data.reply ?? '...'
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }])

      // Persist
      if (sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('ai_session_messages').insert([
            { session_id: sessionId, user_id: user.id, role: 'user',      content: text             },
            { session_id: sessionId, user_id: user.id, role: 'assistant', content: assistantContent },
          ])
          await supabase.from('ai_sessions')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', sessionId)
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
  }, [loading, messages, activeSubjectId, language, ctxExtra])

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: Projects
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'projects') {
    const generalSessions = sessions.filter(s => !s.subject_id)

    return (
      <div className="space-y-2 animate-fade-in">
        {/* General project */}
        <button
          onClick={() => openSubject(GENERAL_ID, language === 'es' ? 'General' : 'General')}
          className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
          style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 15%, transparent)' }}>
            <span className="material-symbols-outlined text-[20px]"
              style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? 'General' : 'General'}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-outline)' }}>
              {generalSessions[0]?.title
                ?? (language === 'es' ? 'Sin chats aún' : 'No chats yet')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {generalSessions.length > 0 && (
              <span className="mono text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
                {generalSessions.length}
              </span>
            )}
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--color-outline)' }}>chevron_right</span>
          </div>
        </button>

        {/* Subject projects */}
        {loadingData ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-[66px] rounded-2xl" />)}
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-center py-6 text-sm" style={{ color: 'var(--color-outline)' }}>
            {language === 'es'
              ? 'Agrega materias para ver proyectos por materia.'
              : 'Add subjects to see subject projects.'}
          </p>
        ) : (
          subjects.map(subject => {
            const subjectSessions = sessions.filter(s => s.subject_id === subject.id)
            return (
              <button
                key={subject.id}
                onClick={() => openSubject(subject.id, subject.name)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${subject.color}18` }}>
                  <span className="material-symbols-outlined text-[20px]"
                    style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                    {subject.icon || 'menu_book'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                    {subject.name}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-outline)' }}>
                    {subjectSessions[0]?.title
                      ?? (language === 'es' ? 'Sin chats aún' : 'No chats yet')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {subjectSessions.length > 0 && (
                    <span className="mono text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${subject.color}18`, color: subject.color }}>
                      {subjectSessions.length}
                    </span>
                  )}
                  <span className="material-symbols-outlined text-[16px]"
                    style={{ color: 'var(--color-outline)' }}>chevron_right</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: Sessions list for a subject/general
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'sessions') {
    const isGeneral    = activeSubjectId === GENERAL_ID
    const subject      = subjects.find(s => s.id === activeSubjectId)
    const accentColor  = subject?.color ?? 'var(--color-tertiary)'
    const activeSessions = sessions.filter(s =>
      isGeneral ? !s.subject_id : s.subject_id === activeSubjectId
    )

    return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setView('projects')}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}>
            <span className="material-symbols-outlined text-[14px]"
              style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
              {isGeneral ? 'auto_awesome' : (subject?.icon || 'menu_book')}
            </span>
          </div>
          <h2 className="text-sm font-bold flex-1 truncate" style={{ color: 'var(--on-surface)' }}>
            {activeSubjectName}
          </h2>
          <button onClick={startNewChat}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
              color:           accentColor,
              border:          `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
            }}>
            <span className="material-symbols-outlined text-[14px]">add</span>
            {language === 'es' ? 'Nuevo chat' : 'New chat'}
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}>
              <span className="material-symbols-outlined text-2xl"
                style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>chat</span>
            </div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--on-surface)' }}>
              {language === 'es' ? 'Sin chats aún' : 'No chats yet'}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? 'Crea un chat nuevo para empezar.' : 'Create a new chat to get started.'}
            </p>
            <button onClick={startNewChat}
              className="btn-primary text-xs px-4">
              {language === 'es' ? 'Nuevo chat' : 'New chat'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map(session => (
              <div key={session.id} className="group">
                {deleteConfirm === session.id ? (
                  <div className="flex items-center gap-2 p-3 rounded-2xl animate-slide-up"
                    style={{
                      backgroundColor: 'var(--priority-high-bg)',
                      border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
                    }}>
                    <span className="text-xs flex-1" style={{ color: 'var(--on-surface)' }}>
                      {language === 'es' ? '¿Eliminar este chat?' : 'Delete this chat?'}
                    </span>
                    <button onClick={() => deleteSession(session.id)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
                      {language === 'es' ? 'Sí' : 'Yes'}
                    </button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openSession(session)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all"
                    style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}
                  >
                    <span className="material-symbols-outlined text-[16px] flex-shrink-0"
                      style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
                      chat
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--on-surface)' }}>
                        {session.title ?? (language === 'es' ? 'Chat sin título' : 'Untitled chat')}
                      </p>
                      <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--color-outline)' }}>
                        {new Date(session.last_message_at).toLocaleDateString(
                          language === 'es' ? 'es-ES' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(session.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-400/10 flex-shrink-0"
                      style={{ color: 'var(--danger)' }}
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </button>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEW: Active chat
  // ─────────────────────────────────────────────────────────────────────────

  const isGeneral   = activeSubjectId === GENERAL_ID || activeSubjectId === null
  const subject     = !isGeneral ? subjects.find(s => s.id === activeSubjectId) : null
  const accentColor = subject?.color ?? 'var(--color-tertiary)'

  return (
    <div className="flex flex-col animate-fade-in" style={{ height: '440px' }}>
      {/* Chat header */}
      <div className="flex items-center gap-2 pb-3 mb-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button onClick={() => setView('sessions')}
          className="p-1 rounded-lg flex-shrink-0"
          style={{ color: 'var(--color-outline)' }}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}>
          <span className="material-symbols-outlined text-[12px]"
            style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
            {isGeneral ? 'auto_awesome' : (subject?.icon || 'menu_book')}
          </span>
        </div>
        <p className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--on-surface)' }}>
          {activeSubjectName}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-xs pt-8" style={{ color: 'var(--color-outline)' }}>
            {language === 'es' ? 'Escribe algo para empezar…' : 'Type something to start…'}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}>
                <span className="material-symbols-outlined text-[12px]"
                  style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
              </div>
            )}
            <div className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                backgroundColor: msg.role === 'user'
                  ? (subject?.color ?? 'var(--color-primary)')
                  : 'var(--s-base)',
                color:           msg.role === 'user' ? 'white' : 'var(--on-surface)',
                borderBottomRightRadius: msg.role === 'user'      ? '4px' : undefined,
                borderBottomLeftRadius:  msg.role === 'assistant' ? '4px' : undefined,
                border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : undefined,
              }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}>
              <span className="material-symbols-outlined text-[12px]"
                style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
            </div>
            <div className="rounded-2xl rounded-bl-[4px] px-4 py-3"
              style={{ backgroundColor: 'var(--s-base)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex gap-1 items-center h-5">
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
      <div className="pt-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={language === 'es' ? 'Escribe un mensaje…' : 'Type a message…'}
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
  )
}
