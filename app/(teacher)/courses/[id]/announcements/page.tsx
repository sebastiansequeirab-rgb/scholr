import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AnnouncementsClient } from '@/features/teacher/announcements/AnnouncementsClient'
import type { Profile, Announcement } from '@/types'

export default async function AnnouncementsPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: course } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('id', params.id)
    .eq('teacher_id', user.id)
    .single()

  if (!course) notFound()

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .eq('subject_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <AnnouncementsClient
      courseId={params.id}
      courseName={course.name as string}
      teacherId={user.id}
      initialAnnouncements={(announcements ?? []) as Announcement[]}
    />
  )
}
