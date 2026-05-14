-- Skolar — Documentos bidireccionales (alumno enrolled puede subir) — 2026-05-14
-- Additive on existing policies. No drops of existing buckets/tables.

-- ──────────────────────────────────────────────────────────────────
-- A. documents table — allow enrolled students to insert their own
-- ──────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'documents') then
    -- Make sure RLS is on (it should already be)
    execute 'alter table public.documents enable row level security';

    -- Allow enrolled students to insert a documents row scoped to their enrolled subject
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'documents'
        and policyname = 'documents_student_insert_enrolled'
    ) then
      execute $POL$
        create policy "documents_student_insert_enrolled"
          on public.documents for insert
          with check (
            auth.uid() = uploaded_by
            and exists (
              select 1 from public.enrollments e
              where e.subject_id = documents.subject_id
                and e.student_id = auth.uid()
                and e.status = 'active'
            )
          )
      $POL$;
    end if;

    -- Allow students to delete their own uploads (clean up mistakes)
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'documents'
        and policyname = 'documents_student_delete_own'
    ) then
      execute $POL$
        create policy "documents_student_delete_own"
          on public.documents for delete
          using (auth.uid() = uploaded_by)
      $POL$;
    end if;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────
-- B. Storage course-documents bucket — allow enrolled students write/delete
-- ──────────────────────────────────────────────────────────────────

-- Insert (upload) for enrolled students
drop policy if exists "course_docs_student_write" on storage.objects;

create policy "course_docs_student_write"
  on storage.objects for insert
  with check (
    bucket_id = 'course-documents'
    and exists (
      select 1 from public.enrollments e
      where e.subject_id::text = (storage.foldername(name))[1]
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

-- Delete only their own uploads (owner = uploader)
drop policy if exists "course_docs_student_delete_own" on storage.objects;

create policy "course_docs_student_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'course-documents'
    and owner = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.subject_id::text = (storage.foldername(name))[1]
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

-- NOTE: existing teacher policies (course_docs_teacher_write/read/delete)
-- and student_read remain unchanged.
