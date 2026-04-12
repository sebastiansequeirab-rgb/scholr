import { NextRequest, NextResponse } from 'next/server'
import { VISION_MODEL } from '@/lib/ai/provider'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const prompt = `Analiza esta imagen de un horario académico y extrae EXACTAMENTE la información visible.

Devuelve ÚNICAMENTE un JSON válido (sin markdown, sin texto extra):
{
  "subjects": [
    {
      "name": "nombre exacto",
      "professor": "código y sección si aparece o null",
      "color": "#6366f1",
      "icon": "menu_book",
      "schedules": [
        { "day_of_week": 1, "start_time": "14:00", "end_time": "15:30", "room": "aula o null" }
      ]
    }
  ]
}

Reglas:
- day_of_week: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
- Horarios en 24h HH:MM
- Colores distintos: #6366f1 #ec4899 #f59e0b #10b981 #3b82f6 #8b5cf6 #ef4444 #06b6d4
- Icons: menu_book bar_chart calculate science history_edu language computer engineering psychology savings campaign receipt_long school
- Bloques LEC/LAB/DIS de la misma materia van en schedules de esa materia
- No inventes datos`

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
        temperature: 0.1,
        max_tokens:  2048,
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
