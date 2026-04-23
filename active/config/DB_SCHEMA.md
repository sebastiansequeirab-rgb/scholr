# DB Schema — Supabase Skolar
Project ID: xawgomhknzdnhkxcegqi · All tables have RLS ON

## Current tables

### profiles (22 rows)
```
id           UUID PK → auth.users
full_name    TEXT DEFAULT ''
theme        TEXT DEFAULT 'indigo' CHECK IN ('indigo','purple','green')
color_mode   TEXT DEFAULT 'system' CHECK IN ('light','dark','system')
language     TEXT DEFAULT 'es' CHECK IN ('es','en')
is_premium   BOOLEAN DEFAULT false
avatar_url   TEXT nullable
updated_at   TIMESTAMPTZ DEFAULT now()
-- Sprint 2 adds: role TEXT DEFAULT 'student' CHECK IN ('student','teacher')
```

### subjects (92 rows)
```
id           UUID PK
user_id      UUID → auth.users
name         TEXT
professor    TEXT nullable
color        TEXT DEFAULT '#534AB7'
room         TEXT nullable
credits      INTEGER nullable
icon         TEXT nullable
created_at   TIMESTAMPTZ
-- Sprint 2 adds: access_code TEXT UNIQUE, teacher_id UUID → profiles, evaluation_plan JSONB
```

### schedules (141 rows)
```
id           UUID PK
user_id      UUID → auth.users
subject_id   UUID → subjects
day_of_week  INTEGER 0-6 (0=Sunday)
start_time   TIME
end_time     TIME
room         TEXT nullable
```

### tasks (4 rows)
```
id           UUID PK
user_id      UUID → auth.users
subject_id   UUID nullable → subjects
text         TEXT
priority     TEXT DEFAULT 'mid' CHECK IN ('high','mid','low')
due_date     DATE nullable
is_done      BOOLEAN DEFAULT false
status       TEXT DEFAULT 'not_started' CHECK IN ('not_started','in_progress','done')
position     INTEGER DEFAULT 0
created_at   TIMESTAMPTZ
```

### exams (30 rows)
```
id                 UUID PK
user_id            UUID → auth.users
subject_id         UUID nullable → subjects
title              TEXT
exam_date          DATE
exam_time          TIME nullable
location           TEXT nullable
activity_type      TEXT DEFAULT 'exam' CHECK IN ('exam','workshop','activity','task','study_session')
percentage         NUMERIC nullable (0-100)
grade              NUMERIC nullable
submission_status  TEXT DEFAULT 'pending' CHECK IN ('pending','submitted','graded')
max_grade          NUMERIC DEFAULT 20
reminder_triggered BOOLEAN DEFAULT false
created_at         TIMESTAMPTZ
-- Sprint 2 adds: assigned_by UUID → profiles
```

### notes (7 rows)
```
id           UUID PK
user_id      UUID → auth.users
subject_id   UUID nullable → subjects
title        TEXT DEFAULT ''
content      TEXT DEFAULT ''  ← Tiptap JSON as string
updated_at   TIMESTAMPTZ
created_at   TIMESTAMPTZ
```

### ai_sessions (4 rows)
```
id              UUID PK
user_id         UUID → auth.users
subject_id      UUID nullable → subjects
title           TEXT nullable
last_message_at TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

### ai_session_messages (10 rows)
```
id          UUID PK
session_id  UUID → ai_sessions
user_id     UUID → auth.users
role        TEXT CHECK IN ('user','assistant')
content     TEXT
created_at  TIMESTAMPTZ
```

### subject_ai_contexts (0 rows — UNUSED, activate in Sprint 1)
```
id              UUID PK
user_id         UUID → auth.users
subject_id      UUID → subjects
summary         TEXT nullable
last_updated_at TIMESTAMPTZ
```

## Progress bar formula
```typescript
const progress = exams
  .filter(e => e.submission_status === 'graded' && e.grade !== null)
  .reduce((acc, e) => acc + (e.grade! * (e.percentage ?? 0) / 100), 0)
const display = `${progress.toFixed(1)} / 20.0`
```

## Sprint 2 new tables
See active/execution/SPRINT2.md for full SQL.
Tables to create: enrollments, announcements, documents
