# Sprint 1 — Demo Ready ✅ COMPLETE
**Deployed:** 2026-04-23 · Commit: `74f1b57`
**Goal:** App impressive enough to show institutions and close meetings.
**AI Model:** Groq — llama-3.3-70b via GROQ_API_KEY (AI_PROVIDER=groq in .env.local)
**Claude migration:** Ready — dual content format in api/ai/route.ts, change AI_PROVIDER=claude + add ANTHROPIC_API_KEY

---

## Tasks

- [x] **Fix progress bars**
  Filter: `submission_status === 'graded' && grade !== null`
  Files: `app/(app)/subjects/page.tsx`, `features/subjects/components/SubjectDetail.tsx`

- [x] **Integrate logo**
  Files: `components/layout/Sidebar.tsx` (theme-aware), `app/(auth)/login/page.tsx`,
  `app/(auth)/register/page.tsx`, `app/layout.tsx` (metadata)
  Assets: `public/logo-light.png`, `public/logo-dark.png`

- [x] **Voice in Notes**
  File: `app/(app)/notes/page.tsx` — mic button at end of Tiptap toolbar
  Web Speech API, duck-typed (no SpeechRecognition global), lang=es-ES

- [x] **Voice for AI agent**
  File: `features/ai/components/AIChatHub.tsx` — mic button in chat input
  On result: populates input field, does NOT auto-send

- [x] **Image analysis in AI chat**
  Files: `features/ai/components/AIChatHub.tsx`, `app/api/ai/route.ts`, `features/ai/provider.ts`
  Groq format (image_url) and Claude format (image+source) both ready via AI_PROVIDER flag

- [x] **Fix Untitled notes**
  File: `app/(app)/notes/page.tsx` — saveNote debounce
  Priority: H1-3 heading → first 50 chars plain text → "Nota — [date]"
  Checks: `['', 'Untitled', 'Sin título']`

- [x] **Activate subject_ai_contexts**
  Files: `features/ai/components/AIChatHub.tsx`, `app/api/ai/summarize-context/route.ts`
  Auto-refresh when >24h stale. Parallel fetch: notes + exams + progress → upsert summary

- [x] **Security fix: upcoming_exams view** — SECURITY DEFINER removed
- [x] **Security fix: 4 vulnerable functions** — SET search_path = public added
- [x] **Security fix: avatars bucket** — scoped to own user files
- [ ] **Security fix: leaked password protection** — ⚠️ MANUAL: Supabase Dashboard → Authentication → Sign In / Up → Password Strength → Enable "Check for leaked passwords"

---

## What was built
| Area | Files changed |
|---|---|
| Progress bars | subjects/page.tsx, SubjectDetail.tsx |
| Logo | Sidebar.tsx, login/page.tsx, register/page.tsx, layout.tsx |
| Voice | notes/page.tsx, AIChatHub.tsx |
| Image AI | AIChatHub.tsx, api/ai/route.ts, features/ai/provider.ts, features/ai/types.ts |
| Auto-title | notes/page.tsx |
| AI contexts | AIChatHub.tsx, api/ai/summarize-context/route.ts |
| Security | Supabase MCP migrations (no code files) |
| i18n | i18n/es.json, i18n/en.json |
| Assets | public/logo-light.png, public/logo-dark.png |
| Docs | active/ folder (all sprint + config docs moved here) |
