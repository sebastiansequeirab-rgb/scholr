'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Subject } from '@/types'
import type { AppContext } from '@/features/ai/types'

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

const GENERAL_ID = '__general__'

const QUICK_ACTIONS_ES = [
  { icon: 'calendar_today',  label: '¿Qué tengo esta semana?',  action: '¿Qué tengo esta semana en clases, tareas y evaluaciones?' },
  { icon: 'school',          label: 'Próximos exámenes',         action: 'Resume mis próximos exámenes y su porcentaje en la nota final.' },
  { icon: 'priority_high',   label: '¿Qué es más urgente?',     action: '¿Qué es lo más urgente que debo hacer hoy o esta semana?' },
  { icon: 'auto_fix_high',   label: 'Organizar mi semana',       action: 'Ayúdame a organizar mi semana académica según materias, tareas y evaluaciones.' },
  { icon: 'add_task',        label: 'Agregar tarea',             action: 'Quiero agregar una tarea nueva. ¿Me ayudas a registrarla?' },
  { icon: 'event',           label: 'Agregar examen',            action: 'Quiero registrar un examen nuevo. ¿Me ayudas?' },
  { icon: 'assignment',      label: 'Agregar assignment',        action: 'Quiero agregar un assignment o entrega nueva. ¿Me ayudas?' },
  { icon: 'upload_file',     label: 'Resumir archivo',           action: 'Quiero subir un archivo para que lo analices y resumas.' },
]

const QUICK_ACTIONS_EN = [
  { icon: 'calendar_today',  label: 'What do I have this week?', action: 'What do I have this week in classes, tasks and exams?' },
  { icon: 'school',          label: 'Upcoming exams',            action: 'Summarize my upcoming exams and their weight in my final grade.' },
  { icon: 'priority_high',   label: "What's most urgent?",      action: 'What is the most urgent thing I need to do today or this week?' },
  { icon: 'auto_fix_high',   label: 'Organize my week',          action: 'Help me organize my academic week based on subjects, tasks, and evaluations.' },
  { icon: 'add_task',        label: 'Add task',                  action: 'I want to add a new task. Can you help me register it?' },
  { icon: 'event',           label: 'Add exam',                  action: 'I want to register a new exam. Can you help?' },
  { icon: 'assignment',      label: 'Add assignment',            action: 'I want to add a new assignment or submission. Can you help?' },
  { icon: 'upload_file',     label: 'Summarize file',            action: 'I want to upload a file for you to analyze and summarize.' },
]

// ─── AIChatHub ────────────────────────────────────────────────────────────────

export function AIChatHub({
  language,
  ctxExtra,
}: {
  language: 'es' | 'en'
  ctxExtra: { subject_count: number; pending_task_count: number; next_exam_date: string | null } | null
}) {
  const [subjects,      setSubjects]      = useState<Subject[]>([])
  const [sessions,      setSessions]      = useState<AISession[]>([])
  const [loadingData,   setLoadingData]   = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSubjectId, setActiveSubjectId] = useState<string>(GENERAL_ID)
  const [activeSubjectName, setActiveSubjectName] = useState(language === 'es' ? 'General' : 'General')
  const [messages,      setMessages]      = useState<LocalMessage[]>([])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [mobileShowList, setMobileShowList] = useState(false)
  const [pdfText,        setPdfText]        = useState<string | null>(null)
  const [pdfName,        setPdfName]        = useState<string | null>(null)
  const [pdfLoading,     setPdfLoading]     = useState(false)
  const [imageFile,      setImageFile]      = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const currentSessionIdRef = useRef<string | null>(null)
  const pendingSubjectIdRef = useRef<string | null>(GENERAL_ID)
  const bottomRef           = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)
  const aiRecognitionRef    = useRef<SpeechRecognition | null>(null)
  const imageInputRef       = useRef<HTMLInputElement>(null)
  const [isAIRecording, setIsAIRecording] = useState(false)

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const handleAIVoiceToggle = () => {
    type SpeechRecognitionCtor = new () => SpeechRecognition
    const SRCtor: SpeechRecognitionCtor | undefined =
      (window as Window & { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition
    if (!SRCtor) return

    if (isAIRecording) {
      aiRecognitionRef.current?.stop()
      setIsAIRecording(false)
      return
    }
    const recognition = new SRCtor()
    recognition.lang = 'es-ES'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) setInput(prev => prev ? prev + ' ' + transcript : transcript)
    }
    recognition.onend = () => setIsAIRecording(false)
    aiRecognitionRef.current = recognition
    recognition.start()
    setIsAIRecording(true)
  }

  // ── Load data & auto-open General ─────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('subjects')
        .select('id, name, color, icon, user_id, professor, room, credits, created_at')
        .order('name'),
      supabase.from('ai_sessions')
        .select('id, subject_id, title, created_at, last_message_at')
        .order('last_message_at', { ascending: false }),
    ]).then(async ([sRes, sessRes]) => {
      setSubjects(sRes.data ?? [])
      const sess = sessRes.data ?? []
      setSessions(sess)
      setLoadingData(false)

      // Auto-open most recent General session
      const generalSess = sess.filter(s => !s.subject_id)
      if (generalSess.length > 0) {
        const first = generalSess[0]
        currentSessionIdRef.current = first.id
        pendingSubjectIdRef.current = null
        setActiveSessionId(first.id)
        const { data } = await supabase
          .from('ai_session_messages')
          .select('role, content')
          .eq('session_id', first.id)
          .order('created_at', { ascending: true })
          .limit(60)
        setMessages(data ?? [])
      }
      // else: pending new General chat — messages stay empty, quick actions shown
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Refresh subject_ai_contexts when switching to a subject chat ───────────
  useEffect(() => {
    if (activeSubjectId === GENERAL_ID) return

    const refreshContext = async () => {
      const supabase = createClient()
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession) return

      const { data: ctx } = await supabase
        .from('subject_ai_contexts')
        .select('last_updated_at')
        .eq('user_id', authSession.user.id)
        .eq('subject_id', activeSubjectId)
        .maybeSingle()

      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
      const isStale = !ctx?.last_updated_at ||
        (Date.now() - new Date(ctx.last_updated_at).getTime()) > TWENTY_FOUR_HOURS

      if (isStale) {
        await fetch('/api/ai/summarize-context', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subject_id: activeSubjectId, access_token: authSession.access_token }),
        }).catch(() => { /* non-blocking — context refresh is best-effort */ })
      }
    }

    refreshContext()
  }, [activeSubjectId])

  // ── Navigation ─────────────────────────────────────────────────────────────

  const selectSession = useCallback(async (session: AISession) => {
    if (currentSessionIdRef.current === session.id) {
      setMobileShowList(false)
      return
    }
    const subId = session.subject_id
    currentSessionIdRef.current = session.id
    pendingSubjectIdRef.current = null
    setActiveSessionId(session.id)
    setActiveSubjectId(subId ?? GENERAL_ID)
    setActiveSubjectName(
      subId
        ? (subjects.find(s => s.id === subId)?.name ?? '')
        : (language === 'es' ? 'General' : 'General')
    )
    setMobileShowList(false)
    const supabase = createClient()
    const { data } = await supabase
      .from('ai_session_messages')
      .select('role, content')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(60)
    setMessages(data ?? [])
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [subjects, language])

  const startNewChat = useCallback((subjectId: string, subjectName: string) => {
    currentSessionIdRef.current = null
    pendingSubjectIdRef.current = subjectId
    setActiveSessionId(null)
    setActiveSubjectId(subjectId)
    setActiveSubjectName(subjectName)
    setMessages([])
    setMobileShowList(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  const confirmDelete = useCallback(async (sessionId: string) => {
    await createClient().from('ai_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setDeleteConfirm(null)
    // If deleted the active session, reset to pending new General chat
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null
      pendingSubjectIdRef.current = GENERAL_ID
      setActiveSessionId(null)
      setActiveSubjectId(GENERAL_ID)
      setActiveSubjectName(language === 'es' ? 'General' : 'General')
      setMessages([])
    }
  }, [language])

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
            sessionId                   = newSess.id
            currentSessionIdRef.current = sessionId
            pendingSubjectIdRef.current = null
            setActiveSessionId(sessionId)
            setSessions(prev => [newSess, ...prev])
          }
        }
      }

      const app_context: AppContext = {
        current_page:       'ai',
        active_subject_id:  subjectId ?? undefined,
        language,
        subject_count:      ctxExtra?.subject_count,
        pending_task_count: ctxExtra?.pending_task_count,
        next_exam_date:     ctxExtra?.next_exam_date,
      }

      const currentPdfText = pdfText
      if (pdfText) { setPdfText(null); setPdfName(null) } // consume PDF on first message

      // Convert attached image to base64
      let imageBase64:     string | undefined
      let imageMediaType:  string | undefined
      if (imageFile) {
        imageMediaType = imageFile.type || 'image/jpeg'
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve((reader.result as string).split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })
        setImageFile(null)
        setImagePreviewUrl(null)
        if (imageInputRef.current) imageInputRef.current.value = ''
      }

      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      text,
          history:      messages.slice(-8),
          app_context,
          access_token: authSession.access_token,
          pdf_text:     currentPdfText ?? undefined,
          imageBase64,
          imageMediaType,
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
  }, [loading, messages, activeSubjectId, language, ctxExtra, imageFile])

  // ── Derived values ─────────────────────────────────────────────────────────
  const isGeneral     = activeSubjectId === GENERAL_ID
  const activeSubject = !isGeneral ? subjects.find(s => s.id === activeSubjectId) : null
  const accentColor   = activeSubject?.color ?? 'var(--color-tertiary)'
  const quickActions  = language === 'es' ? QUICK_ACTIONS_ES : QUICK_ACTIONS_EN

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const SessionRow = ({ session }: { session: AISession }) => {
    const subId     = session.subject_id
    const sub       = subId ? subjects.find(s => s.id === subId) : null
    const color     = sub?.color ?? 'var(--color-tertiary)'
    const isActive  = activeSessionId === session.id

    if (deleteConfirm === session.id) {
      return (
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg mb-0.5"
          style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)' }}>
          <span className="text-[10px] flex-1" style={{ color: 'var(--on-surface)' }}>
            {language === 'es' ? '¿Eliminar?' : 'Delete?'}
          </span>
          <button onClick={() => confirmDelete(session.id)}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--danger)', color: 'white' }}>
            {language === 'es' ? 'Sí' : 'Yes'}
          </button>
          <button onClick={() => setDeleteConfirm(null)}
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--s-base)', color: 'var(--color-outline)' }}>
            No
          </button>
        </div>
      )
    }

    return (
      <button
        onClick={() => selectSession(session)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-left group transition-colors"
        style={{
          backgroundColor: isActive
            ? `color-mix(in srgb, ${color} 12%, transparent)`
            : 'transparent',
        }}>
        <span className="material-symbols-outlined text-[12px] flex-shrink-0"
          style={{ color: isActive ? color : 'var(--color-outline)' }}>
          chat
        </span>
        <span className="text-[11px] truncate flex-1"
          style={{ color: isActive ? 'var(--on-surface)' : 'var(--color-secondary)' }}>
          {session.title ?? (language === 'es' ? 'Sin título' : 'Untitled')}
        </span>
        <button
          onClick={e => { e.stopPropagation(); setDeleteConfirm(session.id) }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded"
          style={{ color: 'var(--danger)' }}>
          <span className="material-symbols-outlined text-[12px]">close</span>
        </button>
      </button>
    )
  }

  const SidebarContent = () => {
    const generalSessions = sessions.filter(s => !s.subject_id)

    return (
      <div className="space-y-3">
        {/* General */}
        <div>
          <div className="flex items-center justify-between px-1 py-0.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--color-outline)' }}>
              General
            </span>
            <button
              onClick={() => startNewChat(GENERAL_ID, language === 'es' ? 'General' : 'General')}
              className="rounded p-0.5 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-outline)' }}
              title={language === 'es' ? 'Nuevo chat' : 'New chat'}>
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          </div>
          {generalSessions.length === 0 ? (
            <button
              onClick={() => startNewChat(GENERAL_ID, language === 'es' ? 'General' : 'General')}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? '+ Nuevo chat' : '+ New chat'}
            </button>
          ) : (
            generalSessions.map(s => <SessionRow key={s.id} session={s} />)
          )}
        </div>

        {/* Subjects */}
        {!loadingData && subjects.map(subject => {
          const subSessions = sessions.filter(s => s.subject_id === subject.id)
          return (
            <div key={subject.id}>
              <div className="flex items-center justify-between px-1 py-0.5 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[11px] flex-shrink-0"
                    style={{ color: subject.color, fontVariationSettings: "'FILL' 1" }}>
                    {subject.icon || 'menu_book'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest truncate"
                    style={{ color: 'var(--color-outline)' }}>
                    {subject.name}
                  </span>
                </div>
                <button
                  onClick={() => startNewChat(subject.id, subject.name)}
                  className="rounded p-0.5 hover:opacity-70 transition-opacity flex-shrink-0"
                  style={{ color: 'var(--color-outline)' }}>
                  <span className="material-symbols-outlined text-[14px]">add</span>
                </button>
              </div>
              {subSessions.length === 0 ? (
                <button
                  onClick={() => startNewChat(subject.id, subject.name)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors"
                  style={{ color: 'var(--color-outline)' }}>
                  {language === 'es' ? '+ Nuevo chat' : '+ New chat'}
                </button>
              ) : (
                subSessions.map(s => <SessionRow key={s.id} session={s} />)
              )}
            </div>
          )
        })}

        {loadingData && (
          <div className="space-y-1.5 px-1 pt-1">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-6 rounded-lg" />)}
          </div>
        )}
      </div>
    )
  }

  // ── Chat area ──────────────────────────────────────────────────────────────

  const ChatArea = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>

        {/* Mobile: hamburger to open list */}
        <button
          onClick={() => setMobileShowList(true)}
          className="md:hidden p-1 rounded-lg flex-shrink-0"
          style={{ color: 'var(--color-outline)' }}>
          <span className="material-symbols-outlined text-[18px]">menu</span>
        </button>

        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}>
          <span className="material-symbols-outlined text-[12px]"
            style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
            {isGeneral ? 'auto_awesome' : (activeSubject?.icon || 'menu_book')}
          </span>
        </div>
        <p className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--on-surface)' }}>
          {activeSubjectName}
        </p>
        <button
          onClick={() => startNewChat(activeSubjectId, activeSubjectName)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 transition-all"
          style={{
            backgroundColor: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
            color:            accentColor,
            border:           `1px solid color-mix(in srgb, ${accentColor} 22%, transparent)`,
          }}>
          <span className="material-symbols-outlined text-[12px]">add</span>
          {language === 'es' ? 'Nuevo' : 'New'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 min-h-0 space-y-4">
        {messages.length === 0 && (
          <div className="pt-1 pb-2">
            <p className="text-[11px] font-semibold mb-3 px-0.5"
              style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? 'Acciones rápidas' : 'Quick actions'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.action)}
                  className="flex items-center gap-2 p-3 rounded-xl text-left transition-all active:scale-[0.97]"
                  style={{
                    backgroundColor: 'var(--s-base)',
                    border:          '1px solid var(--border-subtle)',
                  }}>
                  <span className="material-symbols-outlined text-[16px] flex-shrink-0"
                    style={{ color: accentColor, fontVariationSettings: "'FILL' 1" }}>
                    {action.icon}
                  </span>
                  <span className="text-xs font-medium leading-tight"
                    style={{ color: 'var(--on-surface)' }}>
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
                  ? (activeSubject?.color ?? 'var(--color-primary)')
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
        {/* PDF badge */}
        {pdfName && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--warning)' }}>picture_as_pdf</span>
            <span className="text-[11px] font-medium flex-1 truncate" style={{ color: 'var(--on-surface)' }}>{pdfName}</span>
            <button onClick={() => { setPdfText(null); setPdfName(null) }}
              className="text-[10px]" style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {/* Image preview badge */}
        {imagePreviewUrl && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="preview" className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
              style={{ border: '1px solid var(--border-subtle)' }} />
            <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--color-secondary)' }}>
              {imageFile?.name}
            </span>
            <button type="button" onClick={() => { setImageFile(null); setImagePreviewUrl(null) }}
              style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          {/* PDF attach button */}
          <label className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
            style={{ color: pdfText ? 'var(--warning)' : 'var(--color-outline)', border: '1px solid var(--border-subtle)' }}
            title={language === 'es' ? 'Adjuntar PDF' : 'Attach PDF'}>
            <span className="material-symbols-outlined text-[18px]">{pdfLoading ? 'hourglass_empty' : 'picture_as_pdf'}</span>
            <input type="file" accept="application/pdf" className="hidden" disabled={pdfLoading || loading}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setPdfLoading(true)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
                  if (res.ok) {
                    const { text } = await res.json()
                    setPdfText(text)
                    setPdfName(file.name)
                  }
                } finally {
                  setPdfLoading(false)
                  e.target.value = ''
                }
              }}
            />
          </label>
          {/* Image attach button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={loading}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all"
            style={{
              color:  imageFile ? 'var(--color-primary)' : 'var(--color-outline)',
              border: `1px solid ${imageFile ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
            }}
            title={language === 'es' ? 'Adjuntar imagen' : 'Attach image'}
          >
            <span className="material-symbols-outlined text-[18px]">image</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setImageFile(file)
              setImagePreviewUrl(URL.createObjectURL(file))
            }}
          />

          {/* Voice input */}
          {hasSpeechRecognition && (
            <button
              type="button"
              onClick={handleAIVoiceToggle}
              disabled={loading}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all relative"
              style={{
                color:  isAIRecording ? 'var(--sc-error)' : 'var(--color-outline)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: isAIRecording
                  ? 'color-mix(in srgb, var(--sc-error) 12%, transparent)'
                  : 'transparent',
              }}
              title={isAIRecording
                ? (language === 'es' ? 'Detener dictado' : 'Stop dictating')
                : (language === 'es' ? 'Dictar' : 'Dictate')}
              aria-pressed={isAIRecording}
            >
              {isAIRecording && (
                <span className="absolute inset-0 rounded-xl animate-pulse"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--sc-error) 10%, transparent)' }} />
              )}
              <span className="material-symbols-outlined text-[18px] relative z-10"
                style={{ fontVariationSettings: isAIRecording ? "'FILL' 1" : "'FILL' 0" }}>
                mic
              </span>
            </button>
          )}
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

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop: two-column ─────────────────────────────────────────── */}
      <div className="hidden md:flex rounded-2xl overflow-hidden"
        style={{
          border:          '1px solid var(--border-subtle)',
          height:          '600px',
          backgroundColor: 'var(--s-low)',
        }}>
        {/* Sidebar */}
        <div className="w-[210px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--border-subtle)' }}>
          <div className="px-3 pt-3 pb-2 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="mono text-[9px] tracking-[0.18em] uppercase font-bold"
              style={{ color: 'var(--color-outline)' }}>
              {language === 'es' ? 'Conversaciones' : 'Conversations'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5">
            <SidebarContent />
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 p-4 min-w-0 overflow-hidden">
          <ChatArea />
        </div>
      </div>

      {/* ── Mobile: chat + slide-over list ──────────────────────────────── */}
      <div className="md:hidden">
        {/* List slide-over */}
        {mobileShowList && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setMobileShowList(false)}
                className="p-1.5 rounded-lg" style={{ color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h2 className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                {language === 'es' ? 'Conversaciones' : 'Conversations'}
              </h2>
            </div>
            <div className="rounded-2xl p-4"
              style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--s-low)' }}>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Chat */}
        {!mobileShowList && (
          <div className="rounded-2xl overflow-hidden animate-fade-in"
            style={{
              border:          '1px solid var(--border-subtle)',
              backgroundColor: 'var(--s-low)',
              height:          'calc(100svh - 180px)',
              minHeight:       '480px',
            }}>
            <div className="p-4 h-full">
              <ChatArea />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
