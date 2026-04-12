import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages } = await req.json()

    // Fetch user context
    const [{ data: subjects }, { data: exams }, { data: tasks }] = await Promise.all([
      supabase.from('subjects').select('name, professor, color').eq('user_id', user.id),
      supabase.from('exams').select('title, exam_date, activity_type, percentage').eq('user_id', user.id).gte('exam_date', new Date().toISOString().split('T')[0]).order('exam_date').limit(10),
      supabase.from('tasks').select('title, due_date, priority, status').eq('user_id', user.id).neq('status', 'done').order('due_date').limit(10),
    ])

    const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const systemPrompt = `Eres el asistente académico de Scholr Sanctuary, una app de organización universitaria. Eres útil, conciso y amigable.

Hoy es: ${today}

MATERIAS DEL ESTUDIANTE:
${subjects?.map(s => `- ${s.name}${s.professor ? ` (${s.professor})` : ''}`).join('\n') || 'Sin materias registradas'}

PRÓXIMAS ACTIVIDADES:
${exams?.map(e => `- ${e.title} | ${e.exam_date}${e.percentage ? ` | ${e.percentage}%` : ''}`).join('\n') || 'Sin actividades próximas'}

TAREAS PENDIENTES:
${tasks?.map(t => `- ${t.title} | Prioridad: ${t.priority}${t.due_date ? ` | Vence: ${t.due_date}` : ''}`).join('\n') || 'Sin tareas pendientes'}

Responde siempre en el idioma en que te hablen. Sé directo y útil. No inventes datos que no estén en el contexto.`

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    })

    // Build history (all except last message)
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1].content
    const result = await chat.sendMessage(lastMessage)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (err) {
    console.error('AI route error:', err)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
