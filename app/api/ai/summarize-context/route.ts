import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGroq, getText, CHAT_MODEL } from '@/features/ai/provider'

const MSG_LIMIT = 30

export async function POST(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })

  let body: { subject_id?: string; access_token?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subject_id, access_token } = body
  if (!subject_id)    return NextResponse.json({ error: 'subject_id required' }, { status: 400 })
  if (!access_token)  return NextResponse.json({ error: 'access_token required' }, { status: 401 })

  // Auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last N messages for this subject
  const { data: msgs, error: msgsError } = await supabase
    .from('subject_ai_messages')
    .select('role, content')
    .eq('subject_id', subject_id)
    .order('created_at', { ascending: false })
    .limit(MSG_LIMIT)
  if (msgsError) return NextResponse.json({ error: msgsError.message }, { status: 500 })
  if (!msgs || msgs.length === 0) return NextResponse.json({ summary: null })

  // Fetch subject name for context
  const { data: subjectData } = await supabase
    .from('subjects')
    .select('name')
    .eq('id', subject_id)
    .single()
  const subjectName = subjectData?.name ?? 'la materia'

  // Build conversation text (reversed to chronological order)
  const transcript = msgs.reverse().map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n')

  const prompt = `Eres un sistema de memoria académica. Analiza esta conversación sobre "${subjectName}" y genera un resumen conciso (máximo 300 palabras) que capture:
- Temas académicos estudiados o discutidos
- Evaluaciones, fechas o porcentajes mencionados
- Conceptos clave o dudas recurrentes
- Estrategias de estudio o preferencias del usuario

El resumen se usará como contexto en futuras conversaciones. Sé específico y útil.

CONVERSACIÓN:
${transcript}

RESUMEN:`

  try {
    const groqResp = await callGroq({
      model:       CHAT_MODEL,
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens:  500,
    })
    const summary = getText(groqResp).trim()
    if (!summary) return NextResponse.json({ summary: null })

    // Upsert into subject_ai_contexts
    await supabase.from('subject_ai_contexts').upsert({
      user_id:         user.id,
      subject_id,
      summary,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subject_id' })

    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[summarize-context]', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
