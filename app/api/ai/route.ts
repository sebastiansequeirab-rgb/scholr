import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  try {
    const { messages, context } = await req.json()
    if (!messages?.length) return NextResponse.json({ error: 'No messages provided' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(apiKey)
    const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const systemPrompt = `Eres el asistente académico de Scholr Sanctuary, una app de organización universitaria. Eres útil, conciso y amigable.

Hoy es: ${today}

${context?.subjects?.length ? `MATERIAS:\n${context.subjects.map((s: { name: string; professor?: string }) => `- ${s.name}${s.professor ? ` (${s.professor})` : ''}`).join('\n')}` : ''}

${context?.exams?.length ? `\nPRÓXIMAS ACTIVIDADES:\n${context.exams.map((e: { title: string; exam_date: string; percentage?: number }) => `- ${e.title} | ${e.exam_date}${e.percentage ? ` | ${e.percentage}%` : ''}`).join('\n')}` : ''}

${context?.tasks?.length ? `\nTAREAS PENDIENTES:\n${context.tasks.map((t: { title: string; priority: string; due_date?: string }) => `- ${t.title} | Prioridad: ${t.priority}${t.due_date ? ` | Vence: ${t.due_date}` : ''}`).join('\n')}` : ''}

Responde en el idioma en que te hablen. Sé directo y útil.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    })

    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(messages[messages.length - 1].content)
    return NextResponse.json({ reply: result.response.text() })
  } catch (err) {
    console.error('AI route error:', err)
    return NextResponse.json({ error: 'Error procesando solicitud' }, { status: 500 })
  }
}
