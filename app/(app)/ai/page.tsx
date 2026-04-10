'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

const QUICK_SUGGESTIONS = ['studyPlan', 'summarize', 'examsWeek'] as const

const PLACEHOLDER_RESPONSES: Record<string, string> = {
  studyPlan: '📚 Aquí tienes un plan de estudio personalizado basado en tus materias y exámenes próximos... (respuesta placeholder)',
  summarize: '📝 He revisado tus notas y aquí hay un resumen de los puntos clave... (respuesta placeholder)',
  examsWeek: '📋 Esta semana tienes los siguientes exámenes... (respuesta placeholder)',
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function PremiumChat() {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente IA de Scholr. ¿En qué puedo ayudarte hoy?' }
  ])
  const [input, setInput] = useState('')

  const sendMessage = (text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Placeholder response
    setTimeout(() => {
      const response = PLACEHOLDER_RESPONSES[text] ||
        '🤖 Entendido. Esta función utilizará la API de IA cuando esté conectada. Por ahora es un placeholder. (respuesta de prueba)'
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    }, 800)
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'text-white' : ''}`}
              style={{
                backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: msg.role === 'user' ? 'white' : 'var(--foreground)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_SUGGESTIONS.map(key => (
          <button
            key={key}
            onClick={() => sendMessage(t(`ai.suggestions.${key}`))}
            className="badge cursor-pointer hover:opacity-80 text-xs"
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-muted)' }}
          >
            {t(`ai.suggestions.${key}`)}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('ai.placeholder')}
          className="input flex-1"
          aria-label={t('ai.placeholder')}
        />
        <button type="submit" className="btn-primary" aria-label={t('ai.send')}>↑</button>
      </form>
    </div>
  )
}

function LockedAI() {
  const { t } = useTranslation()
  return (
    <div className="card text-center py-16">
      <div className="text-6xl mb-4">🔒</div>
      <h2 className="text-xl font-bold mb-2">{t('ai.locked')}</h2>
      <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-muted)' }}>
        {t('ai.lockedDesc')}
      </p>
      <button className="btn-primary">⬆️ {t('ai.upgrade')}</button>
    </div>
  )
}

export default function AIPage() {
  const { t } = useTranslation()
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('profiles').select('is_premium').eq('id', user.id).single()
      setIsPremium(data?.is_premium || false)
      setLoading(false)
    }
    fetchProfile()
  }, [])

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">{t('ai.title')}</h1>
      {loading ? (
        <div className="skeleton h-64" />
      ) : isPremium ? (
        <div className="card">
          <PremiumChat />
        </div>
      ) : (
        <LockedAI />
      )}
    </div>
  )
}
