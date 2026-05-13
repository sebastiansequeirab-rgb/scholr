import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StudentsGlobal, type StudentRow } from '@/features/teacher/students/StudentsGlobal'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherStudentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: coursesRaw } = await supabase
    .from('subjects')
    .select(`
      id, name, accent,
      enrollments(id, student_id, status, profiles(id, full_name, avatar_url)),
      exams!exams_subject_id_fkey(id, title, percentage, exam_grades(grade, student_id)),
      submissions(id, student_id, status, submitted_at)
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  type Raw = {
    id: string
    name: string
    accent: string | null
    enrollments: { id: string; student_id: string; status: string; profiles: { id: string; full_name: string; avatar_url: string | null } | null }[] | null
    exams: { id: string; title: string; percentage: number | null; exam_grades: { grade: number | null; student_id: string }[] }[] | null
    submissions: { id: string; student_id: string; status: string; submitted_at: string }[] | null
  }

  const rows: StudentRow[] = []
  for (const c of (coursesRaw ?? []) as unknown as Raw[]) {
    const exams = c.exams ?? []
    for (const e of (c.enrollments ?? [])) {
      if (e.status !== 'active' || !e.profiles) continue
      const sid = e.profiles.id

      let earned = 0, gradedWeight = 0
      const grades = exams.map(ex => {
        const g = ex.exam_grades.find(x => x.student_id === sid)?.grade ?? null
        if (g != null && (ex.percentage ?? 0) > 0) { earned += g * ((ex.percentage ?? 0) / 100); gradedWeight += (ex.percentage ?? 0) }
        return { exam_title: ex.title, percentage: ex.percentage, grade: g }
      })
      const avg = gradedWeight === 0 ? null : earned / (gradedWeight / 100)
      const subs = (c.submissions ?? []).filter(s => s.student_id === sid).map(s => ({ id: s.id, status: s.status, submitted_at: s.submitted_at }))

      rows.push({
        enrollment_id: e.id,
        student_id: sid,
        full_name: e.profiles.full_name || 'Estudiante',
        avatar_url: e.profiles.avatar_url,
        course_id: c.id,
        course_name: c.name,
        course_accent: c.accent,
        average: avg,
        grades,
        submissions: subs,
      })
    }
  }

  rows.sort((a, b) => a.full_name.localeCompare(b.full_name))

  const courseList = (coursesRaw ?? []).map((c) => ({ id: c.id as string, name: c.name as string, accent: c.accent as string | null }))

  return <StudentsGlobal students={rows} courseList={courseList} />
}
