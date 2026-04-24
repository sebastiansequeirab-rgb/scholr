import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VISION_MODEL, CHAT_MODEL } from '@/features/ai/provider'
import { EVAL_PROMPT } from '@/features/ai/prompts/evaluationParsePrompt'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  try {
    const { imageBase64, mimeType, text } = await req.json()

    if (!imageBase64 && !text) {
      return NextResponse.json({ error: 'Se requiere imagen o texto' }, { status: 400 })
    }

    const model = imageBase64 ? VISION_MODEL : CHAT_MODEL

    const userContent = imageBase64
      ? [
          { type: 'text', text: EVAL_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
        ]
      : `${EVAL_PROMPT}\n\nContenido a analizar:\n\n${text}`

    const res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.05,
        max_tokens:  4096,
      }),
    })

    if (res.status === 429) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Espera un momento.' }, { status: 429 })
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = (err as { error?: { message?: string } })?.error?.message || res.statusText
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const data    = await res.json()
    const raw     = data.choices?.[0]?.message?.content || ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse evaluations error:', err)
    return NextResponse.json({ error: 'No se pudo interpretar el contenido.' }, { status: 500 })
  }
}
