// ─── Shared AI types ────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Sent by the client with every request */
export interface AIRequest {
  message: string
  history: ChatMessage[]       // last N messages (trimmed client-side)
  app_context: AppContext
  access_token: string         // Supabase JWT — used server-side to auth queries
  pdf_text?: string            // extracted text from an attached PDF (if any)
  imageBase64?: string         // base64-encoded image for vision (no data: prefix)
  imageMediaType?: string      // e.g. 'image/jpeg'
}

/** What the client knows about the current UI state */
export interface AppContext {
  current_page?: string        // e.g. "subjects", "calendar", "tasks"
  active_subject_id?: string   // if user is inside a subject detail
  language: 'es' | 'en'
  subject_count?: number       // total subjects registered
  pending_task_count?: number  // tasks not yet done
  next_exam_date?: string | null // YYYY-MM-DD of nearest upcoming exam
}

/** Returned to the client */
export interface AIResponse {
  reply: string
  tools_used: string[]
}

/** Internal tool result */
export interface ToolResult {
  ok: boolean
  data?: unknown
  error?: string
}
