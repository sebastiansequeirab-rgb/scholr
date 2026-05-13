# Sprint 2 — Institution Ready
**Goal:** Full teacher portal — close deals with institutions.
**Duration:** 2-3 weeks

---

## DB Migrations (run in Supabase SQL editor in this exact order)

```sql
-- 1. Add role to profiles
ALTER TABLE profiles
ADD COLUMN role TEXT DEFAULT 'student'
CHECK (role IN ('student', 'teacher'));

-- 2. Add teacher fields to subjects
ALTER TABLE subjects
ADD COLUMN access_code TEXT UNIQUE,
ADD COLUMN teacher_id UUID REFERENCES profiles(id),
ADD COLUMN evaluation_plan JSONB;

-- 3. Add assigned_by to exams
ALTER TABLE exams
ADD COLUMN assigned_by UUID REFERENCES profiles(id);

-- 4. Enrollments
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) NOT NULL,
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dropped')),
  UNIQUE(student_id, subject_id)
);

-- 5. Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  teacher_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. RLS for enrollments
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students see own enrollments" ON enrollments
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers see their subject enrollments" ON enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM subjects WHERE id = subject_id AND teacher_id = auth.uid())
  );
CREATE POLICY "Students can enroll themselves" ON enrollments
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- 8. RLS for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enrolled students see announcements" ON announcements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enrollments
            WHERE subject_id = announcements.subject_id AND student_id = auth.uid())
  );
CREATE POLICY "Teachers manage own announcements" ON announcements
  FOR ALL USING (teacher_id = auth.uid());

-- 9. RLS for documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enrolled students see documents" ON documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enrollments
            WHERE subject_id = documents.subject_id AND student_id = auth.uid())
  );
CREATE POLICY "Teachers manage own documents" ON documents
  FOR ALL USING (uploaded_by = auth.uid());
```

---

## Tasks

- [ ] **Role selection on register** — Student / Teacher picker → saves to profiles.role
- [ ] **Middleware role redirect** — student → /dashboard, teacher → /teacher/dashboard
- [ ] **Teacher layout** — new app/(teacher)/layout.tsx with teacher sidebar
- [ ] **Teacher dashboard** — /teacher/dashboard — courses overview + student count
- [ ] **Create course with access code** — auto-generate unique code (MAT-2026-XK3)
- [ ] **Student joins with code** — join button on /subjects → enrollment created
- [ ] **Teacher grades table** — rows=exams, cols=students, cells=grade input → auto updates progress
- [ ] **Teacher announcements** — create/manage → badge on student dashboard
- [ ] **Teacher document upload** — Supabase Storage → visible in student subject view
- [ ] **Student enrolled subjects view** — show both self-created + enrolled subjects
