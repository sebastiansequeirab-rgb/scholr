import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  try {
    const { messages, context } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

    const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const systemText = `Eres el asistente académico de Scholr Sanctuary. Eres útil, conciso y amigable. Hoy es: ${today}.
${context?.subjects?.length ? `\nMATERIAS:\n${context.subjects.map((s: { name: string; professor?: string }) => `- ${s.name}${s.professor ? ` (${s.professor})` : ''}`).join('\n')}` : ''}
${context?.exams?.length ? `\nPRÓXIMAS ACTIVIDADES:\n${context.exams.map((e: { title: string; exam_date: string; percentage?: number }) => `- ${e.title} | ${e.exam_date}${e.percentage ? ` | ${e.percentage}%` : ''}`).join('\n')}` : ''}
${context?.tasks?.length ? `\nTAREAS PENDIENTES:\n${context.tasks.map((t: { title: string; priority: string; due_date?: string }) => `- ${t.title} | Prioridad: ${t.priority}${t.due_date ? ` | Vence: ${t.due_date}` : ''}`).join('\n')}` : ''}
Responde en el idioma en que te hablen.`

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const body = {
      system_instruction: { parts: [{ text: systemText }] },
      contents,
    }

    const tryFetch = async (attempt: number): Promise<NextResponse> => {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.status === 429 && attempt < 3) {
        const err = await res.json().catch(() => ({}))
        const retryMatch = JSON.stringify(err).match(/retry in ([\d.]+)s/)
        const waitMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) * 1000 : 5000
        await new Promise(r => setTimeout(r, waitMs))
        return tryFetch(attempt + 1)
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        const msg = err?.error?.message || JSON.stringify(err)
        console.error('Gemini error:', msg)
        return NextResponse.json({ error: `Gemini: ${msg}` }, { status: 500 })
      }

      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta'
      return NextResponse.json({ reply })
    }

    return await tryFetch(0)
  } catch (err) {
    console.error('AI route error:', err)
    return NextResponse.json({ error: 'Error procesando solicitud' }, { status: 500 })
  }
}
