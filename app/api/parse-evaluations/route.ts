import { NextRequest, NextResponse } from 'next/server'
import { VISION_MODEL, CHAT_MODEL } from '@/lib/ai/provider'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const EVAL_PROMPT = `Eres un extractor preciso de planes de evaluación académicos.
Analiza el contenido y extrae CADA evaluación mencionada.

Para cada evaluación devuelve estos campos:
- title: nombre exacto de la evaluación
- subject_hint: nombre o código de la materia si aparece, si no null
- exam_date: fecha en formato YYYY-MM-DD si aparece explícitamente, null si no
- exam_time: hora en HH:MM (24h) si aparece, null si no
- percentage: número entero 0-100 si aparece explícitamente, null si no
- activity_type: clasifica según estas reglas EXACTAS:
  * "examen", "parcial", "prueba", "test", "final", "evaluación escrita", "evaluación teórica" → "exam"
  * "taller", "práctica", "laboratorio", "lab", "práctica de laboratorio" → "workshop"
  * "actividad", "quiz", "ejercicio", "participación", "foro", "debate" → "activity"
  * "tarea", "entrega", "informe", "ensayo", "presentación", "exposición", "proyecto", "trabajo escrito", "trabajo final" → "task"
  * "sesión de estudio", "repaso", "preparación", "revisión" → "study_session"
- location: lugar o aula si aparece explícitamente, null si no
- notes: instrucciones relevantes si aparecen, null si no

REGLAS CRÍTICAS:
- NUNCA inventes fechas, porcentajes ni pesos. Solo usa los que aparecen literalmente.
- Si un porcentaje aparece como "30%", devuelve el número 30 (entero, no string).
- Si hay múltiples evaluaciones por materia, crea UNA entrada por evaluación.
- Si detectas que dos entradas son la misma evaluación con nombres distintos, inclúyela solo una vez.
- Si una evaluación no tiene materia identificable, devuelve subject_hint como null.

Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra, sin comentarios):
{
  "evaluations": [
    {
      "title": "Nombre exacto de la evaluación",
      "subject_hint": "Nombre de materia o null",
      "exam_date": "YYYY-MM-DD o null",
      "exam_time": "HH:MM o null",
      "percentage": 30,
      "activity_type": "exam",
      "location": "Aula o null",
      "notes": "Instrucciones o null"
    }
  ]
}`

export async function POST(req: NextRequest) {
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
