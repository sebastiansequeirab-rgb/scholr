import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTranslator } from '@/lib/i18n/server'
import { ChatThreads, type Thread, type ChatMessageRow } from '@/features/messages/ChatThreads'
import { NewChatButton } from '@/features/messages/NewChatButton'
import type { CourseAccent } from '@/types'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  teacher_id: string
  student_id: string
  course_id: string | null
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  subjects: { id: string; name: string; accent: string | null } | null
  student:  { id: string; full_name: string | null; avatar_url: string | null } | null
}

export default async function TeacherMessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'teacher') redirect('/dashboard')

  const { t } = getTranslator()

  const { data: raw } = await supabase
    .from('messages')
    .select(`
      id, teacher_id, student_id, course_id, sender_id, body, created_at, read_at,
      subjects:course_id(id, name, accent),
      student:student_id(id, full_name, avatar_url)
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: true })

  const rows = (raw ?? []) as unknown as Row[]
  const threads = groupThreadsForTeacher(rows, user.id)

  return (
    <div className="t-screen">
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">{t('teacher.messages.kicker')}</span>
          <h1 className="t-section-head__title">{t('teacher.messages.title')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NewChatButton variant="teacher" currentUserId={user.id} />
          <Link href="/teacher" className="t-section-head__link">
            <span className="material-symbols-outlined">arrow_back</span>
            {t('teacher.common.back')}
          </Link>
        </div>
      </header>

      <ChatThreads variant="teacher" currentUserId={user.id} threads={threads} />
    </div>
  )
}

function groupThreadsForTeacher(rows: Row[], teacherId: string): Thread[] {
  const map = new Map<string, Thread>()
  for (const r of rows) {
    const key = `${r.student_id}:${r.course_id ?? '-'}`
    const peerName = r.student?.full_name ?? 'Estudiante'
    const accent = (r.subjects?.accent ?? null) as CourseAccent | null
    const msg: ChatMessageRow = {
      id: r.id,
      teacher_id: r.teacher_id,
      student_id: r.student_id,
      course_id: r.course_id,
      sender_id: r.sender_id,
      body: r.body,
      created_at: r.created_at,
      read_at: r.read_at,
    }
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        threadKey: key,
        peerId: r.student_id,
        peerName,
        peerAvatar: r.student?.avatar_url ?? null,
        courseId: r.course_id,
        courseName: r.subjects?.name ?? null,
        courseAccent: accent,
        lastBody: r.body,
        lastAt: r.created_at,
        unread: r.sender_id !== teacherId && !r.read_at ? 1 : 0,
        messages: [msg],
      })
    } else {
      existing.messages.push(msg)
      existing.lastBody = r.body
      existing.lastAt = r.created_at
      if (r.sender_id !== teacherId && !r.read_at) existing.unread += 1
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  )
}
