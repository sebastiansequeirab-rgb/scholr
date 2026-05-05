# CLAUDE.md — Skolar

## What is this

Academic platform ES/EN — two connected portals: Student + Teacher.
Production: https://scholr-5x9n.vercel.app/ · Supabase ID: xawgomhknzdnhkxcegqi

## Stack

Next.js 14 App Router · TypeScript strict · Supabase · Tailwind CSS · Shadcn/UI
Tiptap v3 · FullCalendar · Groq (vision: llama-4-scout-17b-16e-instruct / chat: llama-3.3-70b-versatile) · Vercel

## Critical rules — never break these

- NEVER ask the user to share .env contents in chat — read the file locally with tools if needed
- NEVER use `any` in TypeScript
- ALWAYS add text to both /i18n/es.json AND /i18n/en.json
- ALWAYS use createClient() from @/lib/supabase/client (browser) or @/lib/supabase/server (server)
- NEVER hardcode hex colors — use CSS variables (var(--color-primary), var(--s-base), var(--danger), var(--warning), var(--success))
- ONE task at a time — never mix features in a single prompt
- AI_PROVIDER env flag selects groq (default) or claude path — do not change model constants without checking provider

## RLS and data access patterns

- RLS is ON for all tables — every server query is scoped to the authenticated user automatically
- **Exception — enrolled subjects**: students see teacher subjects via the `enrollments` table. Do NOT add `.eq('user_id', user.id)` to subjects/exams queries — it would exclude enrolled content
- Teacher-assigned exams: `exams.assigned_by IS NOT NULL` → grades live in `exam_grades(exam_id, student_id, grade)`, NOT `exams.grade`
- Always overlay `exam_grades` for teacher exams when computing progress or showing grades

## i18n pattern

- Client components: `const { t, language } = useTranslation()` from `@/hooks/useTranslation`
- Server components: `const { t, lang, bcp47 } = getTranslator()` from `@/lib/i18n/server`
- Language stored in `skolar_lang` cookie (written by `LanguageContext.tsx` on change) — server reads via `cookies()`
- Default language: `'es'` (Spanish)

## Folder structure

```
skolar/
├── CLAUDE.md                     ← this file — read every session
├── .env.local                    ← secrets, never commit
├── active/                       ← all Claude Code work lives here
│   ├── execution/                ← sprint docs (SPRINT2.md complete, SPRINT3.md pending)
│   ├── portals/                  ← student + teacher specs
│   ├── config/                   ← DB schema + conventions + security
│   └── research/                 ← market + leads
├── app/                          ← Next.js routes only, no logic here
│   ├── (auth)/                   ← login, register
│   ├── (app)/                    ← Student portal
│   ├── (teacher)/                ← Teacher portal
│   ├── api/
│   │   ├── ai/route.ts           ← Groq API handler (tool calling loop, max 3 rounds)
│   │   ├── ai/summarize-context/ ← subject AI context auto-refresh
│   │   └── subjects/join/        ← student enrollment via access code
│   └── middleware.ts             ← auth guard + role redirect (student→/dashboard, teacher→/teacher)
├── features/
│   ├── home/                     ← student dashboard widgets (TaskFeed, ExamFeed, UrgentTasksSection, LiveClock)
│   ├── teacher/                  ← dashboard, courses, grades, announcements, documents, schedules
│   └── ai/                       ← provider.ts, tools.ts, prompts/, types.ts
├── lib/
│   ├── supabase/                 ← client.ts + server.ts + admin.ts
│   ├── i18n/server.ts            ← getTranslator() for server components (reads skolar_lang cookie)
│   └── utils/                    ← grade.ts, date.ts, strings.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx           ← student sidebar
│   │   ├── LanguageContext.tsx   ← writes skolar_lang cookie on language change
│   │   └── ThemeContext.tsx
│   └── ui/                       ← Shadcn components only
├── i18n/                         ← es.json (default) + en.json — keep in sync
├── types/                        ← database.ts + index.ts
└── public/                       ← logo-dark.png, logo-light.png (served as /logo-*.png)
```

## Database — all tables (RLS ON everywhere)

| Table                | Key columns |
|----------------------|-------------|
| profiles             | id, full_name, language, theme, color_mode, is_premium, avatar_url, role(student/teacher) |
| subjects             | id, user_id, name, professor, color, room, icon, access_code, teacher_id, evaluation_plan |
| schedules            | subject_id, day_of_week(0-6), start_time, end_time, room |
| tasks                | user_id, subject_id, text, priority(high/mid/low), due_date, is_done, status(not_started/in_progress/completed) |
| exams                | subject_id, title, exam_date, activity_type, percentage, grade, submission_status, max_grade(20), assigned_by |
| exam_grades          | exam_id, student_id, grade — teacher-assigned grades (when exams.assigned_by IS NOT NULL) |
| notes                | user_id, subject_id, title, content, updated_at |
| ai_sessions          | user_id, subject_id(nullable), title, last_message_at |
| ai_session_messages  | session_id, user_id, role(user/assistant), content |
| subject_ai_contexts  | user_id, subject_id, summary, last_updated_at |
| enrollments          | student_id, subject_id, joined_at, status(active/dropped) |
| announcements        | subject_id, teacher_id, title, content, priority(normal/urgent), expires_at |
| documents            | subject_id, uploaded_by, title, file_url, file_type, size_bytes |

## Progress bar formula

```typescript
// Student self-created exams:
const progress = exams
  .filter(e => e.submission_status === 'graded' && e.grade !== null)
  .reduce((acc, e) => acc + (e.grade * e.percentage / 100), 0)
// Teacher-assigned exams: overlay exam_grades first, then same formula
// Display: progress.toFixed(1) + ' / 20.0'
```

## Current status

**Sprint 1 ✅ COMPLETE** (deployed 2026-04-23)
- Progress bars fixed, logo integrated, voice input (notes + AI), image analysis in AI chat
- Auto-title notes, subject_ai_contexts activated, security hardening (SECURITY DEFINER, search_path, avatars bucket)

**Sprint 2 ✅ COMPLETE** (deployed 2026-05-04)
- Full teacher portal: role selection on register, teacher dashboard, course creation with access codes
- Student enrollment via code, grade table (exam_grades), announcements, document upload, schedule sync

**Post-audit fixes ✅ APPLIED** (deployed 2026-05-04, commit db1fe45)
- **Critical**: Dashboard and AI summarize-context now correctly fetch enrolled teacher exams via exam_grades overlay
- **i18n**: Server-side translation via `lib/i18n/server.ts` + `skolar_lang` cookie; all dashboard/feeds strings translated
- **Theme**: All hardcoded hex colors replaced with CSS variables across calendar, planner, settings, teacher components
- **Feeds**: Midnight staleness bug fixed (todayStr computed at call time, not module load)
- **UX**: Optimistic toggle rollback in UrgentTasksSection
- **Security**: subjects/join route now scopes access_code lookup to teacher subjects only (.not('teacher_id', 'is', null))
- Deleted unused duplicate `features/dashboard/` directory (identical to `features/home/`)
- Removed stale logo duplicates from `app/fonts/` (canonical logos live in `public/`)

**Sprint 3 📋 PLANNED** → active/execution/SPRINT3.md
Goal: Analytics, study sessions, Pomodoro timer, advanced AI features

## ⚠️ Pending manual action

Supabase Dashboard → Authentication → Password Strength → Enable (never done automatically)
