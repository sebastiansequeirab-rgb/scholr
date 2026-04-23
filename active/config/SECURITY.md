# Security Issues — Skolar
Detected via Supabase Security Advisor. Fix ALL before any demo.

---

## 🔴 CRITICAL

### 1. upcoming_exams view — SECURITY DEFINER bypasses RLS
Any user can see ALL users' exams.

```sql
DROP VIEW IF EXISTS public.upcoming_exams;

CREATE VIEW public.upcoming_exams AS
SELECT e.id, e.user_id, e.subject_id, e.title, e.exam_date,
       e.exam_time, e.location, e.activity_type, e.percentage,
       e.grade, e.submission_status, e.max_grade
FROM exams e
WHERE e.exam_date >= CURRENT_DATE
ORDER BY e.exam_date ASC;
```

---

## 🟡 WARNING

### 2. Mutable search_path on 4 functions
Read each function body first, then recreate with SET search_path = public.

```sql
-- View each function first
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname IN ('check_schedule_conflict','handle_task_done','handle_new_user','set_updated_at');

-- Then recreate each adding: SET search_path = public
-- Example:
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Repeat for all 4 with their actual existing body
```

### 3. avatars bucket allows public listing
```sql
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

CREATE POLICY "Users can view own avatar"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Leaked password protection — DASHBOARD ONLY
Path: Supabase Dashboard → Authentication → Sign In / Up → Password Strength
Action: Enable "Check for leaked passwords using HaveIBeenPwned.org"
No SQL needed.

---

## Verification
After fixes: Dashboard → Database → Database Linter → Security
Expected: 0 errors, 0 warnings.
