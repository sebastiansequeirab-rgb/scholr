import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGroq, getText, getToolCall, CHAT_MODEL } from '@/lib/ai/provider'
import { TOOL_DECLARATIONS, executeTool } from '@/lib/ai/tools'
import type { AIRequest, AIResponse } from '@/lib/ai/types'
import type { GroqMessage } from '@/lib/ai/provider'

const MAX_HISTORY = 8 // last N messages sent to model — keeps cost low

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse & validate request ─────────────────────────────────────────
  let body: AIRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, history = [], app_context, access_token } = body

  if (!message?.trim())    return NextResponse.json({ error: 'message is required' },      { status: 400 })
  if (!access_token)       return NextResponse.json({ error: 'access_token is required' }, { status: 401 })

  // ── 2. Authenticate user via JWT ─────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.warn('[AI] Auth failed:', authError?.message)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId   = user.id
  const language = app_context?.language ?? 'es'
  const today    = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // ── 3. Build system prompt ────────────────────────────────────────────────
  const contextHints = [
    app_context?.current_page      ? `Página actual: ${app_context.current_page}` : null,
    app_context?.active_subject_id ? `Materia activa (ID): ${app_context.active_subject_id}` : null,
  ].filter(Boolean).join('\n')

  const systemPrompt = `Eres el asistente académico de Scholr Sanctuary.
Hoy es ${today}. Idioma: ${language === 'es' ? 'español' : 'inglés'}.
${contextHints}

REGLAS:
- Responde siempre en ${language === 'es' ? 'español' : 'English'}.
- Sé conciso y útil. Sin relleno.
- Para responder sobre datos del usuario, SIEMPRE usa las herramientas disponibles. No inventes datos.
- Si falta un parámetro para una acción, pide SOLO ese dato.
- Confirma antes de crear datos: di qué vas a crear y espera confirmación del usuario.
- Nunca hagas dos acciones en un solo mensaje.`

  // ── 4. Build conversation messages ───────────────────────────────────────
  const trimmedHistory = history.slice(-MAX_HISTORY)

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map(m => ({
      role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  const toolsUsed: string[] = []

  // ── 5. First Groq call ────────────────────────────────────────────────────
  console.log(`[AI] user=${userId} page=${app_context?.current_page ?? '-'} msg="${message.slice(0, 80)}"`)

  let groqResp
  try {
    groqResp = await callGroq({
      model:       CHAT_MODEL,
      messages,
      tools:       TOOL_DECLARATIONS,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens:  800,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    console.error('[AI] Groq call 1 failed:', e.message)
    if (e.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    return NextResponse.json({ error: 'Error del modelo de IA' }, { status: 500 })
  }

  // ── 6. Handle tool call (max 1 round) ────────────────────────────────────
  const toolCall = getToolCall(groqResp)

  if (toolCall) {
    const { id, function: { name, arguments: argsStr } } = toolCall

    let args: Record<string, unknown> = {}
    try { args = JSON.parse(argsStr) } catch { /* use empty args */ }

    console.log(`[AI] tool call: ${name}`, JSON.stringify(args))
    toolsUsed.push(name)

    const result = await executeTool(name, args, access_token, userId)
    console.log(`[AI] tool result ok=${result.ok}`, result.error ?? '')

    // Feed tool result back for the final answer
    const messagesWithTool: GroqMessage[] = [
      ...messages,
      {
        role:       'assistant',
        content:    null,
        tool_calls: [toolCall],
      },
      {
        role:         'tool',
        content:      JSON.stringify(result.ok ? result.data : { error: result.error }),
        tool_call_id: id,
        name,
      },
    ]

    let groqResp2
    try {
      groqResp2 = await callGroq({
        model:       CHAT_MODEL,
        messages:    messagesWithTool,
        temperature: 0.4,
        max_tokens:  800,
      })
    } catch (err: unknown) {
      const e = err as Error & { status?: number }
      console.error('[AI] Groq call 2 failed:', e.message)
      if (e.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
      return NextResponse.json({ error: 'Error del modelo de IA' }, { status: 500 })
    }

    const reply = getText(groqResp2)
    console.log(`[AI] reply (${reply.length} chars) tools=[${toolsUsed.join(',')}]`)
    return NextResponse.json({ reply, tools_used: toolsUsed } satisfies AIResponse)
  }

  // ── 7. Direct answer (no tool call) ──────────────────────────────────────
  const reply = getText(groqResp)
  console.log(`[AI] reply (${reply.length} chars) no tools`)
  return NextResponse.json({ reply, tools_used: [] } satisfies AIResponse)
}
