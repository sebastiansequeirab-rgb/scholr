import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CourseOverview } from '@/features/teacher/courses/CourseOverview'
import { courseAverage, passRate } from '@/features/teacher/lib/courseStats'
import type { Course, Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: courseRow } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!courseRow) notFound()
  const course = courseRow as Course

  const [
    { data: enrollmentsRaw },
    { data: examsRaw },
    { data: submissionsRaw },
    { data: schedulesRaw },
    { data: annRow },
    { data: docsRaw },
  ] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, status, profiles(id, full_name, avatar_url)')
      .eq('subject_id', params.id)
      .eq('status', 'active'),
    supabase
      .from('exams')
      .select('id, percentage, exam_grades(grade, student_id)')
      .eq('subject_id', params.id)
      .not('assigned_by', 'is', null),
    supabase
      .from('submissions')
      .select('id, status')
      .eq('course_id', params.id)
      .eq('status', 'pending_review'),
    supabase
      .from('schedules')
      .select('id, day_of_week, start_time, end_time, room')
      .eq('subject_id', params.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('announcements')
      .select('id, title, content, priority, created_at')
      .eq('subject_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('id, title, file_type, size_bytes, created_at')
      .eq('subject_id', params.id)
      .order('created_at', { ascending: false })
      .limit(4),
  ])

  type EnrollmentRow = { id: string; status: string; profiles: { id: string; full_name: string; avatar_url: string | null } | null }
  type ExamRow = { id: string; percentage: number | null; exam_grades: { grade: number | null; student_id: string }[] }

  const enrollments = (enrollmentsRaw ?? []) as unknown as EnrollmentRow[]
  const exams = (examsRaw ?? []) as unknown as ExamRow[]

  const totals = {
    students: enrollments.length,
    average: courseAverage(exams),
    pass_rate: passRate(exams),
    pending_review: (submissionsRaw ?? []).length,
  }

  // Per-student average
  const studentAverages: Map<string, number | null> = new Map()
  for (const e of enrollments) {
    const sid = e.profiles?.id
    if (!sid) continue
    let earned = 0
    let gradedWeight = 0
    for (const ex of exams) {
      const pct = ex.percentage ?? 0
      const g = ex.exam_grades.find(eg => eg.student_id === sid)?.grade
      if (pct > 0 && g != null) {
        earned += g * (pct / 100)
        gradedWeight += pct
      }
    }
    studentAverages.set(sid, gradedWeight === 0 ? null : earned / (gradedWeight / 100))
  }

  const topStudents = enrollments
    .filter(e => !!e.profiles)
    .map(e => ({
      id: e.profiles!.id,
      full_name: e.profiles!.full_name || 'Estudiante',
      avatar_url: e.profiles!.avatar_url,
      average: studentAverages.get(e.profiles!.id) ?? null,
    }))
    .slice(0, 4)

  return (
    <CourseOverview
      course={course}
      totals={totals}
      schedules={(schedulesRaw ?? []) as never}
      topStudents={topStudents}
      latestAnnouncement={(annRow ?? null) as never}
      topDocuments={(docsRaw ?? []) as never}
    />
  )
}
