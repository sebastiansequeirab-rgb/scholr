import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Analiza esta imagen de un horario académico universitario y extrae EXACTAMENTE la información visible.

Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin markdown, sin explicaciones):
{
  "subjects": [
    {
      "name": "nombre exacto de la materia",
      "professor": "código y sección si aparece, ej: CS101 · Sec 2",
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
- day_of_week: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
- Horarios en formato 24h (HH:MM)
- Colores: asigna colores distintos y atractivos en hex (#6366f1, #ec4899, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444, #06b6d4)
- Icons: usa uno de estos según la materia: menu_book, bar_chart, calculate, science, history_edu, language, computer, engineering, psychology, savings, campaign, receipt_long, school
- Si la misma materia tiene varios bloques (LEC, LAB, DIS), inclúyelos todos en el array schedules de ESA materia
- NO inventes datos que no estén en la imagen
- Si un campo no está visible, usa null`

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
    ])

    const raw = result.response.text().trim()
    // Strip markdown code blocks if present
    const jsonStr = raw.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Parse schedule error:', err)
    return NextResponse.json({ error: 'No se pudo interpretar la imagen. Intenta con una foto más clara.' }, { status: 500 })
  }
}
