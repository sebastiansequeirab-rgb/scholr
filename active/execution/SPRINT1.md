# Sprint 1 — Demo Ready
**Goal:** App impressive enough to show institutions and close meetings.
**Duration:** 1-2 weeks
**AI Model (current):** Groq — llama-3.3-70b via GROQ_API_KEY
**AI Model (target):** Claude API — claude-sonnet-4-5 (migration ready, see active/config/CONVENTIONS.md)

---

## Tasks

- [ ] **Fix progress bars**
  Formula: `SUM(grade * percentage / 100)` from `exams`
  WHERE `submission_status = 'graded'` AND `grade IS NOT NULL`
  Display as `X.X / 20.0` on each subject card.
  If no graded exams: show `0.0 / 20.0`

- [ ] **Integrate logo**
  ⏸ NEED: `/public/logo.png` — ask user to provide this file first.
  Places: navbar/sidebar, login page, register page, favicon.ico, og:image in layout.tsx.
  Use next/image for all instances.

- [ ] **Voice in Notes**
  Add mic button to Tiptap toolbar.
  Web Speech API — browser native, no package needed.
  `recognition.lang = 'es-ES'`
  On result: insert transcribed text at cursor in Tiptap editor.
  Visual: red pulsing dot while recording.

- [ ] **Voice for AI agent**
  Add mic button to AI chat input.
  Web Speech API — same config.
  On result: populate input field. User edits then sends manually.
  Works in global chat and per-subject chats.

- [ ] **Image analysis in AI chat**
  Add image attach button to chat input.
  Convert to base64. Pass to AI as multimodal message.

  **Current (Groq/Llama-3.3-70b):**
  ```typescript
  content: [
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
    { type: 'text', text: userMessage }
  ]
  ```
  **Future (Claude API migration):**
  ```typescript
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
    { type: 'text', text: userMessage }
  ]
  ```
  Build the API route to accept both formats via a config flag.

- [ ] **Fix Untitled notes**
  Auto-title from first heading or first 50 chars of content.
  Fallback: `"Nota — [current date]"`
  Apply on every save.

- [ ] **Activate subject_ai_contexts**
  On subject chat start: generate context summary from notes + exams + progress.
  Save to `subject_ai_contexts` table.
  Include in AI system prompt.

- [ ] **Security fix: upcoming_exams view**
  Recreate without SECURITY DEFINER — see active/config/SECURITY.md

- [ ] **Security fix: 4 vulnerable functions**
  Add SET search_path = public — see active/config/SECURITY.md

- [ ] **Security fix: avatars bucket**
  Restrict SELECT policy — see active/config/SECURITY.md

- [ ] **Security fix: leaked password protection**
  Supabase Dashboard → Authentication → Password Security → Enable.

---

## Execution order
1. Security fixes (SQL only, no code)
2. Fix progress bars
3. Fix Untitled notes
4. Integrate logo (after user provides logo file)
5. Voice in Notes
6. Voice for AI agent
7. Image analysis in AI chat
8. Activate subject_ai_contexts

---

## Definition of done
- [ ] Progress bars show real calculated grades
- [ ] Logo in navbar, login, register, favicon
- [ ] Voice works in notes and AI chat
- [ ] Image attach works in AI chat
- [ ] No notes titled "Untitled"
- [ ] subject_ai_contexts has data after first subject chat
- [ ] All 4 security issues resolved
