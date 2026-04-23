import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { GradeTable } from '@/features/teacher/grades/GradeTable'
import type { Profile } from '@/types'

export default async function GradesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: course } = await supabase
    .from('subjects')
    .select('id, name, color')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!course) notFound()

  // Fetch exams for this course (excluding study sessions)
  const { data: exams } = await supabase
    .from('exams')
    .select('id, title, activity_type, exam_date, percentage, max_grade')
    .eq('subject_id', params.id)
    .neq('activity_type', 'study_session')
    .order('exam_date', { ascending: true })

  // Fetch enrolled students
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('student_id, profiles(id, full_name, avatar_url)')
    .eq('subject_id', params.id)
    .eq('status', 'active')

  const students = (enrollments ?? []).map((e) => {
    const p = (e.profiles as unknown) as { id: string; full_name: string; avatar_url: string | null } | null
    return {
      id: p?.id ?? (e.student_id as string),
      full_name: p?.full_name ?? 'Estudiante',
      avatar_url: p?.avatar_url ?? null,
    }
  })

  // Fetch existing exam_grades
  const examIds = (exams ?? []).map((e) => e.id as string)
  const { data: existingGrades } = examIds.length > 0
    ? await supabase
        .from('exam_grades')
        .select('exam_id, student_id, grade')
        .in('exam_id', examIds)
    : { data: [] }

  // Build grades map: { [examId]: { [studentId]: grade } }
  const gradesMap: Record<string, Record<string, number | null>> = {}
  for (const g of (existingGrades ?? [])) {
    const eg = g as { exam_id: string; student_id: string; grade: number | null }
    if (!gradesMap[eg.exam_id]) gradesMap[eg.exam_id] = {}
    gradesMap[eg.exam_id][eg.student_id] = eg.grade
  }

  return (
    <GradeTable
      courseId={params.id}
      courseName={course.name as string}
      courseColor={course.color as string}
      exams={(exams ?? []).map((e) => ({
        id: e.id as string,
        title: e.title as string,
        activity_type: e.activity_type as string,
        exam_date: e.exam_date as string,
        percentage: e.percentage as number | null,
        max_grade: (e.max_grade as number | null) ?? 20,
      }))}
      students={students}
      initialGrades={gradesMap}
    />
  )
}
