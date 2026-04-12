'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedSchedule {
  subjects: {
    name: string
    professor: string | null
    color: string
    icon: string
    schedules: {
      day_of_week: number
      start_time: string
      end_time: string
      room: string | null
    }[]
  }[]
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface UserContext {
  subjects: { name: string; professor: string | null }[]
  exams:    { title: string; exam_date: string; percentage: number | null }[]
  tasks:    { title: string; priority: string; due_date: string | null }[]
}

export default function AIPage() {
  const { language } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: language === 'es'
        ? '¡Hola! Soy tu asistente académico. Tengo acceso a tus materias, actividades y tareas. ¿En qué puedo ayudarte?'
        : "Hi! I'm your academic assistant. I have access to your subjects, activities and tasks. How can I help?" }
  ])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [userContext, setUserContext] = useState<UserContext | null>(null)

  // Schedule import
  const [tab,          setTab]          = useState<'chat' | 'import'>('chat')
  const [imageFile,    setImageFile]    = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [parsing,      setParsing]      = useState(false)
  const [parsed,       setParsed]       = useState<ParsedSchedule | null>(null)
  const [parseError,   setParseError]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const [saveSuccess,  setSaveSuccess]  = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)

  // Load user context once on mount
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const now = new Date().toISOString().split('T')[0]
      const [{ data: subjects }, { data: exams }, { data: tasks }] = await Promise.all([
        supabase.from('subjects').select('name, professor').eq('user_id', user.id),
        supabase.from('exams').select('title, exam_date, percentage').eq('user_id', user.id).gte('exam_date', now).order('exam_date').limit(10),
        supabase.from('tasks').select('title, priority, due_date').eq('user_id', user.id).neq('status', 'done').order('due_date').limit(10),
      ])
      setUserContext({ subjects: subjects || [], exams: exams || [], tasks: tasks || [] })
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg], context: userContext }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || data.error || 'Error al obtener respuesta.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, userContext])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setParsed(null)
    setParseError('')
    setSaveSuccess(false)
  }

  const handleParse = async () => {
    if (!imageFile) return
    setParsing(true)
    setParseError('')
    setParsed(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(imageFile)
      })
      const res = await fetch('/api/parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: imageFile.type }),
      })
      const data = await res.json()
      if (data.error) { setParseError(data.error); return }
      setParsed(data)
    } catch {
      setParseError('Error al procesar la imagen.')
    } finally {
      setParsing(false)
    }
  }

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // Delete existing subjects + schedules
    const { data: existingSubjects } = await supabase.from('subjects').select('id').eq('user_id', user.id)
    if (existingSubjects?.length) {
      await supabase.from('schedules').delete().eq('user_id', user.id)
      await supabase.from('subjects').delete().eq('user_id', user.id)
    }

    // Insert new subjects + schedules
    for (const s of parsed.subjects) {
      const { data: inserted } = await supabase.from('subjects').insert({
        user_id: user.id, name: s.name, professor: s.professor,
        color: s.color, icon: s.icon,
      }).select('id').single()
      if (!inserted) continue
      for (const sch of s.schedules) {
        await supabase.from('schedules').insert({
          user_id: user.id, subject_id: inserted.id,
          day_of_week: sch.day_of_week,
          start_time: sch.start_time,
          end_time: sch.end_time,
          room: sch.room,
        })
      }
    }
    setSaving(false)
    setSaveSuccess(true)
    setParsed(null)
    setImageFile(null)
    setImagePreview(null)
  }

  const SUGGESTIONS = language === 'es'
    ? ['¿Cuándo es mi próximo examen?', '¿Qué tareas tengo pendientes?', 'Dame un plan de estudio para esta semana', '¿Cómo organizo mis materias?']
    : ['When is my next exam?', 'What tasks do I have pending?', 'Give me a study plan for this week', 'How should I organize my subjects?']

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

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--s-base)' }}>
          <button onClick={() => setTab('chat')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: tab === 'chat' ? 'var(--s-high)' : 'transparent',
              color: tab === 'chat' ? 'var(--on-surface)' : 'var(--color-outline)',
            }}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">chat</span>
              {language === 'es' ? 'Chat' : 'Chat'}
            </span>
          </button>
          <button onClick={() => setTab('import')}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: tab === 'import' ? 'var(--s-high)' : 'transparent',
              color: tab === 'import' ? 'var(--on-surface)' : 'var(--color-outline)',
            }}>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              {language === 'es' ? 'Importar horario' : 'Import schedule'}
            </span>
          </button>
        </div>
      </div>

      {/* ─── CHAT TAB ─── */}
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
                <div
                  className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === 'user'
                      ? 'var(--color-primary)'
                      : 'var(--s-base)',
                    color: msg.role === 'user' ? 'white' : 'var(--on-surface)',
                    borderBottomRightRadius: msg.role === 'user' ? '4px' : undefined,
                    borderBottomLeftRadius:  msg.role === 'assistant' ? '4px' : undefined,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-tertiary) 15%, transparent)' }}>
                  <span className="material-symbols-outlined text-[14px]"
                    style={{ color: 'var(--color-tertiary)', fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
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
                <button key={i} onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all hover:border-[var(--color-primary)]"
                  style={{ color: 'var(--color-outline)', borderColor: 'var(--border-default)', backgroundColor: 'var(--s-base)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
              <input
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

      {/* ─── IMPORT TAB ─── */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--s-low)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--on-surface-variant)' }}>
              {language === 'es'
                ? 'Sube una foto o captura de pantalla de tu horario universitario. La IA extrae las materias y bloques automáticamente.'
                : 'Upload a photo or screenshot of your university schedule. AI will extract subjects and time blocks automatically.'}
            </p>

            {/* Upload zone */}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {!imagePreview ? (
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-3 transition-all hover:border-[var(--color-primary)]"
                style={{ borderColor: 'var(--border-default)', color: 'var(--color-outline)' }}>
                <span className="material-symbols-outlined text-[40px]" style={{ color: 'var(--color-outline)' }}>add_photo_alternate</span>
                <span className="text-sm font-medium">
                  {language === 'es' ? 'Toca para subir imagen' : 'Tap to upload image'}
                </span>
                <span className="text-xs" style={{ color: 'var(--border-strong)' }}>JPG, PNG, WEBP</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden">
                  <img src={imagePreview} alt="Schedule preview" className="w-full max-h-64 object-contain rounded-xl"
                    style={{ backgroundColor: 'var(--s-base)' }} />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); setParsed(null); setParseError(''); setSaveSuccess(false) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--s-high)', color: 'var(--color-outline)' }}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                <button onClick={handleParse} disabled={parsing}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {parsing ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      {language === 'es' ? 'Analizando...' : 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                      {language === 'es' ? 'Analizar con IA' : 'Analyze with AI'}
                    </>
                  )}
                </button>
              </div>
            )}

            {parseError && (
              <p className="mt-3 text-xs px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--priority-high-bg)', color: 'var(--danger)' }}>
                {parseError}
              </p>
            )}

            {saveSuccess && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-sm font-medium">
                  {language === 'es' ? 'Horario importado correctamente' : 'Schedule imported successfully'}
                </span>
              </div>
            )}
          </div>

          {/* Preview of parsed schedule */}
          {parsed && parsed.subjects.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--s-low)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--on-surface)' }}>
                    {language === 'es' ? `${parsed.subjects.length} materia${parsed.subjects.length !== 1 ? 's' : ''} detectada${parsed.subjects.length !== 1 ? 's' : ''}` : `${parsed.subjects.length} subject${parsed.subjects.length !== 1 ? 's' : ''} detected`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>
                    {language === 'es' ? 'Revisa antes de importar — reemplazará tus materias actuales' : 'Review before importing — will replace your current subjects'}
                  </p>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {parsed.subjects.map((s, i) => (
                  <div key={i} className="px-5 py-4 flex items-start gap-3"
                    style={{ backgroundColor: 'var(--s-base)' }}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${s.color}18` }}>
                      <span className="material-symbols-outlined text-[17px]"
                        style={{ color: s.color, fontVariationSettings: "'FILL' 1" }}>
                        {s.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug" style={{ color: 'var(--on-surface)' }}>{s.name}</p>
                      {s.professor && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-outline)' }}>{s.professor}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.schedules.map((sch, j) => (
                          <span key={j} className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${s.color}12`, color: s.color }}>
                            {DAY_NAMES[sch.day_of_week]} {sch.start_time}–{sch.end_time}
                            {sch.room && ` · ${sch.room}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 flex gap-3" style={{ backgroundColor: 'var(--s-low)', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={() => { setParsed(null); setImageFile(null); setImagePreview(null) }}
                  className="btn-secondary flex-1">
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                      {language === 'es' ? 'Guardando...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>
                      {language === 'es' ? 'Importar horario' : 'Import schedule'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
