import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  try {
    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Analiza esta imagen de un horario académico universitario y extrae EXACTAMENTE la información visible.

Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin markdown, sin explicaciones, sin texto extra):
{
  "subjects": [
    {
      "name": "nombre exacto de la materia",
      "professor": "código y sección si aparece, ej: CS101 · Sec 2, o null",
      "color": "#6366f1",
      "icon": "menu_book",
      "schedules": [
        {
          "day_of_week": 1,
          "start_time": "14:00",
          "end_time": "15:30",
          "room": "aula si aparece o null"
        }
      ]
    }
  ]
}

Reglas:
- day_of_week: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb
- Horarios en formato 24h HH:MM
- Colores distintos para cada materia: #6366f1 #ec4899 #f59e0b #10b981 #3b82f6 #8b5cf6 #ef4444 #06b6d4
- Icons (elige el más apropiado): menu_book bar_chart calculate science history_edu language computer engineering psychology savings campaign receipt_long school
- Si la misma materia tiene varios bloques (LEC, LAB, DIS), ponlos todos en schedules de esa materia
- NO inventes datos que no veas en la imagen`

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
    ])

    const raw = result.response.text().trim()
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse schedule error:', err)
    return NextResponse.json({ error: 'No se pudo interpretar la imagen. Intenta con una foto más clara.' }, { status: 500 })
  }
}
