import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

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
- Horarios en 24h (HH:MM)
- Colores distintos: #6366f1 #ec4899 #f59e0b #10b981 #3b82f6 #8b5cf6 #ef4444 #06b6d4
- Icons: menu_book bar_chart calculate science history_edu language computer engineering psychology savings campaign receipt_long school
- Bloques LEC/LAB/DIS de la misma materia van en schedules de esa materia
- No inventes datos`

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
          ]
        }]
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini vision error:', err)
      return NextResponse.json({ error: 'Error al analizar la imagen' }, { status: 500 })
    }

    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse schedule error:', err)
    return NextResponse.json({ error: 'No se pudo interpretar la imagen. Intenta con una foto más clara.' }, { status: 500 })
  }
}
