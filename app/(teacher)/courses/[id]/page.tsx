import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CourseOverview } from '@/features/teacher/courses/CourseOverview'
import type { Profile } from '@/types'

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
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
    .select('*')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!course) notFound()

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, joined_at, profiles(id, full_name, avatar_url)')
    .eq('subject_id', params.id)
    .eq('status', 'active')

  const students = (enrollments ?? []).map((e) => {
    const p = (e.profiles as unknown) as { id: string; full_name: string; avatar_url: string | null } | null
    return {
      enrollment_id: e.id as string,
      id: p?.id ?? '',
      full_name: p?.full_name ?? 'Estudiante',
      avatar_url: p?.avatar_url ?? null,
    }
  })

  return (
    <CourseOverview
      course={{
        id: course.id as string,
        name: course.name as string,
        color: course.color as string,
        icon: (course.icon as string | null),
        access_code: (course.access_code as string | null),
      }}
      students={students}
    />
  )
}
