import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGroq, getText, getToolCall, CHAT_MODEL } from '@/features/ai/provider'
import { TOOL_DECLARATIONS, executeTool } from '@/features/ai/tools'
import type { AIRequest, AIResponse } from '@/features/ai/types'
import type { GroqMessage } from '@/features/ai/provider'
import { buildChatSystemPrompt } from '@/features/ai/prompts/chatSystemPrompt'

const MAX_HISTORY     = 8  // last N messages sent to model
const MAX_TOOL_ROUNDS = 3  // max chained tool calls per request

export async function POST(req: NextRequest): Promise<NextResponse> {

  // ── 1. Parse & validate ───────────────────────────────────────────────────
  let body: AIRequest
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, history = [], app_context, access_token, pdf_text } = body
  if (!message?.trim()) return NextResponse.json({ error: 'message is required' },      { status: 400 })
  if (!access_token)    return NextResponse.json({ error: 'access_token is required' }, { status: 401 })

  // ── 2. Authenticate ───────────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${access_token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId   = user.id
  const language = app_context?.language ?? 'es'
  const today    = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // ── 3. Fetch subject name + accumulated context (parallel) ────────────────
  const hasSubject = !!app_context?.active_subject_id

  const [subjectCtxRes, subjectNameRes] = await Promise.all([
    hasSubject
      ? supabase.from('subject_ai_contexts').select('summary')
          .eq('subject_id', app_context!.active_subject_id!)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    hasSubject
      ? supabase.from('subjects').select('name')
          .eq('id', app_context!.active_subject_id!)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const subjectContextBlock = subjectCtxRes.data?.summary
    ? `\nCONTEXTO ACUMULADO DE ESTA MATERIA:\n${subjectCtxRes.data.summary}`
    : ''
  const activeSubjectName   = subjectNameRes.data?.name ?? ''

  // ── 4. Build system prompt ────────────────────────────────────────────────
  const subjectCtxLine = hasSubject
    ? `Materia activa: "${activeSubjectName}" — subject_id: ${app_context!.active_subject_id} — incluye SIEMPRE este subject_id en create_exam y create_task`
    : null

  const contextHints = [
    app_context?.current_page       ? `Página: ${app_context.current_page}` : null,
    subjectCtxLine,
    app_context?.subject_count      != null ? `Materias registradas: ${app_context.subject_count}` : null,
    app_context?.pending_task_count != null ? `Tareas pendientes: ${app_context.pending_task_count}` : null,
    app_context?.next_exam_date     != null ? `Próxima evaluación: ${app_context.next_exam_date}` : null,
  ].filter(Boolean).join('\n')

  const lang = language === 'es' ? 'español' : 'English'

  const systemPrompt = buildChatSystemPrompt({
    today,
    lang,
    contextHints,
    subjectContextBlock,
    pdfText: pdf_text,
  })

  // ── 5. Build conversation ─────────────────────────────────────────────────
  let currentMessages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-MAX_HISTORY).map(m => ({
      role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  console.log(`[AI] user=${userId} subject="${activeSubjectName || '-'}" msg="${message.slice(0, 80)}"`)

  // ── 6. First call ─────────────────────────────────────────────────────────
  const toolsUsed: string[] = []

  let groqResp
  try {
    groqResp = await callGroq({
      model:       CHAT_MODEL,
      messages:    currentMessages,
      tools:       TOOL_DECLARATIONS,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens:  900,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    if (e.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    return NextResponse.json({ error: 'Error del modelo de IA' }, { status: 500 })
  }

  // ── 7. Tool calling loop (max MAX_TOOL_ROUNDS rounds) ─────────────────────
  let toolCall = getToolCall(groqResp)

  while (toolCall && toolsUsed.length < MAX_TOOL_ROUNDS) {
    const { id, function: { name, arguments: argsStr } } = toolCall

    let args: Record<string, unknown> = {}
    try { args = JSON.parse(argsStr) } catch { /* use empty args */ }

    console.log(`[AI] tool call (round ${toolsUsed.length + 1}): ${name}`, JSON.stringify(args))
    toolsUsed.push(name)

    const result = await executeTool(name, args, access_token, userId)
    console.log(`[AI] tool result ok=${result.ok}`, result.error ?? '')

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: null, tool_calls: [toolCall] },
      {
        role:         'tool',
        content:      JSON.stringify(result.ok ? result.data : { error: result.error }),
        tool_call_id: id,
        name,
      },
    ]

    const isLastRound = toolsUsed.length >= MAX_TOOL_ROUNDS

    try {
      groqResp = await callGroq({
        model:       CHAT_MODEL,
        messages:    currentMessages,
        // Last round: no tools — force a text answer
        tools:       isLastRound ? undefined : TOOL_DECLARATIONS,
        tool_choice: isLastRound ? undefined : 'auto',
        temperature: 0.4,
        max_tokens:  900,
      })
    } catch (err: unknown) {
      const e = err as Error & { status?: number }
      if (e.status === 429) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
      return NextResponse.json({ error: 'Error del modelo de IA' }, { status: 500 })
    }

    toolCall = isLastRound ? null : getToolCall(groqResp)
  }

  // ── 8. Return final reply ─────────────────────────────────────────────────
  const reply = getText(groqResp)
  console.log(`[AI] reply (${reply.length} chars) tools=[${toolsUsed.join(', ') || 'none'}]`)
  return NextResponse.json({ reply, tools_used: toolsUsed } satisfies AIResponse)
}
