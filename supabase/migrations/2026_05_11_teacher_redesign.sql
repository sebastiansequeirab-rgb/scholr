-- Skolar Teacher Redesign — 2026-05-11
-- Additive only. No drops. No data migrations.
--
-- Apply with:
--   psql "$DATABASE_URL" -f supabase/migrations/2026_05_11_teacher_redesign.sql
-- Or via Supabase MCP:
--   apply_migration({ project_id: 'xawgomhknzdnhkxcegqi', name: 'teacher_redesign_2026_05_11', query: <contents> })

-- ──────────────────────────────────────────────────────────────────
-- A. Extend subjects with handoff fields
-- ──────────────────────────────────────────────────────────────────
alter table public.subjects
  add column if not exists semester text,
  add column if not exists accent text default 'blue';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subjects_accent_check'
  ) then
    alter table public.subjects
      add constraint subjects_accent_check
      check (accent is null or accent in ('rose','blue','amber','green','violet','teal'));
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────
-- B. exams.position for ordering grade components within a course
-- ──────────────────────────────────────────────────────────────────
alter table public.exams
  add column if not exists position integer default 0;

-- ──────────────────────────────────────────────────────────────────
-- C. submissions table (new) — student submissions for teacher exams
-- ──────────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete set null,
  status text not null default 'pending_review'
    check (status in ('pending_review','graded','returned','draft')),
  content text,
  file_url text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create index if not exists submissions_course_status_idx
  on public.submissions(course_id, status);
create index if not exists submissions_student_idx
  on public.submissions(student_id);
create unique index if not exists submissions_one_per_exam_student
  on public.submissions(exam_id, student_id) where exam_id is not null;

alter table public.submissions enable row level security;

drop policy if exists "submissions_student_own"       on public.submissions;
drop policy if exists "submissions_student_write"     on public.submissions;
drop policy if exists "submissions_student_update_own" on public.submissions;
drop policy if exists "submissions_teacher_read"      on public.submissions;
drop policy if exists "submissions_teacher_update"    on public.submissions;

create policy "submissions_student_own"
  on public.submissions for select
  using (auth.uid() = student_id);

create policy "submissions_student_write"
  on public.submissions for insert
  with check (auth.uid() = student_id);

create policy "submissions_student_update_own"
  on public.submissions for update
  using (auth.uid() = student_id and status = 'draft')
  with check (auth.uid() = student_id);

create policy "submissions_teacher_read"
  on public.submissions for select
  using (
    exists (
      select 1 from public.subjects s
      where s.id = submissions.course_id
        and s.teacher_id = auth.uid()
    )
  );

create policy "submissions_teacher_update"
  on public.submissions for update
  using (
    exists (
      select 1 from public.subjects s
      where s.id = submissions.course_id
        and s.teacher_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- D. Storage bucket for course documents
-- ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('course-documents','course-documents', false)
  on conflict (id) do nothing;

drop policy if exists "course_docs_teacher_write"  on storage.objects;
drop policy if exists "course_docs_teacher_read"   on storage.objects;
drop policy if exists "course_docs_teacher_delete" on storage.objects;
drop policy if exists "course_docs_student_read"   on storage.objects;

-- path format: <courseId>/<uuid>-<filename>
create policy "course_docs_teacher_write"
  on storage.objects for insert
  with check (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(name))[1]
        and s.teacher_id = auth.uid()
    )
  );

create policy "course_docs_teacher_read"
  on storage.objects for select
  using (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(name))[1]
        and s.teacher_id = auth.uid()
    )
  );

create policy "course_docs_teacher_delete"
  on storage.objects for delete
  using (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.subjects s
      where s.id::text = (storage.foldername(name))[1]
        and s.teacher_id = auth.uid()
    )
  );

create policy "course_docs_student_read"
  on storage.objects for select
  using (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.enrollments e
      where e.subject_id::text = (storage.foldername(name))[1]
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- E. Enable realtime on exam_grades, announcements, submissions
-- ──────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'exam_grades'
  ) then
    alter publication supabase_realtime add table public.exam_grades;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;
