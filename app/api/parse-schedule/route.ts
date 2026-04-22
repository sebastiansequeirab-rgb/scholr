import { NextRequest, NextResponse } from 'next/server'
import { VISION_MODEL } from '@/features/ai/provider'
import { SUBJECT_COLORS } from '@/types'
import { buildScheduleParsePrompt } from '@/features/ai/prompts/scheduleParsePrompt'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const colorPalette = SUBJECT_COLORS.join(' ')

    const today = new Date()
    const currentYear = today.getFullYear()
    const todayStr = today.toISOString().slice(0, 10)

    const prompt = buildScheduleParsePrompt({ todayStr, currentYear, colorPalette })

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
              },
            },
          ],
        }],
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

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content || ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse schedule error:', err)
    return NextResponse.json({ error: 'No se pudo interpretar la imagen.' }, { status: 500 })
  }
}
