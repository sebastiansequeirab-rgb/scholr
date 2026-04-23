import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoursesClient } from '@/features/teacher/courses/CoursesClient'
import type { Profile } from '@/types'

export default async function CoursesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if ((profile as Profile | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: courses } = await supabase
    .from('subjects')
    .select(`
      id,
      name,
      color,
      icon,
      access_code,
      created_at,
      enrollments(id, status)
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const coursesWithCounts = (courses ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    color: c.color as string,
    icon: c.icon as string | null,
    access_code: c.access_code as string | null,
    student_count: Array.isArray(c.enrollments)
      ? (c.enrollments as { status: string }[]).filter((e) => e.status === 'active').length
      : 0,
  }))

  return (
    <CoursesClient
      initialCourses={coursesWithCounts}
      teacherId={user.id}
    />
  )
}
