import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslator } from '@/lib/i18n/server'
import { ChatThreads, type Thread, type ChatMessageRow } from '@/features/messages/ChatThreads'
import { NewChatButton } from '@/features/messages/NewChatButton'
import { DashboardRefresher } from '@/features/home/components/DashboardRefresher'
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
  teacher:  { id: string; full_name: string | null; avatar_url: string | null } | null
}

export default async function StudentMessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t, lang } = getTranslator()

  const { data: raw } = await supabase
    .from('messages')
    .select(`
      id, teacher_id, student_id, course_id, sender_id, body, created_at, read_at,
      subjects:course_id(id, name, accent),
      teacher:teacher_id(id, full_name, avatar_url)
    `)
    .eq('student_id', user.id)
    .order('created_at', { ascending: true })

  const rows = (raw ?? []) as unknown as Row[]
  const threads = groupThreadsForStudent(rows, user.id)

  return (
    <div className="t-screen">
      <DashboardRefresher />
      <header className="t-section-head" style={{ marginTop: 0 }}>
        <div className="t-section-head__left">
          <span className="t-section-head__kicker">
            {lang === 'es' ? 'Estudiante' : 'Student'}
          </span>
          <h1 className="t-section-head__title">{t('teacher.messages.title')}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NewChatButton variant="student" currentUserId={user.id} />
          <Link href="/dashboard" className="t-section-head__link">
            <span className="material-symbols-outlined">arrow_back</span>
            {lang === 'es' ? 'Dashboard' : 'Dashboard'}
          </Link>
        </div>
      </header>

      <ChatThreads variant="student" currentUserId={user.id} threads={threads} />
    </div>
  )
}

function groupThreadsForStudent(rows: Row[], studentId: string): Thread[] {
  const map = new Map<string, Thread>()
  for (const r of rows) {
    const key = `${r.teacher_id}:${r.course_id ?? '-'}`
    const peerName = r.teacher?.full_name ?? 'Profesor'
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
        peerId: r.teacher_id,
        peerName,
        peerAvatar: r.teacher?.avatar_url ?? null,
        courseId: r.course_id,
        courseName: r.subjects?.name ?? null,
        courseAccent: accent,
        lastBody: r.body,
        lastAt: r.created_at,
        unread: r.sender_id !== studentId && !r.read_at ? 1 : 0,
        messages: [msg],
      })
    } else {
      existing.messages.push(msg)
      existing.lastBody = r.body
      existing.lastAt = r.created_at
      if (r.sender_id !== studentId && !r.read_at) existing.unread += 1
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  )
}
