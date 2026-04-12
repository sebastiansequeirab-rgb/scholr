// ─── Gemini provider abstraction ─────────────────────────────────────────────
// Swap this file to change AI provider without touching business logic.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const MODEL    = 'gemini-2.0-flash-lite'

export type GeminiRole = 'user' | 'model' | 'function'

export interface GeminiPart {
  text?: string
  functionCall?:     { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: unknown }
}

export interface GeminiMessage {
  role:  GeminiRole
  parts: GeminiPart[]
}

export interface FunctionDeclaration {
  name:        string
  description: string
  parameters:  Record<string, unknown>
}

interface GeminiRequest {
  system_instruction?: { parts: [{ text: string }] }
  contents:            GeminiMessage[]
  tools?:              [{ function_declarations: FunctionDeclaration[] }]
  generationConfig?:   Record<string, unknown>
}

export interface GeminiCandidate {
  content: { parts: GeminiPart[]; role: string }
  finishReason: string
}

export interface GeminiResponse {
  candidates: GeminiCandidate[]
}

/** Single call to Gemini. Throws on non-200. */
export async function callGemini(payload: GeminiRequest): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(`${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } })?.error?.message || res.statusText
    const e = new Error(msg) as Error & { status: number }
    e.status = res.status
    throw e
  }

  return res.json() as Promise<GeminiResponse>
}

/** Extract text from a Gemini response */
export function getText(resp: GeminiResponse): string {
  return resp.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? ''
}

/** Extract a function call from a Gemini response (if any) */
export function getFunctionCall(resp: GeminiResponse) {
  return resp.candidates?.[0]?.content?.parts?.find(p => p.functionCall)?.functionCall ?? null
}
