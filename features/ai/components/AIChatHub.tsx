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

type DotColor = 'purple' | 'green' | 'blue' | 'rose' | 'amber' | 'cyan'

interface SidebarItem {
  id: string
  dot: DotColor
  title: string
  time: string
  pinned?: boolean
}

const DOT_COLOR: Record<DotColor, string> = {
  purple: 'var(--color-tertiary)',
  green:  'var(--success)',
  blue:   'var(--color-primary)',
  rose:   'var(--danger)',
  amber:  'var(--warning)',
  cyan:   'var(--color-secondary)',
}

const MOCK_PINNED: SidebarItem[] = [
  { id: 'pin-1', dot: 'purple', title: 'Plan de estudio · Quiz MATE', time: 'Hoy · 18:41', pinned: true },
  { id: 'pin-2', dot: 'purple', title: 'Cómo entregar el Taller',     time: 'Hoy · 17:20', pinned: true },
]

const MOCK_RECENT: SidebarItem[] = [
  { id: 'rec-1', dot: 'green',  title: 'Resumen Cap. 3 Mate',         time: 'Ayer'   },
  { id: 'rec-2', dot: 'blue',   title: 'Plan de la semana',           time: 'Lun'    },
  { id: 'rec-3', dot: 'rose',   title: 'Dudas sobre TRAD',            time: '21 abr' },
  { id: 'rec-4', dot: 'amber',  title: 'Proyección de notas',         time: '20 abr' },
  { id: 'rec-5', dot: 'cyan',   title: 'Qué hacer en 30 min libres',  time: '18 abr' },
  { id: 'rec-6', dot: 'purple', title: 'Tip para Cálculo',            time: '15 abr' },
]

const INITIAL_MESSAGES: LocalMessage[] = [
  {
    role: 'assistant',
    time: '18:40',
    content:
      'Hola Sebastián. Veo que tenés el taller de Instalaciones cerrando hoy a las 23:59. ¿Querés que arme un plan rápido para terminarlo?',
  },
  {
    role: 'user',
    time: '18:41',
    content:
      'Sí, pero antes resumime el cap. 4 de Mate Financieras para el quiz de mañana.',
  },
  {
    role: 'assistant',
    time: '18:41',
    content:
      'Cap. 4 cubre anualidades vencidas y anticipadas. Tres ideas clave:\n\n1. Anualidad vencida — pagos al fin del período. VP = R · [1 – (1+i)^–n] / i.\n2. Anualidad anticipada — multiplicar la fórmula por (1+i).\n3. Diferenciar tasa nominal vs efectiva al armar las equivalencias.\n\n¿Querés que te genere 5 ejercicios tipo quiz para practicar?',
  },
]

const SUGGESTIONS = [
  { icon: 'menu_book',   label: 'Resumime el cap. 4 de MATE'        },
  { icon: 'task_alt',    label: 'Plan para terminar el taller hoy'  },
  { icon: 'quiz',        label: '5 ejercicios tipo quiz'            },
  { icon: 'event',       label: '¿Qué tengo mañana?'                },
  { icon: 'trending_up', label: '¿Cómo subo mi promedio en CALC?'   },
]

// ─── AIChatHub ────────────────────────────────────────────────────────────────

export function AIChatHub({
  language,
  ctxExtra,
}: {
  language: 'es' | 'en'
  ctxExtra: { subject_count: number; pending_task_count: number; next_exam_date: string | null } | null
}) {
  const { t } = useTranslation()

  const [messages,   setMessages]   = useState<LocalMessage[]>(INITIAL_MESSAGES)
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [activeSidebarId, setActiveSidebarId] = useState<string | null>('pin-1')
  const [mobileShowList,  setMobileShowList]  = useState(false)
  const [pdfText,         setPdfText]         = useState<string | null>(null)
  const [pdfName,         setPdfName]         = useState<string | null>(null)
  const [pdfLoading,      setPdfLoading]      = useState(false)
  const [imageFile,       setImageFile]       = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [userInitials,    setUserInitials]    = useState<string>('SS')

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

  // ── Load user initials for avatar ─────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      const fullName = prof?.full_name ?? user.email ?? ''
      const parts = fullName.trim().split(/\s+/).filter(Boolean)
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : (parts[0]?.slice(0, 2) ?? 'SS').toUpperCase()
      if (initials) setUserInitials(initials)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ── New chat: clear conversation, reset session ───────────────────────────
  const startNewChat = useCallback(() => {
    currentSessionIdRef.current = null
    setMessages([])
    setActiveSidebarId(null)
    setMobileShowList(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // ── Send message ───────────────────────────────────────────────────────────
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

      // Create session on first message (always General — no subject_id)
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
            .select()
            .single()
          if (newSess) {
            sessionId                   = newSess.id
            currentSessionIdRef.current = sessionId
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
  }, [loading, messages, language, ctxExtra, imageFile, pdfText])

  const usageText = useMemo(
    () => t('ai.messages_used').replace('{used}', '340').replace('{total}', '1,000'),
    [t]
  )

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const SidebarBody = (
    <>
      {/* Botón Nuevo chat */}
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
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
        {t('ai.new_chat')}
      </button>

      {/* FIJADOS */}
      <SidebarSection
        icon="push_pin"
        label={t('ai.pinned')}
        items={MOCK_PINNED}
        activeId={activeSidebarId}
        onSelect={(id) => { setActiveSidebarId(id); setMobileShowList(false) }}
      />

      {/* RECIENTES */}
      <SidebarSection
        icon="schedule"
        label={t('ai.recent')}
        items={MOCK_RECENT}
        activeId={activeSidebarId}
        onSelect={(id) => { setActiveSidebarId(id); setMobileShowList(false) }}
      />
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
            width:        '34%',
            height:       '100%',
            background:   'var(--color-tertiary)',
            borderRadius: 999,
          }}
        />
      </div>
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--color-outline)' }}
      >
        {usageText}
      </div>
    </div>
  )

  // ── Chat area ─────────────────────────────────────────────────────────────

  const ChatArea = (
    <div className="flex flex-col h-full min-h-0">
      {/* Mobile header (only the hamburger to open list) */}
      <div className="md:hidden flex items-center pb-2 flex-shrink-0">
        <button
          onClick={() => setMobileShowList(true)}
          className="p-1 rounded-lg"
          style={{ color: 'var(--color-outline)' }}
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '24px 24px 0 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {messages.map((msg, i) => (
            <MessageRow
              key={i}
              msg={msg}
              userInitials={userInitials}
              language={language}
            />
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 18%, transparent)' }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16, color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}
                >
                  auto_awesome
                </span>
              </div>
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
      </div>

      {/* Suggestion chips + Input */}
      <div className="flex-shrink-0" style={{ padding: '16px 24px 20px 24px' }}>
        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.label)}
              disabled={loading}
              className="inline-flex items-center gap-2 transition-colors hover:bg-[var(--s-high)]"
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
                style={{ fontSize: 14, color: 'var(--color-outline)' }}
              >
                {s.icon}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* PDF badge */}
        {pdfName && (
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--warning)' }}>picture_as_pdf</span>
            <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--on-surface)' }}>{pdfName}</span>
            <button onClick={() => { setPdfText(null); setPdfName(null) }} style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        {/* Image preview badge */}
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
            <button type="button" onClick={() => { setImageFile(null); setImagePreviewUrl(null) }} style={{ color: 'var(--color-outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        )}

        {/* Input bar */}
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
          {/* Single attach button (PDF or image) */}
          <button
            type="button"
            onClick={() => attachInputRef.current?.click()}
            disabled={loading || pdfLoading}
            className="flex items-center justify-center transition-opacity hover:opacity-70"
            style={{
              width:  36,
              height: 36,
              color:  pdfText || imageFile ? 'var(--color-tertiary)' : 'var(--color-outline)',
              background: 'transparent',
              border: 'none',
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

          {/* Text input */}
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

          {/* Voice button (pelado) */}
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

          {/* Send button (circular violeta) */}
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
      {/* Desktop: sidebar 280 + chat fluid */}
      <div
        className="hidden md:flex rounded-2xl overflow-hidden"
        style={{
          border:     '1px solid var(--border-subtle)',
          background: 'var(--s-low)',
          minHeight:  680,
        }}
      >
        {/* Sidebar */}
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

        {/* Chat */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ background: 'var(--s-base)' }}>
          {ChatArea}
        </div>
      </div>

      {/* Mobile: chat + slide-over list */}
      <div className="md:hidden">
        {mobileShowList && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setMobileShowList(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--color-outline)' }}
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
  activeId,
  onSelect,
}: {
  icon: string
  label: string
  items: SidebarItem[]
  activeId: string | null
  onSelect: (id: string) => void
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
            active={activeId === item.id}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SidebarRow({
  item,
  active,
  onClick,
}: {
  item: SidebarItem
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 transition-colors text-left"
      style={{
        padding:      '10px 12px',
        borderRadius: 10,
        background:   active ? 'color-mix(in srgb, var(--color-tertiary) 14%, transparent)' : 'transparent',
      }}
    >
      <span
        style={{
          width:        6,
          height:       6,
          borderRadius: '50%',
          background:   DOT_COLOR[item.dot],
          flexShrink:   0,
          marginTop:    7,
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 14, color: 'var(--on-surface)', lineHeight: 1.3 }}
        >
          {item.title}
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: 'var(--color-outline)', marginTop: 2 }}
        >
          {item.time}
        </div>
      </div>
      {item.pinned && (
        <span
          className="material-symbols-outlined flex-shrink-0"
          style={{
            fontSize:              14,
            color:                 'var(--color-outline)',
            marginTop:             4,
            fontVariationSettings: "'FILL' 1",
          }}
        >
          push_pin
        </span>
      )}
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
  const name = isUser ? (language === 'es' ? 'Sebastián' : 'You') : 'Skolar IA'

  if (isUser) {
    return (
      <div
        style={{
          marginLeft: 'auto',
          maxWidth:   720,
          width:      '100%',
        }}
      >
        <div className="flex items-center justify-end gap-3" style={{ marginBottom: 6 }}>
          <span
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--on-surface)' }}
          >
            {name}
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--color-outline)' }}>{time}</span>
          <UserAvatar initials={userInitials} />
        </div>
        <div
          style={{
            fontSize:    15,
            lineHeight:  1.6,
            color:       'var(--on-surface)',
            whiteSpace:  'pre-wrap',
            paddingLeft: 0,
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
        <span className="mono" style={{ fontSize: 11, color: 'var(--color-outline)', marginLeft: 'auto' }}>
          {time}
        </span>
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
        width:           32,
        height:          32,
        background:      'color-mix(in srgb, var(--color-tertiary) 22%, transparent)',
        border:          '1px solid color-mix(in srgb, var(--color-tertiary) 35%, transparent)',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{
          fontSize:              16,
          color:                 'var(--color-tertiary)',
          fontVariationSettings: "'FILL' 1",
        }}
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
