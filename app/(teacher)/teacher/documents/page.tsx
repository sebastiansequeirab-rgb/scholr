import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentsGlobal } from '@/features/teacher/documents/DocumentsGlobal'
import type { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TeacherDocumentsPage() {
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
  const byId = new Map(courses.map(c => [c.id, c]))

  type Row = { id: string; subject_id: string; title: string; file_type: string | null; size_bytes: number | null; created_at: string }
  let documents: Row[] = []
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from('documents')
      .select('id, subject_id, title, file_type, size_bytes, created_at')
      .in('subject_id', courseIds)
      .order('created_at', { ascending: false })
    documents = (data ?? []) as Row[]
  }

  const items = documents.map(d => {
    const c = byId.get(d.subject_id)
    return {
      id: d.id,
      course_id: d.subject_id,
      course_name: c?.name ?? '—',
      course_accent: c?.accent ?? null,
      title: d.title,
      file_type: d.file_type,
      size_bytes: d.size_bytes,
      created_at: d.created_at,
    }
  })

  return <DocumentsGlobal documents={items} courseList={courses} />
}
