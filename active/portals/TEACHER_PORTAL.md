# Teacher Portal — Full Spec (Sprint 2)

## Routes to create
```
app/(teacher)/
├── layout.tsx                      Teacher sidebar
├── dashboard/page.tsx              Courses overview + student count
├── courses/
│   ├── page.tsx                    List of courses + access codes
│   └── [id]/
│       ├── page.tsx                Course overview
│       ├── students/page.tsx       Enrolled students + progress
│       ├── grades/page.tsx         Grade assignment table
│       ├── announcements/page.tsx  Create + manage announcements
│       └── documents/page.tsx      Upload + manage materials
```

## Connection flow
```
1. Teacher registers → picks "Teacher" role
2. Middleware detects role=teacher → /teacher/dashboard
3. Teacher creates course → access_code generated (e.g. MAT-2026-XK3)
4. Teacher shares code with students
5. Student: /subjects → "Join with code" → enrollment created
6. Teacher creates exams with percentages → appears in student planner
7. Teacher assigns grade → student progress bar updates automatically
8. Teacher publishes announcement → badge on student dashboard
9. Teacher uploads document → visible inside student's subject view
```

## Access code format
`3-LETTER-PREFIX + '-' + YEAR + '-' + 3-CHAR-SUFFIX`
Example: MAT-2026-XK3
Generated on course creation. Stored in subjects.access_code (UNIQUE).

## Grade table logic
- Rows: all exams for the course
- Columns: all enrolled students
- Cells: editable number input (0-20)
- On save: UPDATE exams.grade → progress bar updates using same formula as Sprint 1
