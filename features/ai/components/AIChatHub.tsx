'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppContext } from '@/features/ai/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalMessage {
  role: 'user' | 'assistant'
  content: string
  time?: string
}

interface AISession {
  id: string
  subject_id: string | null
  title: string | null
  created_at: string
  last_message_at: string
  pinned: boolean
}

interface SubjectLite {
  id: string
  name: string
  color: string
}

const MESSAGE_LIMIT_PER_MONTH = 1000

const SUGGESTIONS_ES = [
  { icon: 'calendar_today', label: '¿Qué tengo esta semana?' },
  { icon: 'school',         label: 'Próximos exámenes'        },
  { icon: 'priority_high',  label: '¿Qué es lo más urgente?'  },
  { icon: 'auto_fix_high',  label: 'Organizar mi semana'      },
  { icon: 'trending_up',    label: '¿Cómo subo mi promedio?'  },
]

const SUGGESTIONS_EN = [
  { icon: 'calendar_today', label: 'What do I have this week?' },
  { icon: 'school',         label: 'Upcoming exams'            },
  { icon: 'priority_high',  label: "What's most urgent?"       },
  { icon: 'auto_fix_high',  label: 'Organize my week'          },
  { icon: 'trending_up',    label: 'How do I raise my GPA?'    },
]

const DAY_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DAY_SHORT_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const MONTH_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTH_SHORT_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function formatRelativeTime(iso: string, lang: 'es' | 'en'): string {
  const date = new Date(iso)
  const now  = new Date()
  const sd   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((sd(now).getTime() - sd(date).getTime()) / 86_400_000)

  if (diffDays <= 0) {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return lang === 'es' ? `Hoy · ${hh}:${mm}` : `Today · ${hh}:${mm}`
  }
  if (diffDays === 1) return lang === 'es' ? 'Ayer' : 'Yesterday'
  if (diffDays < 7)   return (lang === 'es' ? DAY_SHORT_ES : DAY_SHORT_EN)[date.getDay()]
  const month = (lang === 'es' ? MONTH_SHORT_ES : MONTH_SHORT_EN)[date.getMonth()]
  return `${date.getDate()} ${month}`
}

// ─── AIChatHub ────────────────────────────────────────────────────────────────

export function AIChatHub({
  language,
  ctxExtra,
}: {
  language: 'es' | 'en'
  ctxExtra: { subject_count: number; pending_task_count: number; next_exam_date: string | null } | null
}) {
  const { t } = useTranslation()

  const [subjects,        setSubjects]        = useState<Record<string, SubjectLite>>({})
  const [sessions,        setSessions]        = useState<AISession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages,        setMessages]        = useState<LocalMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input,           setInput]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [mobileShowList,  setMobileShowList]  = useState(false)
  const [pdfText,         setPdfText]         = useState<string | null>(null)
  const [pdfName,         setPdfName]         = useState<string | null>(null)
  const [pdfLoading,      setPdfLoading]      = useState(false)
  const [imageFile,       setImageFile]       = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [userInitials,    setUserInitials]    = useState<string>('')
  const [userFirstName,   setUserFirstName]   = useState<string>('')
  const [usageCount,      setUsageCount]      = useState<number>(0)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const currentSessionIdRef = useRef<string | null>(null)
  const bottomRef           = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)
  const aiRecognitionRef    = useRef<{ stop: () => void } | null>(null)
  const attachInputRef      = useRef<HTMLInputElement>(null)
  const [isAIRecording, setIsAIRecording] = useState(false)

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const handleAIVoiceToggle = () => {
    interface VoiceRecognitionInstance {
      lang: string
      continuous: boolean
      interimResults: boolean
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
      onend: (() => void) | null
      start(): void
      stop(): void
    }
    type VoiceRecognitionCtor = new () => VoiceRecognitionInstance
    const SRCtor = (
      (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    ) as VoiceRecognitionCtor | undefined
    if (!SRCtor) return

    if (isAIRecording) {
      aiRecognitionRef.current?.stop()
      setIsAIRecording(false)
      return
    }
    const recognition = new SRCtor()
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) setInput(prev => prev ? prev + ' ' + transcript : transcript)
    }
    recognition.onend = () => setIsAIRecording(false)
    aiRecognitionRef.current = recognition
    recognition.start()
    setIsAIRecording(true)
  }

  // ── Load sessions, subjects, profile, usage count ─────────────────────────
  const refreshUsage = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('ai_session_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
    setUsageCount(count ?? 0)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    setLoadingSessions(true)
    Promise.all([
      supabase.from('ai_sessions')
        .select('id, subject_id, title, created_at, last_message_at, pinned')
        .order('pinned',          { ascending: false })
        .order('last_message_at', { ascending: false }),
      supabase.from('subjects')
        .select('id, name, color'),
      supabase.auth.getUser(),
    ]).then(async ([sessRes, subjRes, userRes]) => {
      setSessions((sessRes.data ?? []) as AISession[])

      const subjMap: Record<string, SubjectLite> = {}
      for (const s of (subjRes.data ?? [])) subjMap[s.id] = s as SubjectLite
      setSubjects(subjMap)

      const user = userRes.data.user
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        const fullName = prof?.full_name ?? user.email ?? ''
        const parts = fullName.trim().split(/\s+/).filter(Boolean)
        const initials = parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : (parts[0]?.slice(0, 2) ?? '').toUpperCase()
        if (initials) setUserInitials(initials)
        setUserFirstName(parts[0] ?? '')
      }
      setLoadingSessions(false)
    }).catch(() => setLoadingSessions(false))

    refreshUsage()
  }, [refreshUsage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── Load messages of a session ────────────────────────────────────────────
  const loadSession = useCallback(async (session: AISession) => {
    if (currentSessionIdRef.current === session.id) {
      setMobileShowList(false)
      return
    }
    currentSessionIdRef.current = session.id
    setActiveSessionId(session.id)
    setMobileShowList(false)
    setLoadingMessages(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('ai_session_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(60)
    const formatted: LocalMessage[] = (data ?? []).map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
      time:    new Date(m.created_at).toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
    }))
    setMessages(formatted)
    setLoadingMessages(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [language])

  // ── New chat: clear conversation, reset session ───────────────────────────
  const startNewChat = useCallback(() => {
    currentSessionIdRef.current = null
    setActiveSessionId(null)
    setMessages([])
    setMobileShowList(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // ── Pin / unpin ───────────────────────────────────────────────────────────
  const togglePin = useCallback(async (sessionId: string, current: boolean) => {
    const supabase = createClient()
    const next = !current
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, pinned: next } : s)
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      })
    })
    await supabase.from('ai_sessions').update({ pinned: next }).eq('id', sessionId)
  }, [])

  // ── Delete session ────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async (sessionId: string) => {
    const supabase = createClient()
    await supabase.from('ai_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setDeleteConfirmId(null)
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null
      setActiveSessionId(null)
      setMessages([])
    }
  }, [])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return

    const now = new Date().toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    const userMsg: LocalMessage = { role: 'user', content: text, time: now }
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

      let sessionId = currentSessionIdRef.current
      if (!sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: newSess } = await supabase
            .from('ai_sessions')
            .insert({
              user_id:    user.id,
              subject_id: null,
              title:      text.length > 50 ? text.slice(0, 49) + '…' : text,
            })
            .select('id, subject_id, title, created_at, last_message_at, pinned')
            .single()
          if (newSess) {
            sessionId                   = newSess.id
            currentSessionIdRef.current = sessionId
            setActiveSessionId(sessionId)
            setSessions(prev => [newSess as AISession, ...prev])
          }
        }
      }

      const app_context: AppContext = {
        current_page:       'ai',
        language,
        subject_count:      ctxExtra?.subject_count,
        pending_task_count: ctxExtra?.pending_task_count,
        next_exam_date:     ctxExtra?.next_exam_date,
      }

      const currentPdfText = pdfText
      if (pdfText) { setPdfText(null); setPdfName(null) }

      let imageBase64:    string | undefined
      let imageMediaType: string | undefined
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
      }

      const res = await fetch('/api/ai', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:      text,
          history:      messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
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
          time: now,
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
          time: now,
          content: data.error ?? (language === 'es' ? 'Error al procesar.' : 'Error processing.'),
        }])
        return
      }

      const data = await res.json()
      const assistantContent = data.reply ?? '...'
      const replyTime = new Date().toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent, time: replyTime }])

      if (sessionId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('ai_session_messages').insert([
            { session_id: sessionId, user_id: user.id, role: 'user',      content: text             },
            { session_id: sessionId, user_id: user.id, role: 'assistant', content: assistantContent },
          ])
          const nowIso = new Date().toISOString()
          await supabase.from('ai_sessions')
            .update({ last_message_at: nowIso })
            .eq('id', sessionId)
          setSessions(prev => {
            const updated = prev.map(s => s.id === sessionId ? { ...s, last_message_at: nowIso } : s)
            return [...updated].sort((a, b) => {
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
              return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            })
          })
          setUsageCount(c => c + 2)
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
  }, [loading, messages, language, ctxExtra, imageFile, pdfText])

  // ── Derived ───────────────────────────────────────────────────────────────
  const pinnedSessions   = useMemo(() => sessions.filter(s => s.pinned),  [sessions])
  const recentSessions   = useMemo(() => sessions.filter(s => !s.pinned), [sessions])
  const suggestions      = language === 'es' ? SUGGESTIONS_ES : SUGGESTIONS_EN
  const usageText        = useMemo(
    () => t('ai.messages_used')
      .replace('{used}',  usageCount.toLocaleString(language === 'es' ? 'es-ES' : 'en-US'))
      .replace('{total}', MESSAGE_LIMIT_PER_MONTH.toLocaleString(language === 'es' ? 'es-ES' : 'en-US')),
    [t, usageCount, language]
  )
  const usagePct = Math.min(100, Math.round((usageCount / MESSAGE_LIMIT_PER_MONTH) * 100))

  // ── Sidebar body ──────────────────────────────────────────────────────────

  const SidebarBody = (
    <>
      <button
        onClick={startNewChat}
        className="w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
        style={{
          background:    'var(--color-tertiary-container)',
          color:         '#fff',
          padding:       '10px 14px',
          borderRadius:  10,
          fontSize:      14,
          fontWeight:    600,
          marginBottom:  20,
          border:        'none',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        {t('ai.new_chat')}
      </button>

      {loadingSessions && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10 }} />
          ))}
        </div>
      )}

      {!loadingSessions && sessions.length === 0 && (
        <div
          style={{
            fontSize:    13,
            color:       'var(--color-outline)',
            padding:     '12px',
            lineHeight:  1.5,
            textAlign:   'center',
          }}
        >
          {language === 'es'
            ? 'Todavía no hay chats. Empezá uno arriba.'
            : 'No chats yet. Start one above.'}
        </div>
      )}

      {pinnedSessions.length > 0 && (
        <SidebarSection
          icon="push_pin"
          label={t('ai.pinned')}
          items={pinnedSessions}
          subjects={subjects}
          activeId={activeSessionId}
          deleteConfirmId={deleteConfirmId}
          language={language}
          onSelect={loadSession}
          onTogglePin={togglePin}
          onAskDelete={(id) => setDeleteConfirmId(id)}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setDeleteConfirmId(null)}
        />
      )}

      {recentSessions.length > 0 && (
        <SidebarSection
          icon="schedule"
          label={t('ai.recent')}
          items={recentSessions}
          subjects={subjects}
          activeId={activeSessionId}
          deleteConfirmId={deleteConfirmId}
          language={language}
          onSelect={loadSession}
          onTogglePin={togglePin}
          onAskDelete={(id) => setDeleteConfirmId(id)}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setDeleteConfirmId(null)}
        />
      )}
    </>
  )

  const SidebarFooter = (
    <div
      className="px-3 pt-3 pb-3 flex-shrink-0"
      style={{ borderTop: '1px solid var(--border-subtle)' }}
    >
      <div
        className="mono"
        style={{
          fontSize:       11,
          letterSpacing:  '0.12em',
          textTransform:  'uppercase',
          color:          'var(--color-outline)',
          marginBottom:   8,
        }}
      >
        {t('ai.usage_this_month')}
      </div>
      <div
        style={{
          height:       4,
          background:   'var(--s-base)',
          borderRadius: 999,
          overflow:     'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width:        `${usagePct}%`,
            height:       '100%',
            background:   usagePct >= 90 ? 'var(--danger)' : 'var(--color-tertiary)',
            borderRadius: 999,
            transition:   'width 200ms ease',
          }}
        />
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--color-outline)' }}>
        {usageText}
      </div>
    </div>
  )

  // ── Chat area ─────────────────────────────────────────────────────────────

  const ChatArea = (
    <div className="flex flex-col h-full min-h-0">
      <div className="md:hidden flex items-center pb-2 flex-shrink-0">
        <button
          onClick={() => setMobileShowList(true)}
          className="p-1 rounded-lg"
          style={{ color: 'var(--color-outline)', background: 'transparent', border: 'none' }}
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '24px 24px 0 24px' }}>
        {loadingMessages ? (
          <div className="space-y-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <EmptyChatState firstName={userFirstName} language={language} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {messages.map((msg, i) => (
              <MessageRow
                key={i}
                msg={msg}
                userInitials={userInitials || (language === 'es' ? 'TÚ' : 'YOU')}
                language={language}
              />
            ))}

            {loading && (
              <div className="flex items-center gap-3">
                <AIAvatar />
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map(d => (
                    <div
                      key={d}
                      className="rounded-full animate-bounce"
                      style={{
                        width:           6,
                        height:          6,
                        backgroundColor: 'var(--color-tertiary)',
                        animationDelay:  `${d * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0" style={{ padding: '16px 24px 20px 24px' }}>
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !loading && (
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map((s, i) => (
              <SuggestionChip key={i} icon={s.icon} label={s.label} onClick={() => sendMessage(s.label)} disabled={loading} />
            ))}
          </div>
        )}

        {pdfName && (
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--warning)' }}>picture_as_pdf</span>
            <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--on-surface)' }}>{pdfName}</span>
            <button onClick={() => { setPdfText(null); setPdfName(null) }} style={{ color: 'var(--color-outline)', background: 'transparent', border: 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        {imagePreviewUrl && (
          <div className="flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreviewUrl}
              alt="preview"
              className="rounded-lg object-cover flex-shrink-0"
              style={{ height: 36, width: 36, border: '1px solid var(--border-subtle)' }}
            />
            <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--color-secondary)' }}>
              {imageFile?.name}
            </span>
            <button type="button" onClick={() => { setImageFile(null); setImagePreviewUrl(null) }} style={{ color: 'var(--color-outline)', background: 'transparent', border: 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); sendMessage(input) }}
          className="flex items-center gap-3"
          style={{
            background:    'var(--s-low)',
            border:        '1px solid var(--border-subtle)',
            borderRadius:  14,
            padding:       '10px 12px',
          }}
        >
          <button
            type="button"
            onClick={() => attachInputRef.current?.click()}
            disabled={loading || pdfLoading}
            className="flex items-center justify-center transition-opacity hover:opacity-70"
            style={{
              width:      36,
              height:     36,
              color:      pdfText || imageFile ? 'var(--color-tertiary)' : 'var(--color-outline)',
              background: 'transparent',
              border:     'none',
            }}
            title={language === 'es' ? 'Adjuntar' : 'Attach'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {pdfLoading ? 'hourglass_empty' : 'attach_file'}
            </span>
          </button>
          <input
            ref={attachInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={loading || pdfLoading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              if (file.type === 'application/pdf') {
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
              } else if (file.type.startsWith('image/')) {
                setImageFile(file)
                setImagePreviewUrl(URL.createObjectURL(file))
                e.target.value = ''
              }
            }}
          />

          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('ai.placeholder_ask')}
            disabled={loading}
            style={{
              flex:       1,
              background: 'transparent',
              border:     'none',
              outline:    'none',
              fontSize:   15,
              color:      'var(--on-surface)',
            }}
          />

          {hasSpeechRecognition && (
            <button
              type="button"
              onClick={handleAIVoiceToggle}
              disabled={loading}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{
                width:      36,
                height:     36,
                color:      isAIRecording ? 'var(--danger)' : 'var(--color-outline)',
                background: 'transparent',
                border:     'none',
              }}
              title={isAIRecording
                ? (language === 'es' ? 'Detener dictado' : 'Stop dictating')
                : (language === 'es' ? 'Dictar' : 'Dictate')}
              aria-pressed={isAIRecording}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, fontVariationSettings: isAIRecording ? "'FILL' 1" : "'FILL' 0" }}
              >
                graphic_eq
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center justify-center transition-opacity"
            style={{
              width:        40,
              height:       40,
              borderRadius: '50%',
              background:   'var(--color-tertiary-container)',
              color:        '#fff',
              border:       'none',
              opacity:      (!input.trim() || loading) ? 0.5 : 1,
              cursor:       (!input.trim() || loading) ? 'not-allowed' : 'pointer',
            }}
            aria-label={t('ai.send')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_upward</span>
          </button>
        </form>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop */}
      <div
        className="hidden md:flex rounded-2xl overflow-hidden"
        style={{
          border:     '1px solid var(--border-subtle)',
          background: 'var(--s-low)',
          minHeight:  680,
        }}
      >
        <aside
          className="flex flex-col flex-shrink-0"
          style={{
            width:        280,
            borderRight:  '1px solid var(--border-subtle)',
            background:   'var(--s-low)',
          }}
        >
          <div className="flex-1 overflow-y-auto" style={{ padding: '20px 16px' }}>
            {SidebarBody}
          </div>
          {SidebarFooter}
        </aside>

        <div className="flex-1 min-w-0 flex flex-col" style={{ background: 'var(--s-base)' }}>
          {ChatArea}
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {mobileShowList && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setMobileShowList(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--color-outline)', background: 'transparent', border: 'none' }}
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <h2 className="text-sm font-bold" style={{ color: 'var(--on-surface)' }}>
                {t('ai.title')}
              </h2>
            </div>
            <div
              className="rounded-2xl flex flex-col"
              style={{
                border:     '1px solid var(--border-subtle)',
                background: 'var(--s-low)',
                minHeight:  '60vh',
              }}
            >
              <div className="flex-1 overflow-y-auto" style={{ padding: '20px 16px' }}>
                {SidebarBody}
              </div>
              {SidebarFooter}
            </div>
          </div>
        )}

        {!mobileShowList && (
          <div
            className="rounded-2xl overflow-hidden animate-fade-in flex flex-col"
            style={{
              border:     '1px solid var(--border-subtle)',
              background: 'var(--s-base)',
              height:     'calc(100svh - 200px)',
              minHeight:  520,
            }}
          >
            {ChatArea}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Sidebar helpers ─────────────────────────────────────────────────────────

function SidebarSection({
  icon,
  label,
  items,
  subjects,
  activeId,
  deleteConfirmId,
  language,
  onSelect,
  onTogglePin,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  icon: string
  label: string
  items: AISession[]
  subjects: Record<string, SubjectLite>
  activeId: string | null
  deleteConfirmId: string | null
  language: 'es' | 'en'
  onSelect: (s: AISession) => void
  onTogglePin: (id: string, current: boolean) => void
  onAskDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="mono flex items-center gap-1.5"
        style={{
          fontSize:       11,
          letterSpacing:  '0.12em',
          textTransform:  'uppercase',
          color:          'var(--color-outline)',
          marginBottom:   8,
          paddingLeft:    4,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
        {label}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map(item => (
          <SidebarRow
            key={item.id}
            item={item}
            subjects={subjects}
            active={activeId === item.id}
            isAskingDelete={deleteConfirmId === item.id}
            language={language}
            onClick={() => onSelect(item)}
            onTogglePin={() => onTogglePin(item.id, item.pinned)}
            onAskDelete={() => onAskDelete(item.id)}
            onConfirmDelete={() => onConfirmDelete(item.id)}
            onCancelDelete={onCancelDelete}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarRow({
  item,
  subjects,
  active,
  isAskingDelete,
  language,
  onClick,
  onTogglePin,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  item: AISession
  subjects: Record<string, SubjectLite>
  active: boolean
  isAskingDelete: boolean
  language: 'es' | 'en'
  onClick: () => void
  onTogglePin: () => void
  onAskDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const subject = item.subject_id ? subjects[item.subject_id] : null
  const dotColor = subject?.color || 'var(--color-tertiary)'
  const time = formatRelativeTime(item.last_message_at, language)
  const title = item.title?.trim() || (language === 'es' ? 'Sin título' : 'Untitled')

  if (isAskingDelete) {
    return (
      <div
        className="flex items-center gap-2"
        style={{
          padding:      '10px 12px',
          borderRadius: 10,
          background:   'color-mix(in srgb, var(--danger) 12%, transparent)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--on-surface)', flex: 1 }}>
          {language === 'es' ? '¿Eliminar?' : 'Delete?'}
        </span>
        <button
          onClick={onConfirmDelete}
          style={{
            fontSize:     11,
            fontWeight:   700,
            padding:      '4px 8px',
            borderRadius: 6,
            background:   'var(--danger)',
            color:        '#fff',
            border:       'none',
          }}
        >
          {language === 'es' ? 'Sí' : 'Yes'}
        </button>
        <button
          onClick={onCancelDelete}
          style={{
            fontSize:     11,
            padding:      '4px 8px',
            borderRadius: 6,
            background:   'var(--s-base)',
            color:        'var(--color-outline)',
            border:       'none',
          }}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <div
      className="group relative w-full flex items-start gap-2.5 transition-colors text-left"
      style={{
        padding:      '10px 12px',
        borderRadius: 10,
        background:   active ? 'color-mix(in srgb, var(--color-tertiary) 14%, transparent)' : 'transparent',
        cursor:       'pointer',
      }}
      onClick={onClick}
      role="button"
    >
      <span
        style={{
          width:        6,
          height:       6,
          borderRadius: '50%',
          background:   dotColor,
          flexShrink:   0,
          marginTop:    7,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 14, color: 'var(--on-surface)', lineHeight: 1.3 }}
        >
          {title}
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: 'var(--color-outline)', marginTop: 2 }}
        >
          {time}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin() }}
          className={item.pinned ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}
          style={{
            color:                 item.pinned ? 'var(--color-tertiary)' : 'var(--color-outline)',
            background:            'transparent',
            border:                'none',
            padding:               2,
            cursor:                'pointer',
          }}
          title={item.pinned ? (language === 'es' ? 'Desfijar' : 'Unpin') : (language === 'es' ? 'Fijar' : 'Pin')}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 14, fontVariationSettings: item.pinned ? "'FILL' 1" : "'FILL' 0" }}
          >
            push_pin
          </span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAskDelete() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--danger)', background: 'transparent', border: 'none', padding: 2, cursor: 'pointer' }}
          title={language === 'es' ? 'Eliminar' : 'Delete'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyChatState({ firstName, language }: { firstName: string; language: 'es' | 'en' }) {
  const greeting = firstName
    ? (language === 'es' ? `Hola, ${firstName}.` : `Hi, ${firstName}.`)
    : (language === 'es' ? 'Hola.' : 'Hi.')
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 320, gap: 16 }}>
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width:      56,
          height:     56,
          background: 'color-mix(in srgb, var(--color-tertiary) 18%, transparent)',
          border:     '1px solid color-mix(in srgb, var(--color-tertiary) 35%, transparent)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 26, color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}
        >
          auto_awesome
        </span>
      </div>
      <div>
        <div style={{ fontSize: 22, color: 'var(--on-surface)', marginBottom: 4 }}>
          <em className="serif">{greeting}</em>
        </div>
        <div style={{ fontSize: 14, color: 'var(--on-surface-variant)', maxWidth: 460 }}>
          {language === 'es'
            ? 'Soy tu copiloto académico. Puedo ayudarte con tu agenda, exámenes, apuntes y tareas.'
            : 'I’m your academic copilot. I can help with your schedule, exams, notes and tasks.'}
        </div>
      </div>
    </div>
  )
}

// ─── Suggestion chip ─────────────────────────────────────────────────────────

function SuggestionChip({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 transition-colors"
      style={{
        background:    'var(--s-low)',
        border:        '1px solid var(--border-subtle)',
        padding:       '8px 14px',
        borderRadius:  999,
        fontSize:      13,
        color:         'var(--on-surface)',
        cursor:        disabled ? 'not-allowed' : 'pointer',
        opacity:       disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--s-high)' }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--s-low)' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--color-outline)' }}>
        {icon}
      </span>
      {label}
    </button>
  )
}

// ─── Message renderer (no bubbles) ──────────────────────────────────────────

function MessageRow({
  msg,
  userInitials,
  language,
}: {
  msg: LocalMessage
  userInitials: string
  language: 'es' | 'en'
}) {
  const isUser = msg.role === 'user'
  const time = msg.time ?? new Date().toLocaleTimeString(language === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const name = isUser ? (language === 'es' ? 'Tú' : 'You') : 'Skolar IA'

  if (isUser) {
    return (
      <div style={{ marginLeft: 'auto', maxWidth: 720, width: '100%' }}>
        <div className="flex items-center justify-end gap-3" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>{name}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-outline)' }}>{time}</span>
          <UserAvatar initials={userInitials} />
        </div>
        <div
          style={{
            fontSize:    15,
            lineHeight:  1.6,
            color:       'var(--on-surface)',
            whiteSpace:  'pre-wrap',
            textAlign:   'left',
          }}
        >
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 6 }}>
        <AIAvatar />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}>{name}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-outline)', marginLeft: 'auto' }}>{time}</span>
      </div>
      <div
        style={{
          fontSize:    15,
          lineHeight:  1.6,
          color:       'var(--on-surface)',
          whiteSpace:  'pre-wrap',
          paddingLeft: 44,
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

function AIAvatar() {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width:      32,
        height:     32,
        background: 'color-mix(in srgb, var(--color-tertiary) 22%, transparent)',
        border:     '1px solid color-mix(in srgb, var(--color-tertiary) 35%, transparent)',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 16, color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}
      >
        auto_awesome
      </span>
    </div>
  )
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width:      32,
        height:     32,
        background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)',
        border:     '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
        color:      'var(--color-primary)',
        fontSize:   12,
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  )
}
