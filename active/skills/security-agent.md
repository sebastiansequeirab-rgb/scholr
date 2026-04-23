# SKILL: security-agent
# Use this skill to audit and fix all Skolar security issues.
# Invoke with: "Use the security-agent skill to fix all security issues"

## Purpose
Audit the Supabase project for security vulnerabilities and fix them.
Uses Supabase MCP tools directly — no manual SQL needed.

## Protocol
1. Run Supabase security advisor to get current issues
2. For each issue found: determine if fixable via SQL or requires dashboard
3. Execute SQL fixes directly via Supabase MCP
4. Report dashboard-only fixes with exact navigation path

## Known issues to fix (Skolar specific)

### Issue 1 — SECURITY DEFINER view (CRITICAL)
Fix via SQL:
```sql
DROP VIEW IF EXISTS public.upcoming_exams;
CREATE VIEW public.upcoming_exams AS
SELECT e.id, e.user_id, e.subject_id, e.title, e.exam_date, e.exam_time,
       e.location, e.activity_type, e.percentage, e.grade, 
       e.submission_status, e.max_grade
FROM exams e
WHERE e.exam_date >= CURRENT_DATE
ORDER BY e.exam_date ASC;
```

### Issue 2 — Mutable search_path on 4 functions
Read each function definition first, then recreate with SET search_path = public.
Functions: check_schedule_conflict, handle_task_done, handle_new_user, set_updated_at

### Issue 3 — avatars bucket public listing
Fix via SQL:
```sql
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Users can view own avatar"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Issue 4 — Leaked password protection
Dashboard only: Authentication → Sign In / Up → Password Strength → Enable
Report this to user with exact navigation path.

## After fixing, run security advisor again to confirm 0 issues.
