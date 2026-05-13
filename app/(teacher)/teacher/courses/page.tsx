import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from '@/features/teacher/courses/CoursesClient'
import {
  courseAverage,
  passRate,
  type ExamWithGrades,
} from '@/features/teacher/lib/courseStats'
import type { Profile, Course } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherCoursesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: coursesRaw } = await supabase
    .from('subjects')
    .select(`
      id, user_id, name, professor, color, icon, room, credits, created_at, access_code, teacher_id, evaluation_plan, semester, accent,
      enrollments(id, status),
      exams(id, percentage, exam_grades(grade)),
      submissions(id, status)
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  type RawCourse = Course & {
    enrollments: { id: string; status: string }[] | null
    exams: ExamWithGrades[] | null
    submissions: { id: string; status: string }[] | null
  }

  const raw = (coursesRaw ?? []) as unknown as RawCourse[]
  const items = raw.map((c) => {
    const exams = (c.exams ?? []) as ExamWithGrades[]
    const enrollments = (c.enrollments ?? []).filter(e => e.status === 'active')
    const submissions = c.submissions ?? []
    return {
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      professor: c.professor,
      color: c.color,
      icon: c.icon,
      room: c.room,
      credits: c.credits,
      created_at: c.created_at,
      access_code: c.access_code,
      teacher_id: c.teacher_id,
      evaluation_plan: c.evaluation_plan,
      semester: c.semester,
      accent: c.accent,
      student_count: enrollments.length,
      average: courseAverage(exams),
      pass_rate: passRate(exams),
      pending_review: submissions.filter(s => s.status === 'pending_review').length,
    }
  })

  return <CoursesClient initialCourses={items} />
}
