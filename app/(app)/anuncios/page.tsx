import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslator } from '@/lib/i18n/server'
import { StudentAnnouncementsView, type StudentAnnouncementItem, type StudentAnnouncementCourse } from '@/features/announcements/StudentAnnouncementsView'
import { DashboardRefresher } from '@/features/home/components/DashboardRefresher'
import type { CourseAccent } from '@/types'

export const dynamic = 'force-dynamic'

type AnnRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  title: string
  content: string | null
  priority: 'normal' | 'urgent'
  expires_at: string | null
  created_at: string
  subjects: { id: string; name: string; accent: string | null; color: string | null } | null
  teacher: { id: string; full_name: string | null } | null
}

export default async function StudentAnnouncementsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { t } = getTranslator()

  // Get enrolled subject ids
  const { data: enrollmentData } = await supabase
    .from('enrollments')
    .select('subject_id')
    .eq('student_id', user.id)
    .eq('status', 'active')

  const subjectIds = (enrollmentData ?? []).map((e: { subject_id: string }) => e.subject_id)

  if (subjectIds.length === 0) {
    return (
      <div className="t-screen">
        <DashboardRefresher />
        <header className="t-section-head" style={{ marginTop: 0 }}>
          <div className="t-section-head__left">
            <span className="t-section-head__kicker">{t('studentAnnouncements.kicker')}</span>
            <h1 className="t-section-head__title">{t('studentAnnouncements.title').toLowerCase()}</h1>
          </div>
        </header>
        <div className="t-empty" style={{ marginTop: 22 }}>
          <div className="t-empty__icon"><span className="material-symbols-outlined">campaign</span></div>
          <div className="t-empty__title">{t('studentAnnouncements.empty')}</div>
          <div className="t-empty__sub">{t('studentAnnouncements.emptyDesc')}</div>
        </div>
      </div>
    )
  }

  // Fetch announcements + reads in parallel
  const nowIso = new Date().toISOString()
  const [annRes, readRes] = await Promise.all([
    supabase
      .from('announcements')
      .select(`id, subject_id, teacher_id, title, content, priority, expires_at, created_at,
        subjects:subject_id(id, name, accent, color),
        teacher:teacher_id(id, full_name)`)
      .in('subject_id', subjectIds)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('created_at', { ascending: false }),
    supabase
      .from('announcement_reads')
      .select('announcement_id')
      .eq('student_id', user.id),
  ])

  const annRaw = (annRes.data ?? []) as unknown as AnnRow[]
  const readSet = new Set((readRes.data ?? []).map((r: { announcement_id: string }) => r.announcement_id))

  const announcements: StudentAnnouncementItem[] = annRaw.map(a => ({
    id: a.id,
    courseId: a.subject_id,
    courseName: a.subjects?.name ?? '—',
    courseAccent: (a.subjects?.accent ?? null) as CourseAccent | null,
    teacherName: a.teacher?.full_name ?? null,
    title: a.title,
    content: a.content,
    priority: a.priority,
    expiresAt: a.expires_at,
    createdAt: a.created_at,
    read: readSet.has(a.id),
  }))

  // Course filter list (deduped)
  const courseMap = new Map<string, StudentAnnouncementCourse>()
  for (const a of annRaw) {
    if (!a.subjects) continue
    courseMap.set(a.subject_id, {
      id: a.subject_id,
      name: a.subjects.name,
      accent: (a.subjects.accent ?? null) as CourseAccent | null,
    })
  }
  const courseList = Array.from(courseMap.values())

  return (
    <div className="t-screen">
      <DashboardRefresher />
      <StudentAnnouncementsView announcements={announcements} courses={courseList} />
    </div>
  )
}
