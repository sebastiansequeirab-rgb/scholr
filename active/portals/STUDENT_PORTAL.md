# Student Portal — Spec

## Current routes (working in production)
| Route | What it does | Tables used |
|---|---|---|
| /dashboard | Home: greeting, clock, next class, tasks, activities | profiles, schedules, tasks, exams |
| /calendar | Month/week/day, color-coded by subject | subjects, schedules, exams, tasks |
| /subjects | Grid of subjects with progress bars | subjects, exams, schedules |
| /planner | Tasks + Exams + Assignments with countdown | tasks, exams, subjects |
| /notes | Tiptap rich text editor + image upload | notes, subjects |
| /ai | AI chat — global + per subject sessions | ai_sessions, ai_session_messages, subjects |
| /tasks | Task management with priorities | tasks, subjects |
| /settings | Profile, language, theme | profiles |

## What works today ✅
- Dashboard with real-time clock and personalized greeting
- Calendar month/week/day, color-coded by subject
- 8 active subjects with auto-assigned icons
- Planner with countdown and type badges
- Tiptap editor: bold, italic, lists, headings, image attachments
- AI multi-chat with tools: create_task, create_exam, get_today_schedule, get_upcoming_exams
- Full ES/EN i18n with next-intl
- Supabase Realtime on tasks and exams
- Auth: login, register, OAuth, protected routes

## What is broken ⚠️
- Progress bars show 0 — grade calculation not implemented
- Notes titled "Untitled" — no auto-title logic
- subject_ai_contexts empty — no persistent subject context for AI
- No voice input anywhere
- No image analysis in AI chat
- Logo is a placeholder

## What is missing for Sprint 2 ❌
- Join subject with access code
- View enrolled subjects from teacher
- See teacher announcements on dashboard
- Access teacher-uploaded documents inside a subject
