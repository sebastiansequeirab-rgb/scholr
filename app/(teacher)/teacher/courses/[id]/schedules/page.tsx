import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Profile } from '@/types'
import { CourseScheduleManager } from '@/features/teacher/courses/CourseScheduleManager'

export default async function SchedulesPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: course } = await supabase
    .from('subjects')
    .select('id, name, color, icon')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!course) notFound()

  const { data: schedules } = await supabase
    .from('schedules')
    .select('id, day_of_week, start_time, end_time, room')
    .eq('subject_id', params.id)
    .eq('user_id', user.id)
    .order('day_of_week')
    .order('start_time')

  return (
    <CourseScheduleManager
      courseId={params.id}
      courseName={course.name as string}
      courseColor={course.color as string}
      initialSchedules={schedules ?? []}
    />
  )
}
