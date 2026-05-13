/**
 * Skolar — Teacher portal seed (idempotent).
 *
 * Usage:
 *   npm run seed:teacher
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Creates:
 *   - 1 teacher (prof@skolar.test / Test1234!)
 *   - 6 students (alumno1..alumno6@skolar.test / Test1234!)
 *   - 3 courses with schedules, exams (sum to 100%), partial grades,
 *     announcements, and 1 pending_review submission per course.
 *   - Each student is enrolled in at least 2 courses.
 */

import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in .env.local')
  process.exit(1)
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const TEACHER = { email: 'prof@skolar.test', password: 'Test1234!', full_name: 'Carlos Omaña' }
const STUDENTS = [
  { email: 'alumno1@skolar.test', password: 'Test1234!', full_name: 'María Pérez' },
  { email: 'alumno2@skolar.test', password: 'Test1234!', full_name: 'Juan Rivas'  },
  { email: 'alumno3@skolar.test', password: 'Test1234!', full_name: 'Ana López'   },
  { email: 'alumno4@skolar.test', password: 'Test1234!', full_name: 'Pedro Soto'  },
  { email: 'alumno5@skolar.test', password: 'Test1234!', full_name: 'Laura Mejía' },
  { email: 'alumno6@skolar.test', password: 'Test1234!', full_name: 'Diego Cruz'  },
]

const COURSES = [
  { name: 'Cálculo I',     code: 'CAL-2026-AAA', accent: 'rose',  icon: 'functions', semester: '2026-1', credits: 4 },
  { name: 'Programación I',code: 'PRG-2026-AAA', accent: 'blue',  icon: 'code',      semester: '2026-1', credits: 4 },
  { name: 'Estadística',   code: 'EST-2026-AAA', accent: 'amber', icon: 'bar_chart', semester: '2026-1', credits: 3 },
]

const EXAMS_PER_COURSE = [
  { title: 'Parcial 1', percentage: 25, daysOffset: -14 },
  { title: 'Parcial 2', percentage: 25, daysOffset: -7  },
  { title: 'Lab',       percentage: 20, daysOffset: -3  },
  { title: 'Final',     percentage: 30, daysOffset: 21  },
]

// Distinct slots per course to avoid teacher overlap (DB trigger SCHEDULE_CONFLICT)
const SCHEDULE_PER_COURSE = [
  { days: [1, 3, 5], start: '09:00:00', end: '10:30:00' }, // Cálculo I
  { days: [1, 3, 5], start: '11:00:00', end: '12:30:00' }, // Programación I
  { days: [2, 4],    start: '14:00:00', end: '15:30:00' }, // Estadística
]

async function findUserByEmail(email: string): Promise<string | null> {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (data.users.length < 200) return null
    page++
    if (page > 50) return null
  }
}

async function ensureUser(email: string, password: string, fullName: string, role: 'student' | 'teacher'): Promise<string> {
  const existingId = await findUserByEmail(email)
  const id = existingId ?? (await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })).data.user!.id
  // Upsert profile (handle_new_user trigger creates row, but ensure role + full_name are set)
  await admin.from('profiles').upsert({ id, full_name: fullName, role }, { onConflict: 'id' })
  return id
}

async function ensureCourse(teacherId: string, c: typeof COURSES[number]) {
  const { data: existing } = await admin
    .from('subjects')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('name', c.name)
    .maybeSingle()
  if (existing) {
    await admin.from('subjects').update({
      semester: c.semester, credits: c.credits, accent: c.accent, icon: c.icon, access_code: c.code,
    }).eq('id', existing.id)
    return existing.id as string
  }
  const { data, error } = await admin.from('subjects').insert({
    user_id: teacherId,
    teacher_id: teacherId,
    name: c.name,
    semester: c.semester,
    credits: c.credits,
    accent: c.accent,
    icon: c.icon,
    color: '#5b8def',
    access_code: c.code,
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

async function ensureEnrollment(studentId: string, courseId: string) {
  const { data: existing } = await admin
    .from('enrollments')
    .select('id')
    .eq('student_id', studentId)
    .eq('subject_id', courseId)
    .maybeSingle()
  if (existing) return existing.id as string
  const { data, error } = await admin.from('enrollments').insert({
    student_id: studentId, subject_id: courseId, status: 'active',
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

async function ensureSchedule(courseId: string, teacherId: string, day: number, start: string, end: string, room: string) {
  const { data: existing } = await admin
    .from('schedules')
    .select('id')
    .eq('subject_id', courseId)
    .eq('day_of_week', day)
    .eq('start_time', start)
    .maybeSingle()
  if (existing) return existing.id as string
  const { data, error } = await admin.from('schedules').insert({
    user_id: teacherId, subject_id: courseId, day_of_week: day, start_time: start, end_time: end, room,
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

async function ensureExam(courseId: string, teacherId: string, title: string, percentage: number, examDate: string, position: number) {
  const { data: existing } = await admin
    .from('exams')
    .select('id')
    .eq('subject_id', courseId)
    .eq('title', title)
    .maybeSingle()
  if (existing) {
    await admin.from('exams').update({ percentage, exam_date: examDate, position }).eq('id', existing.id)
    return existing.id as string
  }
  const { data, error } = await admin.from('exams').insert({
    user_id: teacherId,
    subject_id: courseId,
    assigned_by: teacherId,
    title,
    activity_type: 'exam',
    percentage,
    exam_date: examDate,
    max_grade: 20,
    position,
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

async function ensureGrade(examId: string, studentId: string, grade: number | null) {
  if (grade == null) return
  await admin.from('exam_grades').upsert({
    exam_id: examId, student_id: studentId, grade, graded_at: new Date().toISOString(),
  }, { onConflict: 'exam_id,student_id' })
}

async function ensureAnnouncement(courseId: string, teacherId: string, title: string, content: string, priority: 'normal' | 'urgent') {
  const { data: existing } = await admin
    .from('announcements')
    .select('id')
    .eq('subject_id', courseId)
    .eq('title', title)
    .maybeSingle()
  if (existing) return existing.id as string
  const { data, error } = await admin.from('announcements').insert({
    subject_id: courseId, teacher_id: teacherId, title, content, priority,
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

async function ensureSubmission(courseId: string, studentId: string, examId: string, status: 'pending_review' | 'graded') {
  const { data: existing } = await admin
    .from('submissions')
    .select('id')
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .maybeSingle()
  if (existing) return existing.id as string
  const { data, error } = await admin.from('submissions').insert({
    course_id: courseId, student_id: studentId, exam_id: examId, status,
    content: 'Entrega del estudiante (seed)',
    submitted_at: new Date().toISOString(),
  }).select('id').single()
  if (error) throw error
  return data!.id as string
}

function isoDate(daysOffset: number): string {
  const d = new Date(); d.setDate(d.getDate() + daysOffset)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log('🌱 Seeding teacher portal…')

  const teacherId = await ensureUser(TEACHER.email, TEACHER.password, TEACHER.full_name, 'teacher')
  console.log(`  ✓ Teacher: ${TEACHER.email}`)

  const studentIds: string[] = []
  for (const s of STUDENTS) {
    const id = await ensureUser(s.email, s.password, s.full_name, 'student')
    studentIds.push(id)
    console.log(`  ✓ Student: ${s.email}`)
  }

  for (let ci = 0; ci < COURSES.length; ci++) {
    const c = COURSES[ci]
    const courseId = await ensureCourse(teacherId, c)
    console.log(`  ✓ Course: ${c.name}  (${c.code})`)

    // Schedules — distinct per course to avoid teacher overlap
    const slot = SCHEDULE_PER_COURSE[ci]
    for (const day of slot.days) {
      await ensureSchedule(courseId, teacherId, day, slot.start, slot.end, `Aula ${ci + 1}A`)
    }

    // Enroll students (rotated so each gets ≥2 courses)
    const enrollFor = [
      [studentIds[0], studentIds[1], studentIds[2], studentIds[3]],
      [studentIds[1], studentIds[2], studentIds[4], studentIds[5]],
      [studentIds[0], studentIds[3], studentIds[4], studentIds[5]],
    ][ci]
    for (const sid of enrollFor) await ensureEnrollment(sid, courseId)

    // Exams
    const examIds: string[] = []
    for (let i = 0; i < EXAMS_PER_COURSE.length; i++) {
      const e = EXAMS_PER_COURSE[i]
      const examId = await ensureExam(courseId, teacherId, e.title, e.percentage, isoDate(e.daysOffset), i)
      examIds.push(examId)
    }

    // Partial grades — Parciales graded for everyone, Lab for some, Final blank
    const gradeMatrix: (number | null)[][] = [
      [16, 12, 18, 14],
      [14, 13, 17, 11],
      [13, null, 15, 9],
      [null, null, null, null], // Final = blank
    ]
    for (let exi = 0; exi < examIds.length; exi++) {
      for (let si = 0; si < enrollFor.length; si++) {
        const grade = gradeMatrix[exi][si] ?? null
        if (grade != null) await ensureGrade(examIds[exi], enrollFor[si], grade)
      }
    }

    // Announcements
    await ensureAnnouncement(courseId, teacherId, `Bienvenidos a ${c.name}`, `Esta es la página del curso. Comparte el código **${c.code}** con tus compañeros.`, 'normal')
    if (ci === 0) {
      await ensureAnnouncement(courseId, teacherId, 'Cambio de horario martes', 'La clase del martes próximo se moverá al jueves a las 9am. Sin excepciones.', 'urgent')
    }

    // Pending submissions — 1-2 per course
    await ensureSubmission(courseId, enrollFor[0], examIds[2], 'pending_review') // Lab
    if (ci !== 2) {
      await ensureSubmission(courseId, enrollFor[1], examIds[2], 'pending_review')
    }
  }

  console.log('✅ Done.')
  console.log('')
  console.log('Login credentials:')
  console.log(`  Teacher:  ${TEACHER.email} / ${TEACHER.password}`)
  console.log(`  Student:  alumno1@skolar.test / Test1234!  (also alumno2..alumno6)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
