import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TeacherDashboard } from '@/features/teacher/dashboard/TeacherDashboard'
import {
  courseAverage,
  overallAverage,
  upcomingClasses,
  type ExamWithGrades,
  type ScheduleSlot,
} from '@/features/teacher/lib/courseStats'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherPanelPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if ((profileRow as Profile | null)?.role !== 'teacher') redirect('/dashboard')
  const profile = profileRow as Profile

  // Fetch courses with enrollments + exams + exam_grades + submissions in one go
  const { data: coursesRaw } = await supabase
    .from('subjects')
    .select(`
      id, name, icon, accent, access_code, semester,
      enrollments(id, status),
      exams(id, percentage, exam_grades(grade)),
      submissions(id, status)
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  type RawCourse = {
    id: string
    name: string
    icon: string | null
    accent: string | null
    access_code: string | null
    semester: string | null
    enrollments: { id: string; status: string }[] | null
    exams: ExamWithGrades[] | null
    submissions: { id: string; status: string }[] | null
  }

  const rawCourses = (coursesRaw ?? []) as unknown as RawCourse[]

  const courses = rawCourses.map((c) => {
    const exams = (c.exams ?? []) as ExamWithGrades[]
    const enrollments = (c.enrollments ?? []).filter(e => e.status === 'active')
    const submissions = c.submissions ?? []
    const pending = submissions.filter(s => s.status === 'pending_review').length
    return {
      id: c.id,
      name: c.name,
      icon: c.icon,
      accent: c.accent,
      access_code: c.access_code,
      semester: c.semester,
      students: enrollments.length,
      average: courseAverage(exams),
      pending_review: pending,
    }
  })

  const totalStudents  = courses.reduce((acc, c) => acc + c.students, 0)
  const pendingReview  = courses.reduce((acc, c) => acc + c.pending_review, 0)
  const overall        = overallAverage(courses.map(c => c.average))
  const courseIds      = courses.map(c => c.id)

  // Schedules across teacher's courses
  let schedules: ScheduleSlot[] = []
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('schedules')
      .select('id, subject_id, day_of_week, start_time, end_time, room')
      .in('subject_id', courseIds)
    schedules = (data ?? []) as ScheduleSlot[]
  }

  const upcoming = upcomingClasses(
    schedules,
    courses.map(c => ({ id: c.id, name: c.name, accent: c.accent, icon: c.icon })),
    new Date(),
    7,
    6,
  )

  const todayDow = new Date().getDay()
  const classesToday = schedules.filter(s => s.day_of_week === todayDow).length

  // Recent announcements (5 latest)
  type AnnRow = {
    id: string
    subject_id: string
    title: string
    content: string | null
    priority: 'normal' | 'urgent'
    created_at: string
  }
  let announcements: AnnRow[] = []
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('announcements')
      .select('id, subject_id, title, content, priority, created_at')
      .in('subject_id', courseIds)
      .order('created_at', { ascending: false })
      .limit(5)
    announcements = (data ?? []) as AnnRow[]
  }

  const courseById = new Map(courses.map(c => [c.id, c]))
  const recentAnnouncements = announcements.map(a => {
    const c = courseById.get(a.subject_id)
    return {
      id: a.id,
      subject_id: a.subject_id,
      course_name: c?.name ?? '—',
      course_accent: c?.accent ?? null,
      title: a.title,
      content: a.content,
      priority: a.priority,
      created_at: a.created_at,
    }
  })

  return (
    <TeacherDashboard
      profile={profile}
      courses={courses}
      upcomingClasses={upcoming}
      recentAnnouncements={recentAnnouncements}
      totalStudents={totalStudents}
      pendingReview={pendingReview}
      overallAverage={overall}
      classesToday={classesToday}
    />
  )
}
