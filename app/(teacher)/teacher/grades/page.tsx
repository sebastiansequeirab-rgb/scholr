import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GradesGlobal } from '@/features/teacher/grades/GradesGlobal'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherGradesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: coursesRaw } = await supabase
    .from('subjects')
    .select(`
      id, name, accent, semester,
      exams!exams_subject_id_fkey(id, title, percentage, position, exam_grades(grade, student_id)),
      enrollments(student_id, status, profiles(id, full_name, avatar_url))
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  type RawCourse = {
    id: string
    name: string
    accent: string | null
    semester: string | null
    exams: { id: string; title: string; percentage: number | null; position: number | null; exam_grades: { grade: number | null; student_id: string }[] }[] | null
    enrollments: { student_id: string; status: string; profiles: { id: string; full_name: string; avatar_url: string | null } | null }[] | null
  }
  const raw = (coursesRaw ?? []) as unknown as RawCourse[]

  const blocks = raw.map((c) => {
    const exams = (c.exams ?? [])
      .map(e => ({ ...e, position: e.position ?? 0 }))
      .sort((a, b) => (a.position - b.position) || a.title.localeCompare(b.title))
    const students = (c.enrollments ?? [])
      .filter(e => e.status === 'active' && e.profiles)
      .map(e => ({ id: e.profiles!.id, full_name: e.profiles!.full_name || 'Estudiante', avatar_url: e.profiles!.avatar_url }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    const grades = exams.flatMap(e => e.exam_grades.map(g => ({ exam_id: e.id, student_id: g.student_id, grade: g.grade })))
    return {
      id: c.id,
      name: c.name,
      semester: c.semester,
      accent: c.accent,
      exams: exams.map(({ id, title, percentage, position }) => ({ id, title, percentage, position })),
      students,
      grades,
    }
  })

  const courseList = blocks.map(b => ({ id: b.id, name: b.name, accent: b.accent }))

  return <GradesGlobal courses={blocks} courseList={courseList} />
}
