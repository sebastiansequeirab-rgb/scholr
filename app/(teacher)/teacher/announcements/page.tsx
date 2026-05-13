import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnnouncementsGlobal, type AnnouncementItem } from '@/features/teacher/announcements/AnnouncementsGlobal'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherAnnouncementsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as Pick<Profile, 'role'> | null)?.role !== 'teacher') redirect('/dashboard')

  const { data: coursesRaw } = await supabase
    .from('subjects')
    .select('id, name, accent')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const courses = (coursesRaw ?? []) as { id: string; name: string; accent: string | null }[]
  const courseIds = courses.map(c => c.id)

  let announcements: AnnouncementItem[] = []
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('announcements')
      .select('id, subject_id, title, content, priority, created_at')
      .in('subject_id', courseIds)
      .order('priority', { ascending: false }) // 'urgent' < 'normal' alphabetically — so reverse to put urgent first? actually 'normal' < 'urgent' alphabetically; ascending puts normal first
      .order('created_at', { ascending: false })
    const byId = new Map(courses.map(c => [c.id, c]))
    type Row = { id: string; subject_id: string; title: string; content: string | null; priority: 'normal' | 'urgent'; created_at: string }
    announcements = ((data ?? []) as Row[])
      .map((a) => {
        const c = byId.get(a.subject_id)
        return {
          id: a.id,
          course_id: a.subject_id,
          course_name: c?.name ?? '—',
          course_accent: c?.accent ?? null,
          title: a.title,
          content: a.content,
          priority: a.priority,
          created_at: a.created_at,
        }
      })
      .sort((a, b) => {
        // urgent first, then by date desc
        if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1
        return a.created_at < b.created_at ? 1 : -1
      })
  }

  return <AnnouncementsGlobal announcements={announcements} courseList={courses} />
}
