# CLAUDE.md — Skolar

> Last refresh: 2026-05-13 · Teacher portal v2 merged · Home estudiante polish v2.2 deployed

## What is this

Academic platform ES/EN — two connected portals: **Student** (`/dashboard`) + **Teacher** (`/teacher`).

- **Production**: https://scholr-5x9n.vercel.app/
- **Vercel project**: `scholr` (NOT `skolar` — old alias)
- **GitHub repo**: https://github.com/sebastiansequeirab-rgb/scholr
- **Supabase project**: `xawgomhknzdnhkxcegqi`

## Stack

Next.js 14 App Router · TypeScript strict · Supabase · Tailwind CSS · shadcn/ui
Tiptap v3 · FullCalendar · Groq (vision: `llama-4-scout-17b-16e-instruct` / chat: `llama-3.3-70b-versatile`) · Vercel

Key deps: `react-markdown`, `sonner`, `zod`, `@dnd-kit/core`, `next-themes`, `tiptap`, `chart.js`.

## Workflow — keep it simple

- **Single dev branch**: `main`. Push directo a main → Vercel autodeploy a prod (`scholr-5x9n.vercel.app`).
- **No previews** as default — los hacemos solo cuando el cambio es ambicioso (schema, refactor grande, rebrand).
- **No `npm run dev`** durante review — verificá siempre online tras push (memoria `feedback_no_local_dev`).
- **Sin clarifying questions durante ejecución** — el user prefiere recomendaciones + ejecución, no preguntas a media tarea (memoria `feedback_execution_style`).

## Critical rules — never break these

- NEVER ask the user to share `.env` contents in chat — read the file locally with tools if needed.
- NEVER use `any` in TypeScript.
- ALWAYS add text to both `/i18n/es.json` AND `/i18n/en.json`.
- ALWAYS use `createClient()` from `@/lib/supabase/client` (browser) or `@/lib/supabase/server` (server).
- NEVER hardcode hex colors — use CSS variables (`var(--color-primary)`, `var(--s-base)`, `var(--danger)`, `var(--warning)`, `var(--success)`).
- AI_PROVIDER env flag selects `groq` (default) or `claude` path — do not change model constants without checking provider.
- Buttons used as list items (e.g. `<button class="agenda-item">`) NEED an explicit `text-align: left` reset — buttons default to `center` and it propagates to children.

## RLS and data access patterns

- RLS is ON for all tables — every server query is scoped to the authenticated user automatically.
- **Exception — enrolled subjects**: students see teacher subjects via the `enrollments` table. Do NOT add `.eq('user_id', user.id)` to `subjects`/`exams` queries — it would exclude enrolled content.
- Teacher-assigned exams: `exams.assigned_by IS NOT NULL` → grades live in `exam_grades(exam_id, student_id, grade)`, NOT `exams.grade`. Always overlay `exam_grades` for teacher exams when computing progress or showing grades.
- Teacher courses: `subjects.teacher_id = user.id`. The teacher home empty state shows when no rows match — not a bug, the user just doesn't have courses yet.

## i18n pattern

- Client components: `const { t, language } = useTranslation()` from `@/hooks/useTranslation`.
- Server components: `const { t, lang, bcp47 } = getTranslator()` from `@/lib/i18n/server`.
- Language stored in `skolar_lang` cookie (written by `LanguageContext.tsx` on change) — server reads via `cookies()`.
- Default language: `'es'` (Spanish).

## Routing & middleware

`lib/supabase/middleware.ts` handles auth + role redirects:
- No user + app route → `/login`
- User on auth route → `/teacher/dashboard` if teacher, else `/dashboard`
- Teacher on student route → `/teacher/dashboard`
- Student on teacher route → `/dashboard`

`/teacher/dashboard/page.tsx` is a `permanentRedirect('/teacher')` for legacy URLs. The real teacher home is `/teacher`.

**Never** add a middleware redirect `/teacher → /teacher/dashboard` again — it would create an infinite loop with the page-level redirect.

## Folder structure

```
skolar/
├── CLAUDE.md                     ← this file — read every session
├── .env.local                    ← secrets, never commit
├── active/                       ← Claude Code work + planning docs
│   ├── execution/                ← sprint docs + handoff
│   ├── portals/                  ← student + teacher specs
│   ├── config/                   ← DB schema + conventions + security
│   └── research/                 ← market + leads
├── app/                          ← Next.js routes only, no logic
│   ├── (auth)/                   ← login, register, forgot
│   ├── (app)/                    ← Student portal
│   │   ├── dashboard/            ← home estudiante (polish v2.2)
│   │   ├── tareas/               ← task kanban
│   │   ├── evaluaciones/         ← exam list + submissions
│   │   ├── calendar/             ← FullCalendar wrapper, supports ?view=day|week|month
│   │   ├── anuncios/             ← student announcements view
│   │   ├── entregas/             ← submissions (WIP)
│   │   ├── mensajes/             ← chat with teachers
│   │   ├── subjects/             ← subject list + detail
│   │   ├── notes/                ← Tiptap notes
│   │   ├── ai/                   ← Skolar AI chat
│   │   ├── ai-settings/, settings/, personalization/, planner/, tasks/, exams/
│   ├── (teacher)/                ← Teacher portal v2
│   │   ├── layout.tsx            ← auth guard + TeacherShell wrapper
│   │   └── teacher/
│   │       ├── page.tsx          ← TEACHER HOME (v2)
│   │       ├── courses/          ← list, create, [id] detail + sub-pages
│   │       ├── grades/           ← global grades view
│   │       ├── announcements/    ← global announcements
│   │       ├── documents/        ← global docs
│   │       ├── students/         ← global students
│   │       ├── mensajes/         ← messages
│   │       └── dashboard/        ← redirect to /teacher (legacy)
│   ├── api/
│   │   ├── ai/route.ts           ← Groq handler (tool calling loop, max 3 rounds)
│   │   ├── ai/summarize-context/ ← subject AI context auto-refresh
│   │   ├── subjects/join/        ← student enrollment via access code
│   │   └── teacher/courses/[id]/schedules + sync-schedules
│   └── middleware.ts             ← matcher only; logic in lib/supabase/middleware.ts
├── features/
│   ├── home/                     ← student dashboard widgets
│   │   ├── GreetingTitle.tsx     ← client-side greet based on local hour
│   │   ├── DashMetaBar.tsx       ← sub-header (clock + week + avg + alert)
│   │   ├── UrgentCountdown.tsx   ← urgent banner with countdown + expired state
│   │   ├── AnnouncementsStrip.tsx, AgendaList.tsx, TasksList.tsx, EvaluationsList.tsx
│   │   ├── DashboardRefresher.tsx, UrgentTasksSection.tsx, SubmissionInline.tsx
│   ├── teacher/                  ← teacher portal v2 features
│   │   ├── layout/               ← TeacherShell.tsx + TeacherSidebar.tsx
│   │   ├── dashboard/            ← TeacherDashboard.tsx + LiveBadge.tsx
│   │   ├── courses/              ← CoursesClient, CourseOverview, CourseModal, CourseCodeBlock, courseIcons
│   │   ├── grades/               ← GradesGlobal + AddExamModal + GradeCell
│   │   ├── announcements/        ← AnnouncementsGlobal + AnnouncementModal
│   │   ├── documents/            ← DocumentsGlobal + DocumentRow + UploadDropzone
│   │   ├── students/             ← StudentsGlobal + StudentDrawer + BulkMessageModal
│   │   ├── lib/                  ← courseStats helpers
│   │   └── shared/               ← CourseFilterChips
│   ├── announcements/            ← StudentAnnouncementsView (shared by /anuncios)
│   ├── messages/                 ← ChatThreads + NewChatButton
│   ├── ai/                       ← provider.ts, tools.ts, prompts/, types.ts
│   └── subjects/components/      ← SubjectDetail (with editable evaluation plan)
├── lib/
│   ├── supabase/                 ← client.ts + server.ts + admin.ts + middleware.ts
│   ├── i18n/server.ts            ← getTranslator() for server components
│   ├── accent.ts                 ← accentClass() for course color tags
│   ├── grades.ts                 ← weighted avg, course average helpers
│   ├── mime.ts                   ← file type helpers
│   └── utils.ts, utils/          ← grade.ts, date.ts, strings.ts
├── components/
│   ├── layout/Sidebar.tsx, Topbar.tsx, LanguageContext.tsx, ThemeContext.tsx
│   └── ui/                       ← SideDrawer, shadcn components
├── i18n/                         ← es.json (default) + en.json — keep in sync
├── types/                        ← database.ts + index.ts
├── supabase/migrations/          ← 2026_05_11_teacher_redesign.sql (already applied)
├── scripts/                      ← seed-teacher.ts
└── public/                       ← logo-dark.png, logo-light.png
```

## Database — all tables (RLS ON everywhere)

| Table                | Key columns |
|----------------------|-------------|
| profiles             | id, full_name, language, theme, color_mode, is_premium, avatar_url, role(student/teacher), current_week, semester_weeks |
| subjects             | id, user_id, name, professor, color, room, icon, access_code, teacher_id, evaluation_plan, **semester, accent** |
| schedules            | subject_id, day_of_week(0-6), start_time, end_time, room |
| tasks                | user_id, subject_id, text, priority(high/mid/low), due_date, is_done, status(not_started/in_progress/done), position, notes |
| exams                | subject_id, title, exam_date, exam_time, activity_type, percentage, grade, submission_status, max_grade(20), assigned_by, study_plan, estimated_hours, **position** |
| exam_grades          | exam_id, student_id, grade — teacher-assigned grades (when exams.assigned_by IS NOT NULL) |
| **submissions**      | course_id, student_id, exam_id, status(pending_review/graded/returned/draft), content, file_url, reviewed_at, reviewed_by |
| **messages**         | teacher_id, student_id, course_id, subject, body, sender_id, read_at |
| notes                | user_id, subject_id, title, content, updated_at |
| ai_sessions          | user_id, subject_id(nullable), title, last_message_at, pinned |
| ai_session_messages  | session_id, user_id, role(user/assistant), content |
| subject_ai_contexts  | user_id, subject_id, summary, last_updated_at |
| enrollments          | student_id, subject_id, joined_at, status(active/dropped) |
| announcements        | subject_id, teacher_id, title, content, priority(normal/urgent), expires_at |
| announcement_reads   | announcement_id, student_id, read_at (composite PK) |
| documents            | subject_id, uploaded_by, title, file_url, file_type, size_bytes |

**Storage bucket**: `course-documents` (private, teacher write / enrolled student read).

## Progress bar formula

```typescript
// Student self-created exams:
const progress = exams
  .filter(e => e.submission_status === 'graded' && e.grade !== null)
  .reduce((acc, e) => acc + (e.grade * e.percentage / 100), 0)
// Teacher-assigned exams: overlay exam_grades first, then same formula.
// Display: progress.toFixed(1) + ' / 20.0'
```

## Current status (2026-05-13)

### Student portal — Home polish v2.2 ✅
- Local-time greeting via `GreetingTitle.tsx` (client component, not server UTC)
- Hero: 4 stat cards full-width grid (no eyebrow tag, no LiveClock)
- Urgent banner: compact + title-first; renders "Vencida / Venció hoy" when expired; hidden past 24h
- 3 cards (Agenda / Tareas / Evaluaciones): equal heights via `align-items: stretch` + `.dash-col__items` flex wrapper, min-height 260px; 46px left column; 40px row min-height; text-align: left explicit (button reset); hairline divider between consecutive items
- Click any item → SideDrawer with details
- Anuncios strip: clickable cards + "Ver todo" link; mark-read on open
- Calendar accepts `?view=day|week|month` from URL
- Tasks overdue by >7d hidden from the home (still visible on /tareas)
- Theme toggle: single button showing the opposite mode icon

### Teacher portal — v2 ✅ deployed 2026-05-13
- New home `/teacher` (NOT `/teacher/dashboard`): KPIs, My Courses list, upcoming classes, recent announcements
- Sidebar label "Home" (was "Panel")
- Global pages: `/teacher/grades`, `/teacher/announcements`, `/teacher/documents`, `/teacher/students`, `/teacher/mensajes`
- New action files: `courses/actions.ts`, `announcements/actions.ts`, `documents/actions.ts`, `grades/actions.ts`, `students/actions.ts`, `mensajes/actions.ts`
- DB migration `2026_05_11_teacher_redesign.sql` ALREADY APPLIED:
  - `subjects.semester`, `subjects.accent` columns + accent check constraint
  - `exams.position` for ordering
  - `submissions` table (with RLS for student + teacher)
  - `course-documents` storage bucket + RLS policies
  - Realtime publication on exam_grades, announcements, submissions

### Sprint history
- Sprint 1 ✅ 2026-04-23 — Progress bars, logo, voice input, image analysis in AI, auto-title notes, subject_ai_contexts, security hardening
- Sprint 2 ✅ 2026-05-04 — Teacher portal v1 (role selection, dashboard, courses w/ access codes, enrollment, grades, announcements, docs, schedules)
- Visual Rebuild v2 ✅ 2026-05-06 — Swiss editorial direction (Inter + Instrument Serif italic + JetBrains Mono · warm slate dark / warm bone light · royal blue + lavender AI)
- Home polish v2.2 ✅ 2026-05-13 (this session)
- Teacher portal v2 ✅ 2026-05-13 (this session — merged from local WIP)

## ⚠️ Pending manual actions

- Supabase Dashboard → Authentication → Password Strength → Enable (never done automatically).
- The `/teacher` home shows empty state when the logged-in user has no `subjects.teacher_id = user.id` rows. Not a bug — create a course or assign the user to one.

## Common pitfalls (already burned, do not repeat)

- **Button text centering**: `<button>` defaults to `text-align: center` — when wrapping list items in a button (for click-to-open-drawer), the child titles/meta inherit center. Add `text-align: left` on the button.
- **Server-side time bugs**: `new Date()` server-side runs in UTC on Vercel. Move time-sensitive UI (greetings, "live now" indicators) to a client component.
- **`/teacher` redirect loop**: do NOT add `middleware.ts` redirect `/teacher → /teacher/dashboard`. The teacher home IS `/teacher`; legacy `/teacher/dashboard/page.tsx` already redirects back.
- **i18n keys leaking to UI**: missing keys render as `DASHBOARD.ASSISTANTTAG` etc. Always add to BOTH `es.json` and `en.json`.
- **WIP entanglement**: when committing selectively to send a fix to prod, watch for cross-file dependencies. The first preview build of home v2 failed because `react-markdown`, `sonner`, `zod` were in WIP `package.json` but not committed.
