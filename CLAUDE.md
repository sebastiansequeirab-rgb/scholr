# CLAUDE.md — Skolar

## What is this

Academic platform ES/EN — two connected portals: Student + Teacher.
Production: https://scholr-5x9n.vercel.app/ · Supabase ID: xawgomhknzdnhkxcegqi

## Stack

Next.js 14 App Router · TypeScript strict · Supabase · Tailwind CSS · Shadcn/UI
Tiptap v3 · FullCalendar · next-intl · Claude API (claude-sonnet-4-5) · Vercel

## Critical rules — never break these

- NEVER ask the user to share .env contents in chat — read the file locally with tools if needed
- NEVER use `any` in TypeScript
- ALWAYS add text to both /i18n/es.json AND /i18n/en.json
- ALWAYS use createClient() from @/lib/supabase/client (browser) or @/lib/supabase/server (server)
- ALWAYS filter with .eq(‘user_id’, user.id) — RLS is ON for all tables
- NEVER hardcode hex colors — use CSS variables (var(–color-primary), var(–s-base))
- AI model is claude-sonnet-4-5 — do not change it
- ONE task at a time — never mix features in a single prompt

## Folder structure

```
skolar/
├── CLAUDE.md                     ← this file — read every session
├── .env.local                    ← secrets, never commit
├── active/                       ← all Claude Code work lives here
│   ├── execution/                ← active sprints + prompts
│   ├── portals/                  ← student + teacher specs
│   ├── config/                   ← DB schema + conventions + security
│   └── research/                 ← market + leads
├── app/                          ← Next.js routes only, no logic here
│   ├── (auth)/                   ← login, register
│   ├── (app)/                    ← Student portal (current)
│   ├── (teacher)/                ← Teacher portal (Sprint 2)
│   ├── api/ai/route.ts           ← Claude API handler
│   └── middleware.ts             ← auth guard + role redirect
├── features/
│   ├── student/                  ← dashboard, calendar, subjects, notes, planner, ai
│   ├── teacher/                  ← dashboard, courses, grades, announcements, documents
│   └── shared/                   ← auth, profile, shared components
├── lib/
│   ├── supabase/                 ← client.ts + server.ts
│   ├── ai/tools.ts               ← AI tools: create_task, create_exam, get_schedule
│   └── utils/                    ← grade.ts, date.ts, strings.ts
├── components/ui/                ← Shadcn components only
├── i18n/                         ← es.json (default) + en.json
├── types/                        ← database.ts + index.ts
└── config/                       ← routes.ts + constants.ts
```

## Database — all tables (RLS ON everywhere)

|Table              |Rows|Key columns                                                                                     |
|-------------------|----|------------------------------------------------------------------------------------------------|
|profiles           |22  |id, full_name, language, theme, color_mode, is_premium, avatar_url                              |
|subjects           |92  |id, user_id, name, professor, color, room, icon                                                 |
|schedules          |141 |subject_id, day_of_week(0-6), start_time, end_time, room                                        |
|tasks              |4   |user_id, subject_id, text, priority(high/mid/low), due_date, is_done, status                    |
|exams              |30  |subject_id, title, exam_date, activity_type, percentage, grade, submission_status, max_grade(20)|
|notes              |7   |user_id, subject_id, title, content, updated_at                                                 |
|ai_sessions        |4   |user_id, subject_id(nullable), title, last_message_at                                           |
|ai_session_messages|10  |session_id, user_id, role(user/assistant), content                                              |
|subject_ai_contexts|0   |user_id, subject_id, summary — EXISTS BUT UNUSED                                                |

## Progress bar formula (Sprint 1 fix)

```typescript
const progress = exams
  .filter(e => e.submission_status === 'graded' && e.grade !== null)
  .reduce((acc, e) => acc + (e.grade * e.percentage / 100), 0)
// Display: progress.toFixed(1) + ' / 20.0'
```

## Active sprint → active/execution/SPRINT1.md

## Full plan → active/execution/SPRINT2.md through SPRINT4.md

## Security issues → active/config/SECURITY.md