// ─── Groq provider (OpenAI-compatible) ────────────────────────────────────────
// Swap this file to change AI provider without touching business logic.

const BASE_URL    = 'https://api.groq.com/openai/v1/chat/completions'
export const CHAT_MODEL   = 'llama-3.3-70b-versatile'
export const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export interface GroqMessage {
  role:         'system' | 'user' | 'assistant' | 'tool'
  content:      string | null
  tool_calls?:  GroqToolCall[]
  tool_call_id?: string
  name?:        string
}

export interface GroqToolCall {
  id:       string
  type:     'function'
  function: { name: string; arguments: string }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name:        string
    description: string
    parameters:  Record<string, unknown>
  }
}

interface GroqRequest {
  model:        string
  messages:     GroqMessage[]
  tools?:       ToolDefinition[]
  tool_choice?: 'auto' | 'none'
  temperature?: number
  max_tokens?:  number
}

export interface GroqResponse {
  choices: Array<{
    message: {
      role:        string
      content:     string | null
      tool_calls?: GroqToolCall[]
    }
    finish_reason: string
  }>
}

/** Single call to Groq. Throws on non-200. */
export async function callGroq(payload: GroqRequest): Promise<GroqResponse> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const res = await fetch(BASE_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } })?.error?.message || res.statusText
    const e = new Error(msg) as Error & { status: number }
    e.status = res.status
    throw e
  }

  return res.json() as Promise<GroqResponse>
}

/** Extract text from a Groq response */
export function getText(resp: GroqResponse): string {
  return resp.choices?.[0]?.message?.content ?? ''
}

/** Extract a tool call from a Groq response (first one, if any) */
export function getToolCall(resp: GroqResponse): GroqToolCall | null {
  return resp.choices?.[0]?.message?.tool_calls?.[0] ?? null
}
