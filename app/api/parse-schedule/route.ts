import { NextRequest, NextResponse } from 'next/server'
import { VISION_MODEL } from '@/lib/ai/provider'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const prompt = `Eres un extractor preciso de horarios académicos. Analiza la imagen y extrae CADA bloque horario visible.

PROCESO OBLIGATORIO — sigue estos pasos en orden:
1. Identifica la estructura de la tabla: ¿las columnas son días o las filas son días?
2. Lee los encabezados de columnas y filas para mapear días y horas exactas.
3. Para CADA celda no vacía: determina a qué día (columna) y rango horario (fila) corresponde.
4. Agrupa los bloques de la misma materia (aunque tengan distintos días/horas).
5. Verifica que ningún bloque se solape con otro de la misma materia.
6. Si hay bloques LEC, LAB o DIS de la misma materia, agrúpalos todos bajo esa materia.

REGLAS CRÍTICAS para horarios:
- Lee hora_inicio y hora_fin directamente de los encabezados de fila, NO los inventes.
- Si la tabla muestra "7:00 – 8:30", start_time="07:00" end_time="08:30" EXACTAMENTE.
- Si ves "7:00" como inicio de fila y la siguiente fila es "8:30", ese bloque dura 1h30.
- NUNCA asumas duraciones estándar; siempre lee los valores reales de la imagen.
- Si una celda abarca múltiples filas horarias, la duración es desde la primera hasta la última fila.
- day_of_week: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb

VALIDACIÓN antes de responder:
- ¿Cada bloque tiene un día específico (0-6)?
- ¿Los horarios tienen formato HH:MM en 24h?
- ¿start_time < end_time para todos los bloques?
- ¿No hay duplicados del mismo bloque?
Si algo es ambiguo, omítelo antes que inventarlo.

Devuelve ÚNICAMENTE este JSON válido (sin markdown, sin texto extra):
{
  "subjects": [
    {
      "name": "nombre exacto de la materia",
      "professor": "código, sección o nombre del profesor si aparece, si no null",
      "color": "#6366f1",
      "icon": "menu_book",
      "schedules": [
        { "day_of_week": 1, "start_time": "14:00", "end_time": "15:30", "room": "aula/salón o null" }
      ]
    }
  ]
}

Colores disponibles (asigna uno distinto a cada materia):
#6366f1 #ec4899 #f59e0b #10b981 #3b82f6 #8b5cf6 #ef4444 #06b6d4 #84cc16 #f97316

Icons disponibles:
menu_book bar_chart calculate science history_edu language computer engineering psychology savings campaign receipt_long school`

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
